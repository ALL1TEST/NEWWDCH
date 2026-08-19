// ============================================================
// GET  /api/audit-logs      — List audit logs (paginated, filterable)
// Read-only (no POST/PATCH/DELETE)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const listIncludes = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'action', 'resourceType', 'userId']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const userId = sp.get('userId') || undefined;
    const action = sp.get('action') || undefined;
    const resourceType = sp.get('resourceType') || undefined;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[AUDIT_LOGS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit logs' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
