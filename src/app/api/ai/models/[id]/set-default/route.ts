'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requireFeatureAllowStaff, isPlatformStaff } from '@/lib/platform/platform-auth';

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
// POST — set as default model for its TYPE (TEXT or IMAGE).
// Clears any other default of the same type across all providers/models,
// so there is exactly one default TEXT model and one default IMAGE model
// system-wide.
// =====================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  // Client's Own AI API entitlement gate — selecting the default
  // model of a connected provider is provider-connection management.
  // Platform staff always pass.
  const featureAuth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const { id: modelId } = await params;

    const model = await db.aiModel.findUnique({ where: { id: modelId } });
    if (!model) return err('Model not found', 404, 'NOT_FOUND');

    // Row-level ownership: non-staff callers may only manage models of
    // their own provider connections.
    const ownerCheck = await db.aiProvider.findUnique({ where: { id: model.providerId }, select: { createdById: true } });
    if (!isPlatformStaff(featureAuth.user) && ownerCheck?.createdById !== featureAuth.user.id) {
      return err('You can only manage models of your own AI provider connections.', 403, 'FORBIDDEN');
    }

    if (!model.isActive) {
      return err('Cannot set an inactive model as default. Please activate it first.', 400, 'INACTIVE');
    }

    const modelType = model.type?.toUpperCase() === 'IMAGE' ? 'IMAGE' : 'TEXT';

    // Atomically: clear other defaults of the same TYPE, then set this one.
    // The default flag is scoped per owner for non-staff callers so a
    // client's default never unsets the platform's (or another client's).
    const unsetWhere: Record<string, unknown> = { type: modelType, isDefault: true, id: { not: modelId } };
    if (!isPlatformStaff(featureAuth.user)) unsetWhere.provider = { createdById: featureAuth.user.id };
    await db.$transaction([
      db.aiModel.updateMany({
        where: unsetWhere,
        data: { isDefault: false },
      }),
      db.aiModel.update({ where: { id: modelId }, data: { isDefault: true } }),
    ]);

    return ok({ isDefault: true, type: modelType });
  } catch (error) {
    console.error(`[AI/MODELS:SET_DEFAULT] ${id} —`, error);
    return err('Failed to set default model', 500, 'INTERNAL_ERROR');
  }
}
