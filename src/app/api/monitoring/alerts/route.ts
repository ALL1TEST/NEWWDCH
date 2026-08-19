// ============================================================
// GET /api/monitoring/alerts — List alerts (paginated, filtered)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const VALID_STATUS = new Set(['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED', 'SNOOZED']);
const VALID_SEVERITY = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const SORTABLE = new Set(['createdAt', 'updatedAt', 'severity', 'status']);

// =====================================================================
// GET — list alerts
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const status = sp.get('status') || undefined;
    const severity = sp.get('severity') || undefined;
    const siteId = sp.get('siteId') || undefined;

    const where: Record<string, unknown> = {};
    if (status && VALID_STATUS.has(status)) where.status = status;
    if (severity && VALID_SEVERITY.has(severity)) where.severity = severity;
    if (siteId) where.siteId = siteId;

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.alert.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          rule: { select: { id: true, name: true, metricType: true, condition: true, threshold: true } },
          acknowledgedBy: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      db.alert.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[MONITORING:ALERTS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch alerts' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
