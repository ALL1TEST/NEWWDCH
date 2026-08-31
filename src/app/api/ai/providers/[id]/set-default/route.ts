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
// POST — set as default provider (clears all other defaults)
// =====================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  // Client's Own AI API entitlement gate — selecting the default
  // provider connection requires the feature. Platform staff always
  // pass.
  const featureAuth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const { id: providerId } = await params;

    const provider = await db.aiProvider.findUnique({ where: { id: providerId } });
    if (!provider) return err('Provider not found', 404, 'NOT_FOUND');

    // Row-level ownership: non-staff callers may only manage their own
    // provider connections.
    if (!isPlatformStaff(featureAuth.user) && provider.createdById !== featureAuth.user.id) {
      return err('You can only manage your own AI provider connections.', 403, 'FORBIDDEN');
    }

    if (!provider.isActive) {
      return err('Cannot set an inactive provider as default. Please activate it first.', 400, 'INACTIVE');
    }

    // Atomically: clear other defaults, then set this one. The default
    // flag is scoped per owner — a non-staff caller's default never
    // unsets the platform's (or another client's) default, so the two
    // AI experiences stay strictly separated.
    const unsetWhere: Record<string, unknown> = { isDefault: true, id: { not: providerId } };
    if (!isPlatformStaff(featureAuth.user)) unsetWhere.createdById = featureAuth.user.id;
    await db.$transaction([
      db.aiProvider.updateMany({ where: unsetWhere, data: { isDefault: false } }),
      db.aiProvider.update({ where: { id: providerId }, data: { isDefault: true } }),
    ]);

    return ok({ isDefault: true });
  } catch (error) {
    console.error(`[AI/PROVIDERS:SET_DEFAULT] ${id} —`, error);
    return err('Failed to set default provider', 500, 'INTERNAL_ERROR');
  }
}
