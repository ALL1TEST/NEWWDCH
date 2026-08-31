'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requireAuth } from '@/lib/platform/platform-auth';

// Prompt library management — any authenticated CMS user (same rule
// as /api/ai/prompts; the Prompt Library is not exposed as a tab in
// Platform Admin, but the backend functionality is kept).

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
// POST — toggle favorite
// =====================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;

  try {
    const { id: promptId } = await params;

    const existing = await db.promptTemplate.findUnique({
      where: { id: promptId },
      select: { id: true, isFavorite: true },
    });

    if (!existing) return err('Prompt not found', 404, 'NOT_FOUND');

    const item = await db.promptTemplate.update({
      where: { id: promptId },
      data: { isFavorite: !existing.isFavorite },
    });

    return ok({ isFavorite: item.isFavorite });
  } catch (error) {
    console.error(`[AI/PROMPTS:FAVORITE] ${id} —`, error);
    return err('Failed to toggle favorite', 500, 'INTERNAL_ERROR');
  }
}
