// ============================================================
// GET /api/api-dashboard — API dashboard stats
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

function reqId() { return 'req_' + nanoid(8); }

export async function GET(_request: NextRequest) {
  const id = reqId();

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Key counts by status
    const keyStatusCounts = await db.apiKey.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const keyCounts: Record<string, number> = {};
    for (const item of keyStatusCounts) {
      keyCounts[item.status] = item._count.id;
    }
    const totalKeys = Object.values(keyCounts).reduce((a, b) => a + b, 0);

    // Today's API logs
    const [todayLogs, todayErrors, totalLogs] = await Promise.all([
      db.apiLog.count({ where: { createdAt: { gte: todayStart } } }),
      db.apiLog.count({ where: { createdAt: { gte: todayStart }, statusCode: { gte: 400 } } }),
      db.apiLog.count(),
    ]);

    // Average latency (last 24h)
    const avgLatency = await db.apiLog.aggregate({
      _avg: { duration: true },
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    // Total bandwidth (last 24h)
    const bandwidth = await db.apiLog.aggregate({
    _sum: { requestSize: true, responseSize: true },
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    // Requests per hour (last 24h, grouped by hour)
    const hourlyData: { hour: string; requests: number; errors: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const hStart = new Date(Date.now() - (i + 1) * 60 * 60 * 1000);
      const hEnd = new Date(Date.now() - i * 60 * 60 * 1000);
      const [hRequests, hErrors] = await Promise.all([
        db.apiLog.count({ where: { createdAt: { gte: hStart, lt: hEnd } } }),
        db.apiLog.count({ where: { createdAt: { gte: hStart, lt: hEnd }, statusCode: { gte: 400 } } }),
      ]);
      hourlyData.push({
        hour: hStart.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
        requests: hRequests,
        errors: hErrors,
      });
    }

    // Top endpoints (last 24h)
    const topEndpoints = await db.apiLog.groupBy({
      by: ['path', 'method'],
      _count: { id: true },
      _avg: { duration: true },
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Top API keys (last 24h)
    const topKeys = await db.apiKey.findMany({
      where: { lastUsedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { totalRequests: 'desc' },
      take: 5,
      select: { id: true, name: true, keyPrefix: true, totalRequests: true, totalErrors: true, lastUsedAt: true, lastUsedIp: true },
    });

    // PAT & OAuth counts
    const [patCount, oauthCount] = await Promise.all([
      db.personalAccessToken.count(),
      db.oAuthClient.count(),
    ]);

    return NextResponse.json({
      data: {
        keys: {
          total: totalKeys,
          active: keyCounts['ACTIVE'] ?? 0,
          inactive: keyCounts['INACTIVE'] ?? 0,
          revoked: keyCounts['REVOKED'] ?? 0,
          expired: keyCounts['EXPIRED'] ?? 0,
        },
        requests: {
          today: todayLogs,
          total: totalLogs,
          errorsToday: todayErrors,
          errorRate: todayLogs > 0 ? ((todayErrors / todayLogs) * 100).toFixed(1) : '0.0',
          avgLatencyMs: Math.round(avgLatency._avg.duration ?? 0),
        },
        bandwidth: {
          requestBytes24h: bandwidth._sum.requestSize ?? 0,
          responseBytes24h: bandwidth._sum.responseSize ?? 0,
          totalBytes24h: (bandwidth._sum.requestSize ?? 0) + (bandwidth._sum.responseSize ?? 0),
        },
        tokens: { personalAccessTokens: patCount, oauthClients: oauthCount },
        hourlyData,
        topEndpoints: topEndpoints.map((e) => ({
          path: e.path,
          method: e.method,
          requests: e._count.id,
          avgDuration: Math.round(e._avg.duration ?? 0),
        })),
        topKeys,
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[API_DASHBOARD] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch API dashboard data' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
