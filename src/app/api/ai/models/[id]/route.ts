'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
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

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  modelId: z.string().min(1).max(200).optional(),
  providerId: z.string().min(1).optional(),
  type: z.enum(['TEXT', 'IMAGE']).optional(),
  contextLength: z.number().int().positive().optional(),
  inputCostPer1k: z.number().min(0).optional(),
  outputCostPer1k: z.number().min(0).optional(),
  supportsImages: z.boolean().optional(),
  supportsVision: z.boolean().optional(),
  supportsFunctionCalling: z.boolean().optional(),
  supportsJsonMode: z.boolean().optional(),
  supportsStreaming: z.boolean().optional(),
  supportsTools: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

// =====================================================================
// GET — single model
// =====================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: modelId } = await params;

    const item = await db.aiModel.findUnique({
      where: { id: modelId },
      include: { provider: { select: { id: true, name: true, kind: true } } },
    });

    if (!item) return err('Model not found', 404, 'NOT_FOUND');
    return ok(item);
  } catch (error) {
    console.error(`[AI/MODELS:GET] ${id} —`, error);
    return err('Failed to fetch model', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// PATCH — update model
// =====================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: modelId } = await params;

    const existing = await db.aiModel.findUnique({ where: { id: modelId } });
    if (!existing) return err('Model not found', 404, 'NOT_FOUND');

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

    if (d.name !== undefined) data.name = d.name;
    if (d.modelId !== undefined) data.modelId = d.modelId;
    if (d.type !== undefined) data.type = d.type;
    if (d.contextLength !== undefined) data.contextLength = d.contextLength;
    if (d.inputCostPer1k !== undefined) data.inputCostPer1k = d.inputCostPer1k;
    if (d.outputCostPer1k !== undefined) data.outputCostPer1k = d.outputCostPer1k;
    if (d.supportsImages !== undefined) data.supportsImages = d.supportsImages;
    if (d.supportsVision !== undefined) data.supportsVision = d.supportsVision;
    if (d.supportsFunctionCalling !== undefined) data.supportsFunctionCalling = d.supportsFunctionCalling;
    if (d.supportsJsonMode !== undefined) data.supportsJsonMode = d.supportsJsonMode;
    if (d.supportsStreaming !== undefined) data.supportsStreaming = d.supportsStreaming;
    if (d.supportsTools !== undefined) data.supportsTools = d.supportsTools;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    // If providerId is changing, validate the new provider exists + is active
    if (d.providerId !== undefined && d.providerId !== existing.providerId) {
      const newProvider = await db.aiProvider.findUnique({ where: { id: d.providerId } });
      if (!newProvider) return err('Target provider not found', 404, 'NOT_FOUND');
      if (!newProvider.isActive) return err('Cannot move model to an inactive provider', 400, 'PROVIDER_INACTIVE');
      data.providerId = d.providerId;
    }

    // If setting as default, clear other defaults of the same type first.
    // Use the NEW type if type is being changed, otherwise the existing type.
    if (d.isDefault === true) {
      const modelType = (d.type ?? existing.type)?.toUpperCase() === 'IMAGE' ? 'IMAGE' : 'TEXT';
      await db.aiModel.updateMany({
        where: { type: modelType, isDefault: true, id: { not: modelId } },
        data: { isDefault: false },
      });
      data.isDefault = true;
    } else if (d.isDefault === false) {
      data.isDefault = false;
    }

    const item = await db.aiModel.update({
      where: { id: modelId },
      data,
      include: { provider: { select: { id: true, name: true, kind: true } } },
    });

    return ok(item);
  } catch (error) {
    console.error(`[AI/MODELS:UPDATE] ${id} —`, error);
    return err('Failed to update model', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// DELETE — delete model
// =====================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: modelId } = await params;

    const existing = await db.aiModel.findUnique({ where: { id: modelId } });
    if (!existing) return err('Model not found', 404, 'NOT_FOUND');

    await db.aiModel.delete({ where: { id: modelId } });
    return ok({ deleted: true });
  } catch (error) {
    console.error(`[AI/MODELS:DELETE] ${id} —`, error);
    return err('Failed to delete model', 500, 'INTERNAL_ERROR');
  }
}
