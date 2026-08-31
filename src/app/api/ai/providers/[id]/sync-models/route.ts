'use server';

import { NextRequest, NextResponse } from 'next/server';
import { syncModels } from '@/lib/ai/ai-service';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requireFeatureAllowStaff, isPlatformStaff } from '@/lib/platform/platform-auth';
import { db } from '@/lib/db';

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

  // Client's Own AI API entitlement gate — syncing a provider's
  // models queries the client's own AI API. Platform staff always
  // pass.
  const featureAuth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const { id: providerId } = await params;

    // Row-level ownership: non-staff callers may only sync their own
    // provider connections.
    const provider = await db.aiProvider.findUnique({ where: { id: providerId }, select: { id: true, createdById: true } });
    if (!provider) return err('Provider not found', 404, 'NOT_FOUND');
    if (!isPlatformStaff(featureAuth.user) && provider.createdById !== featureAuth.user.id) {
      return err('You can only manage your own AI provider connections.', 403, 'FORBIDDEN');
    }

    const count = await syncModels(providerId);
    return ok({ syncedCount: count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Sync failed';
    console.error(`[AI/PROVIDERS:SYNC_MODELS] ${id} —`, error);
    return err(msg, 500, 'SYNC_ERROR');
  }
}
