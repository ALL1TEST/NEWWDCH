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
  name: z.string().min(1).max(200).trim().optional(),
  category: z.enum(['CONTENT_GENERATION', 'IMAGE_GENERATION', 'SEO', 'TRANSLATION', 'SUMMARIZATION', 'MARKETING', 'SOCIAL_MEDIA', 'EMAIL', 'CODING', 'ANALYSIS', 'CUSTOM']).optional(),
  description: z.string().max(2000).optional().or(z.literal('')),
  tags: z.string().max(2000).optional().or(z.literal('')),
  variables: z.string().max(10000).optional().or(z.literal('')),
  systemPrompt: z.string().max(50000).optional().or(z.literal('')),
  userPrompt: z.string().max(50000).optional().or(z.literal('')),
  providerId: z.string().optional().or(z.literal('')),
  modelId: z.string().optional().or(z.literal('')),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(100000).optional(),
  isActive: z.boolean().optional(),
  isShared: z.boolean().optional(),
});

// =====================================================================
// GET — single prompt with versions count
// =====================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: promptId } = await params;

    const item = await db.promptTemplate.findUnique({
      where: { id: promptId },
      include: {
        provider: { select: { id: true, name: true, kind: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { versions: true } },
      },
    });

    if (!item) return err('Prompt not found', 404, 'NOT_FOUND');
    return ok(item);
  } catch (error) {
    console.error(`[AI/PROMPTS:GET] ${id} —`, error);
    return err('Failed to fetch prompt', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// PATCH — update prompt (create version if content changed)
// =====================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: promptId } = await params;

    const existing = await db.promptTemplate.findUnique({ where: { id: promptId } });
    if (!existing) return err('Prompt not found', 404, 'NOT_FOUND');

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
    if (d.category !== undefined) data.category = d.category;
    if (d.description !== undefined) data.description = d.description === '' ? null : d.description;
    if (d.tags !== undefined) data.tags = d.tags === '' ? null : d.tags;
    if (d.variables !== undefined) data.variables = d.variables === '' ? null : d.variables;
    if (d.providerId !== undefined) data.providerId = d.providerId === '' ? null : d.providerId;
    if (d.modelId !== undefined) data.modelId = d.modelId === '' ? null : d.modelId;
    if (d.temperature !== undefined) data.temperature = d.temperature;
    if (d.maxTokens !== undefined) data.maxTokens = d.maxTokens;
    if (d.isActive !== undefined) data.isActive = d.isActive;
    if (d.isShared !== undefined) data.isShared = d.isShared;

    // Check if prompt content changed
    const contentChanged =
      (d.systemPrompt !== undefined && d.systemPrompt !== (existing.systemPrompt || '')) ||
      (d.userPrompt !== undefined && d.userPrompt !== (existing.userPrompt || ''));

    if (d.systemPrompt !== undefined) data.systemPrompt = d.systemPrompt === '' ? null : d.systemPrompt;
    if (d.userPrompt !== undefined) data.userPrompt = d.userPrompt === '' ? null : d.userPrompt;

    // If content changed, create a new version
    if (contentChanged) {
      const newVersion = existing.version + 1;
      data.version = newVersion;

      await db.promptTemplateVersion.create({
        data: {
          templateId: promptId,
          version: newVersion,
          systemPrompt: data.systemPrompt as string | null ?? existing.systemPrompt,
          userPrompt: data.userPrompt as string | null ?? existing.userPrompt,
          variables: data.variables as string | null ?? existing.variables,
          temperature: (data.temperature as number | undefined) ?? existing.temperature,
          maxTokens: (data.maxTokens as number | undefined) ?? existing.maxTokens,
          createdById: existing.createdById,
        },
      });
    }

    const item = await db.promptTemplate.update({
      where: { id: promptId },
      data,
    });

    return ok(item);
  } catch (error) {
    console.error(`[AI/PROMPTS:UPDATE] ${id} —`, error);
    return err('Failed to update prompt', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// DELETE — delete prompt
// =====================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: promptId } = await params;

    const existing = await db.promptTemplate.findUnique({ where: { id: promptId } });
    if (!existing) return err('Prompt not found', 404, 'NOT_FOUND');

    await db.promptTemplate.delete({ where: { id: promptId } });
    return ok({ deleted: true });
  } catch (error) {
    console.error(`[AI/PROMPTS:DELETE] ${id} —`, error);
    return err('Failed to delete prompt', 500, 'INTERNAL_ERROR');
  }
}
