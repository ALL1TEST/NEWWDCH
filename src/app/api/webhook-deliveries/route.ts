// ============================================================
// GET /api/webhook-deliveries — List webhook deliveries (paginated, filterable)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSiteWhere } from '@/lib/site-context';

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'status', 'webhookId', 'event']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const webhookId = sp.get('webhookId') || undefined;
    const status = sp.get('status') || undefined;

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (webhookId) where.webhookId = webhookId;
    if (status) where.status = status;

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.webhookDelivery.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.webhookDelivery.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: '',
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error('[WEBHOOK_DELIVERIES:LIST] —', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhook deliveries' }, meta: { requestId: '' } },
      { status: 500 },
    );
  }
}
