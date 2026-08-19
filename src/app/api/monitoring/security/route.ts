// ============================================================
// GET /api/monitoring/security — Security events with summary stats
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const VALID_EVENT_TYPES = new Set([
  'FAILED_LOGIN', 'BLOCKED_IP', 'RATE_LIMIT_HIT', 'PERMISSION_ERROR',
  'SUSPICIOUS_ACTIVITY', 'EXPIRED_SESSION', 'BRUTE_FORCE_ATTEMPT', 'UNKNOWN',
]);
const SORTABLE = new Set(['createdAt', 'eventType', 'ipAddress']);

// =====================================================================
// GET — list security events + summary
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const eventType = sp.get('eventType') || undefined;
    const siteId = sp.get('siteId') || undefined;
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');

    const where: Record<string, unknown> = {};
    if (eventType && VALID_EVENT_TYPES.has(eventType)) where.eventType = eventType;
    if (siteId) where.siteId = siteId;
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total, typeBreakdown, recentFailedLogins, blockedIps] = await Promise.all([
      db.securityEvent.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.securityEvent.count({ where }),
      // Breakdown by type
      db.securityEvent.groupBy({
        by: ['eventType'],
        _count: { id: true },
      }),
      // Recent failed logins (last 24h)
      db.securityEvent.findMany({
        where: { eventType: 'FAILED_LOGIN', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, ipAddress: true, description: true, createdAt: true, userAgent: true },
      }),
      // Blocked IPs with counts
      db.securityEvent.groupBy({
        by: ['ipAddress'],
        where: { eventType: 'BLOCKED_IP', ipAddress: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
    ]);

    const summary = {
      totalEvents: total,
      byType: typeBreakdown.map((g) => ({ eventType: g.eventType, count: g._count.id })),
      recentFailedLogins,
      blockedIps: blockedIps
        .filter((g) => g.ipAddress !== null)
        .map((g) => ({ ip: g.ipAddress, count: g._count.id })),
    };

    return NextResponse.json({
      data: { items, summary },
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[MONITORING:SECURITY:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch security events' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
