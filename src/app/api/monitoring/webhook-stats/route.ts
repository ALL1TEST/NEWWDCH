// ============================================================
// GET /api/monitoring/webhook-stats — Webhook delivery aggregates
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// =====================================================================
// GET — webhook delivery stats
// =====================================================================

export async function GET(_request: NextRequest) {
  const id = reqId();

  try {
    const [
      totalDeliveries,
      successCount,
      failedCount,
      retryingCount,
      avgDurationResult,
      lastFailure,
      lastSuccess,
      retryQueueSize,
      byStatus,
      topFailingWebhooks,
    ] = await Promise.all([
      db.webhookDelivery.count(),
      db.webhookDelivery.count({ where: { status: 'SUCCESS' } }),
      db.webhookDelivery.count({ where: { status: 'FAILED' } }),
      db.webhookDelivery.count({ where: { status: { in: ['RETRYING', 'QUEUED'] } } }),
      db.webhookDelivery.aggregate({
        where: { duration: { not: null } },
        _avg: { duration: true },
      }),
      db.webhookDelivery.findFirst({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, webhookName: true, errorMessage: true, createdAt: true },
      }),
      db.webhookDelivery.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, webhookName: true, createdAt: true, statusCode: true },
      }),
      db.webhookDelivery.count({
        where: { status: { in: ['RETRYING', 'QUEUED', 'PENDING'] } },
      }),
      db.webhookDelivery.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      // Top failing webhooks
      db.webhookDelivery.groupBy({
        by: ['webhookId', 'webhookName'],
        where: { status: 'FAILED' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    const totalRequests = totalDeliveries;
    const successPercent = totalRequests > 0 ? Math.round((successCount / totalRequests) * 10000) / 100 : 0;
    const failurePercent = totalRequests > 0 ? Math.round((failedCount / totalRequests) * 10000) / 100 : 0;

    return NextResponse.json({
      data: {
        totalRequests,
        successCount,
        failedCount,
        retryingCount,
        successPercent,
        failurePercent,
        avgResponseTimeMs: avgDurationResult._avg.duration ?? 0,
        lastFailure,
        lastSuccess,
        retryQueueSize,
        byStatus: byStatus.map((g) => ({ status: g.status, count: g._count.id })),
        topFailingWebhooks: topFailingWebhooks.map((g) => ({
          webhookId: g.webhookId,
          name: g.webhookName,
          failureCount: g._count.id,
        })),
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:WEBHOOK_STATS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhook stats' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
