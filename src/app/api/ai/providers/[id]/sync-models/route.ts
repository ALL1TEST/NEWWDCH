'use server';

import { NextRequest, NextResponse } from 'next/server';
import { syncModels } from '@/lib/ai/ai-service';
import type { ApiResponse, ApiError } from '@/shared/types';

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
// POST — sync models
// =====================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: providerId } = await params;
    const count = await syncModels(providerId);
    return ok({ syncedCount: count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Sync failed';
    console.error(`[AI/PROVIDERS:SYNC_MODELS] ${id} —`, error);
    return err(msg, 500, 'SYNC_ERROR');
  }
}
