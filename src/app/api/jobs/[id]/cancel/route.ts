// ============================================================
// POST /api/jobs/[id]/cancel — Cancel a job
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// POST — cancel
// =====================================================================

export async function POST(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: jobId } = await context.params;

    const job = await db.queueJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Job not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: `Cannot cancel a job with status ${job.status}` }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    const updated = await db.queueJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[JOBS:CANCEL] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel job' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
