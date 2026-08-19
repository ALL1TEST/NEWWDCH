'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getUsageAnalytics } from '@/lib/ai/ai-service';
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
// GET — usage analytics summary
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const period = (sp.get('period') as 'day' | 'week' | 'month') || 'month';
    const siteId = sp.get('siteId')?.trim() || undefined;

    const analytics = await getUsageAnalytics(siteId, period);
    return ok(analytics);
  } catch (error) {
    console.error(`[AI/USAGE:SUMMARY] ${id} —`, error);
    return err('Failed to fetch usage analytics', 500, 'INTERNAL_ERROR');
  }
}
