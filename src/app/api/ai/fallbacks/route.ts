'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requireFeatureAllowStaff, isPlatformStaff } from '@/lib/platform/platform-auth';

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

// ---------- validation ------------------------------------------------

const addSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  fallbackId: z.string().min(1, 'Fallback ID is required'),
  priority: z.number().int().min(0).default(0),
});

// =====================================================================
// GET — list fallbacks for a providerId
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  // Fallback chains are connection-management data — same gate as the
  // other provider routes, with ownership filtering for non-staff.
  const featureAuth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const sp = new URL(request.url).searchParams;
    const providerId = sp.get('providerId')?.trim();

    if (!providerId) return err('providerId query parameter is required');

    // Row-level ownership: non-staff callers may only read fallbacks of
    // their own provider connections.
    if (!isPlatformStaff(featureAuth.user)) {
      const provider = await db.aiProvider.findUnique({ where: { id: providerId }, select: { createdById: true } });
      if (!provider || provider.createdById !== featureAuth.user.id) {
        return err('You can only access your own AI provider connections.', 403, 'FORBIDDEN');
      }
    }

    const items = await db.aiProviderFallback.findMany({
      where: { providerId },
      orderBy: { priority: 'asc' },
      include: {
        fallback: { select: { id: true, name: true, kind: true, isActive: true, connectionStatus: true } },
      },
    });

    return ok(items);
  } catch (error) {
    console.error(`[AI/FALLBACKS:LIST] ${id} —`, error);
    return err('Failed to fetch fallbacks', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// POST — add fallback
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  // Client's Own AI API entitlement gate — configuring provider
  // fallback chains is provider-connection management. Platform staff
  // always pass.
  const featureAuth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in featureAuth) return featureAuth.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err('Request body must be valid JSON');
    }

    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const d = parsed.data;

    // Prevent self-fallback
    if (d.providerId === d.fallbackId) {
      return err('Provider cannot be its own fallback');
    }

    // Row-level ownership: non-staff callers may only configure
    // fallbacks between their own provider connections.
    if (!isPlatformStaff(featureAuth.user)) {
      const owned = await db.aiProvider.findMany({
        where: { createdById: featureAuth.user.id, id: { in: [d.providerId, d.fallbackId] } },
        select: { id: true },
      });
      if (owned.length < 2) {
        return err('You can only configure fallbacks between your own AI provider connections.', 403, 'FORBIDDEN');
      }
    }

    const item = await db.aiProviderFallback.create({
      data: {
        providerId: d.providerId,
        fallbackId: d.fallbackId,
        priority: d.priority,
      },
      include: {
        fallback: { select: { id: true, name: true, kind: true, isActive: true } },
      },
    });

    return ok(item, { _status: 201 });
  } catch (error) {
    console.error(`[AI/FALLBACKS:ADD] ${id} —`, error);
    return err('Failed to add fallback', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// DELETE — remove fallback
// =====================================================================

export async function DELETE(request: NextRequest) {
  const id = reqId();

  // Client's Own AI API entitlement gate — same rule as POST.
  const featureAuth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const sp = new URL(request.url).searchParams;
    const providerId = sp.get('providerId')?.trim();
    const fallbackId = sp.get('fallbackId')?.trim();

    if (!providerId || !fallbackId) {
      return err('providerId and fallbackId query parameters are required');
    }

    // Find the fallback record
    const existing = await db.aiProviderFallback.findUnique({
      where: { providerId_fallbackId: { providerId, fallbackId } },
    });

    if (!existing) return err('Fallback not found', 404, 'NOT_FOUND');

    // Row-level ownership: non-staff callers may only remove fallbacks
    // between their own provider connections.
    if (!isPlatformStaff(featureAuth.user)) {
      const owned = await db.aiProvider.findMany({
        where: { createdById: featureAuth.user.id, id: { in: [providerId, fallbackId] } },
        select: { id: true },
      });
      if (owned.length < 2) {
        return err('You can only configure fallbacks between your own AI provider connections.', 403, 'FORBIDDEN');
      }
    }

    await db.aiProviderFallback.delete({ where: { id: existing.id } });
    return ok({ deleted: true });
  } catch (error) {
    console.error(`[AI/FALLBACKS:DELETE] ${id} —`, error);
    return err('Failed to remove fallback', 500, 'INTERNAL_ERROR');
  }
}
