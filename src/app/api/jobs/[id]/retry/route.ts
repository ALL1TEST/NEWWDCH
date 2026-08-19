// ============================================================
// POST /api/jobs/[id]/retry — Retry a failed job
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
// POST — retry
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

    const updated = await db.queueJob.update({
      where: { id: jobId },
      data: {
        status: 'WAITING',
        attempts: job.attempts + 1,
        error: null,
        runAt: new Date(),
        startedAt: null,
        completedAt: null,
      },
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[JOBS:RETRY] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to retry job' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
