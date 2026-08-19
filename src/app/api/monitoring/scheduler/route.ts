// ============================================================
// GET /api/monitoring/scheduler — Scheduler log entries
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const SORTABLE = new Set(['createdAt', 'updatedAt', 'jobName', 'status', 'nextRunAt', 'lastRunAt']);

function computeStatus(entry: {
  status: string;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastError: string | null;
}): string {
  const now = new Date();
  if (entry.status === 'DISABLED') return 'DISABLED';
  if (entry.status === 'RUNNING') return 'RUNNING';
  if (entry.status === 'FAILED' && entry.lastError) return 'FAILED';
  if (entry.status === 'RETRYING') return 'RETRYING';
  if (entry.nextRunAt && entry.nextRunAt < now) return 'OVERDUE';
  if (entry.status === 'ENABLED') return 'ENABLED';
  return entry.status;
}

// =====================================================================
// GET — list scheduler logs
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'jobName';
    const order = sp.get('order') === 'desc' ? 'desc' : 'asc';
    const status = sp.get('status') || undefined;
    const siteId = sp.get('siteId') || undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (siteId) where.siteId = siteId;

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.schedulerLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.schedulerLog.count({ where }),
    ]);

    // Compute derived status
    const enriched = items.map((item) => ({
      ...item,
      computedStatus: computeStatus(item),
    }));

    return NextResponse.json({
      data: enriched,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[MONITORING:SCHEDULER:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch scheduler logs' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
