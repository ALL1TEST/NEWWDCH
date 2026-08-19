// ============================================================
// GET /api/jobs/stats — Job counts grouped by status
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// =====================================================================
// GET — stats
// =====================================================================

export async function GET(_request: NextRequest) {
  const id = reqId();

  try {
    const [waiting, active, completed, failed, retrying, cancelled] = await Promise.all([
      db.queueJob.count({ where: { status: 'WAITING' } }),
      db.queueJob.count({ where: { status: 'ACTIVE' } }),
      db.queueJob.count({ where: { status: 'COMPLETED' } }),
      db.queueJob.count({ where: { status: 'FAILED' } }),
      db.queueJob.count({ where: { status: 'RETRYING' } }),
      db.queueJob.count({ where: { status: 'CANCELLED' } }),
    ]);

    return NextResponse.json({
      data: {
        WAITING: waiting,
        ACTIVE: active,
        COMPLETED: completed,
        FAILED: failed,
        RETRYING: retrying,
        CANCELLED: cancelled,
        total: waiting + active + completed + failed + retrying + cancelled,
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[JOBS:STATS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch job stats' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
