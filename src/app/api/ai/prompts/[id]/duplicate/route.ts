'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

// =====================================================================
// POST — duplicate a prompt
// =====================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: promptId } = await params;

    const existing = await db.promptTemplate.findUnique({ where: { id: promptId } });
    if (!existing) return err('Prompt not found', 404, 'NOT_FOUND');

    const item = await db.promptTemplate.create({
      data: {
        name: existing.name + ' (Copy)',
        category: existing.category,
        description: existing.description,
        tags: existing.tags,
        variables: existing.variables,
        systemPrompt: existing.systemPrompt,
        userPrompt: existing.userPrompt,
        providerId: existing.providerId,
        modelId: existing.modelId,
        temperature: existing.temperature,
        maxTokens: existing.maxTokens,
        version: 1,
        isActive: true,
        isFavorite: false,
        isShared: existing.isShared,
        siteId: existing.siteId,
        createdById: existing.createdById,
        versions: {
          create: {
            version: 1,
            systemPrompt: existing.systemPrompt,
            userPrompt: existing.userPrompt,
            variables: existing.variables,
            temperature: existing.temperature,
            maxTokens: existing.maxTokens,
            createdById: existing.createdById,
          },
        },
      },
    });

    return ok(item, { _status: 201 });
  } catch (error) {
    console.error(`[AI/PROMPTS:DUPLICATE] ${id} —`, error);
    return err('Failed to duplicate prompt', 500, 'INTERNAL_ERROR');
  }
}
