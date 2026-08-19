// ============================================================
// GET /api/backups/logs — List backup logs with filters
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const listIncludes = {
  backup: {
    select: { id: true, name: true, filename: true, status: true, scope: true },
  },
  createdBy: { select: { id: true, name: true, email: true } },
  site: { select: { id: true, name: true, slug: true } },
} as const;

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'action', 'status', 'durationMs', 'archiveSize']);

// =====================================================================
// GET — list with filters
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? (sp.get('sort') as string) : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';

    // Filters
    const action = sp.get('action');
    const status = sp.get('status');
    const backupId = sp.get('backupId');
    const startDate = sp.get('startDate');;
    const endDate = sp.get('endDate');
    const search = sp.get('search')?.trim();

    const where: Record<string, unknown> = { ...(await getSiteWhere(request)) };

    if (action) where.action = action;
    if (status) where.status = status;
    if (backupId) where.backupId = backupId;

    // Date range filter
    if (startDate || endDate) {
      const createdAt: Record<string, unknown> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    if (search) {
      where.OR = [
        { errorMessage: { contains: search } },
        { warnings: { contains: search } },
        { verificationResult: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.backupLog.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.backupLog.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[BACKUP_LOGS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch backup logs' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
