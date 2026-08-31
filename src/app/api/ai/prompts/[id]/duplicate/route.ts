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

// ---------- serialization helpers (must match prompts/route.ts) ------

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string');
      return raw.split(',').map((t) => t.trim()).filter(Boolean);
    } catch {
      return raw.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseVariables(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      // fallthrough
    }
  }
  return null;
}

function serializePrompt<T extends Record<string, unknown>>(item: T): T {
  if (!item) return item;
  return {
    ...item,
    tags: parseTags(item.tags),
    variables: parseVariables(item.variables),
  } as T;
}

// =====================================================================
// POST — duplicate a prompt
// =====================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;

  try {
    const { id: promptId } = await params;

    const existing = await db.promptTemplate.findUnique({ where: { id: promptId } });
    if (!existing) return err('Prompt not found', 404, 'NOT_FOUND');

    // Validate the provider/model still exist + are active (same rules as PATCH)
    if (existing.providerId) {
      const provider = await db.aiProvider.findUnique({ where: { id: existing.providerId } });
      if (!provider || !provider.isActive) {
        // Drop the references — duplicated prompt will use defaults instead
        existing.providerId = null;
        existing.modelId = null;
      } else if (existing.modelId) {
        const model = await db.aiModel.findUnique({ where: { id: existing.modelId } });
        if (!model || !model.isActive || model.providerId !== existing.providerId) {
          existing.modelId = null;
        }
      }
    }

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
        usageCount: 0, // reset — duplicated prompt has never been used
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
      include: {
        provider: { select: { id: true, name: true, kind: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { versions: true } },
      },
    });

    return NextResponse.json(
      { data: serializePrompt(item as unknown as Record<string, unknown>), meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 201 },
    );
  } catch (error) {
    console.error(`[AI/PROMPTS:DUPLICATE] ${id} —`, error);
    return err('Failed to duplicate prompt', 500, 'INTERNAL_ERROR');
  }
}
