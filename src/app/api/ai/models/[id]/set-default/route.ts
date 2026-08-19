'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
// POST — set as default model for its provider
// =====================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: modelId } = await params;

    const model = await db.aiModel.findUnique({ where: { id: modelId } });
    if (!model) return err('Model not found', 404, 'NOT_FOUND');

    // Unset all other defaults for the same provider
    await db.aiModel.updateMany({
      where: { providerId: model.providerId, isDefault: true },
      data: { isDefault: false },
    });

    // Set this one as default
    await db.aiModel.update({
      where: { id: modelId },
      data: { isDefault: true },
    });

    return ok({ isDefault: true });
  } catch (error) {
    console.error(`[AI/MODELS:SET_DEFAULT] ${id} —`, error);
    return err('Failed to set default model', 500, 'INTERNAL_ERROR');
  }
}
