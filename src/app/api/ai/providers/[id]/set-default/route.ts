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
// POST — set as default
// =====================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: providerId } = await params;

    const provider = await db.aiProvider.findUnique({ where: { id: providerId } });
    if (!provider) return err('Provider not found', 404, 'NOT_FOUND');

    // Unset all others
    await db.aiProvider.updateMany({ where: { isDefault: true }, data: { isDefault: false } });

    // Set this one as default
    await db.aiProvider.update({ where: { id: providerId }, data: { isDefault: true } });

    return ok({ isDefault: true });
  } catch (error) {
    console.error(`[AI/PROVIDERS:SET_DEFAULT] ${id} —`, error);
    return err('Failed to set default provider', 500, 'INTERNAL_ERROR');
  }
}
