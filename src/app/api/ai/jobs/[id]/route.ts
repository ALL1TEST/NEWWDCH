'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requireFeature } from '@/lib/platform/platform-auth';

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

const updateSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED']).optional(),
  title: z.string().min(1).max(500).optional(),
});

// =====================================================================
// GET — single job with logs
// =====================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFeature(request, 'ai_content');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    const { id: jobId } = await params;

    const item = await db.aiJob.findUnique({
      where: { id: jobId },
      include: {
        provider: { select: { id: true, name: true, kind: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!item) return err('Job not found', 404, 'NOT_FOUND');
    return ok(item);
  } catch (error) {
    console.error(`[AI/JOBS:GET] ${id} —`, error);
    return err('Failed to fetch job', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// PATCH — update job (status, cancel)
// =====================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFeature(request, 'ai_content');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    const { id: jobId } = await params;

    const existing = await db.aiJob.findUnique({ where: { id: jobId } });
    if (!existing) return err('Job not found', 404, 'NOT_FOUND');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err('Request body must be valid JSON');
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const data: Record<string, unknown> = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.status !== undefined) {
      data.status = d.status;
      if (d.status === 'CANCELLED' || d.status === 'COMPLETED' || d.status === 'FAILED') {
        data.finishedAt = new Date();
      }
    }

    const item = await db.aiJob.update({ where: { id: jobId }, data });
    return ok(item);
  } catch (error) {
    console.error(`[AI/JOBS:UPDATE] ${id} —`, error);
    return err('Failed to update job', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// DELETE — delete job
// =====================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFeature(request, 'ai_content');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    const { id: jobId } = await params;

    const existing = await db.aiJob.findUnique({ where: { id: jobId } });
    if (!existing) return err('Job not found', 404, 'NOT_FOUND');

    await db.aiJob.delete({ where: { id: jobId } });
    return ok({ deleted: true });
  } catch (error) {
    console.error(`[AI/JOBS:DELETE] ${id} —`, error);
    return err('Failed to delete job', 500, 'INTERNAL_ERROR');
  }
}
