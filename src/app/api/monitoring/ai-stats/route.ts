// ============================================================
// GET /api/monitoring/ai-stats — AI usage statistics aggregation
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

function getRangeStart(range: string): Date {
  const days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// =====================================================================
// GET — AI stats
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const range = sp.get('range') || '7d';
    const since = getRangeStart(range);

    const where = { createdAt: { gte: since } };

    const [
      totalRequests,
      totalTokens,
      totalCost,
      avgDuration,
      errorCount,
      successCount,
      byProvider,
      perSiteStats,
    ] = await Promise.all([
      db.aiLog.count({ where }),
      db.aiLog.aggregate({ where, _sum: { totalTokens: true, inputTokens: true, outputTokens: true } }),
      db.aiLog.aggregate({ where, _sum: { costUsd: true } }),
      db.aiLog.aggregate({ where: { ...where, durationMs: { not: null } }, _avg: { durationMs: true } }),
      db.aiLog.count({ where: { ...where, status: { not: 'success' } } }),
      db.aiLog.count({ where: { ...where, status: 'success' } }),
      // By provider breakdown
      db.aiLog.groupBy({
        by: ['providerName'],
        where,
        _count: { id: true },
        _sum: { totalTokens: true, costUsd: true, inputTokens: true, outputTokens: true },
        _avg: { durationMs: true },
      }),
      // Per-site stats
      db.aiLog.groupBy({
        by: ['siteId'],
        where,
        _count: { id: true },
        _sum: { totalTokens: true, costUsd: true },
      }),
    ]);

    const errorRate = totalRequests > 0 ? Math.round((errorCount / totalRequests) * 10000) / 100 : 0;
    const successRate = totalRequests > 0 ? Math.round((successCount / totalRequests) * 10000) / 100 : 0;

    return NextResponse.json({
      data: {
        range,
        since: since.toISOString(),
        totalRequests,
        tokens: {
          total: totalTokens._sum.totalTokens ?? 0,
          input: totalTokens._sum.inputTokens ?? 0,
          output: totalTokens._sum.outputTokens ?? 0,
        },
        costUsd: totalCost._sum.costUsd ?? 0,
        avgLatencyMs: avgDuration._avg.durationMs ?? 0,
        errorRate,
        successRate,
        errorCount,
        successCount,
        byProvider: byProvider.map((g) => ({
          provider: g.providerName ?? 'Unknown',
          requests: g._count.id,
          totalTokens: g._sum.totalTokens ?? 0,
          inputTokens: g._sum.inputTokens ?? 0,
          outputTokens: g._sum.outputTokens ?? 0,
          costUsd: g._sum.costUsd ?? 0,
          avgLatencyMs: g._avg.durationMs ?? 0,
        })),
        perSite: perSiteStats.map((g) => ({
          siteId: g.siteId ?? 'global',
          requests: g._count.id,
          totalTokens: g._sum.totalTokens ?? 0,
          costUsd: g._sum.costUsd ?? 0,
        })),
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:AI_STATS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch AI stats' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
