'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ApiResponse, ApiError } from '@/shared/types';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + crypto.randomUUID().slice(0, 8);
}

function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, meta: { requestId: reqId(), timestamp: new Date().toISOString(), ...meta } } satisfies ApiResponse<T>);
}

function err(message: string, status = 400, code = 'VALIDATION_ERROR') {
  return NextResponse.json({ error: { code, message }, meta: { requestId: reqId(), timestamp: new Date().toISOString() } } satisfies ApiError, { status });
}

// =====================================================================
// POST — retry a failed job
// =====================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: jobId } = await params;

    const job = await db.aiJob.findUnique({ where: { id: jobId } });
    if (!job) return err('Job not found', 404, 'NOT_FOUND');

    if (job.status !== 'FAILED') {
      return err('Only failed jobs can be retried', 400, 'INVALID_STATUS');
    }

    const item = await db.aiJob.update({
      where: { id: jobId },
      data: {
        status: 'RETRYING',
        retryCount: job.retryCount + 1,
        error: null,
        finishedAt: null,
      },
    });

    return ok(item);
  } catch (error) {
    console.error(`[AI/JOBS:RETRY] ${id} —`, error);
    return err('Failed to retry job', 500, 'INTERNAL_ERROR');
  }
}
