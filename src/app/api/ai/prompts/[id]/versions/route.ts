'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';

// Platform Admin ONLY — prompt library management (internal platform
// configuration, never exposed to clients).

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
// GET — list versions for a prompt
// =====================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  const staffAuth = await requirePlatformAdmin(request);
  if ('response' in staffAuth) return staffAuth.response;

  try {
    const { id: promptId } = await params;

    const items = await db.promptTemplateVersion.findMany({
      where: { templateId: promptId },
      orderBy: { version: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return ok(items);
  } catch (error) {
    console.error(`[AI/PROMPTS:VERSIONS] ${id} —`, error);
    return err('Failed to fetch versions', 500, 'INTERNAL_ERROR');
  }
}
