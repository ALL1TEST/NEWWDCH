// ============================================================
// POST /api/backups/scheduler — Trigger scheduled backups
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { runScheduledBackups } from '@/lib/backup/backup-service';
import { nanoid } from 'nanoid';

function reqId() { return 'req_' + nanoid(8); }

export async function POST(request: NextRequest) {
  const id = reqId();
  try {
    const results = await runScheduledBackups();
    return NextResponse.json({
      data: { processed: results.length, results },
      meta: { requestId: id, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error(`[BACKUPS:SCHEDULER] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to run scheduled backups' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
