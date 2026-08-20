// GET /api/automations/runs — List all automation runs
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

function reqId() { return 'req_' + nanoid(8); }

export async function GET(request: NextRequest) {
  const id = reqId();
  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const automationId = sp.get('automationId') || undefined;
    const status = sp.get('status') || undefined;

    const where: Record<string, unknown> = {};
    if (automationId) where.automationId = automationId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      db.automationRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { automation: { select: { id: true, name: true } } },
      }),
      db.automationRun.count({ where }),
    ]);

    return NextResponse.json({ data: items, meta: { requestId: id, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
  } catch (error) {
    console.error(`[AUTOMATIONS:RUNS] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch runs' }, meta: { requestId: id } }, { status: 500 });
  }
}
