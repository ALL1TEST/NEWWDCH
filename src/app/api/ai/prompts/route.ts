'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requireFeatureAllowStaff } from '@/lib/platform/platform-auth';

// ============================================================
// PROMPT LIBRARY.
// The Prompt Library is part of the internal AI system — its
// prompts are used internally by Platform AI (the system
// internally selects the appropriate active prompt when an AI
// tool runs). It is managed from the normal Admin User → AI page
// (Prompt Library tab) and is NOT exposed as a visible page/tab
// in the Platform Admin dashboard.
//
// ENTITLEMENT: the Prompt Library tab lives on the Admin User → AI
// page, which belongs to the plan's "Client's Own AI API" feature
// (ai_client) — NEVER to Platform AI (ai_platform). Platform AI only
// gates the AI generation tools and their AI Articles/month +
// AI Images/month limits. Server-side the gate is
// requireFeatureAllowStaff('ai_client'): platform staff bypass (they
// configure the platform's own AI stack), clients need the plan
// feature — exactly like the Providers/Models routes of the same
// page. The internal Platform AI usage of prompts
// (resolvePlatformPrompt) reads the DB directly and is unaffected.
// ============================================================

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

// ---------- parsing helpers ------------------------------------------
// The Prisma schema stores `tags` and `variables` as JSON strings.
// The frontend expects them as parsed objects/arrays. These helpers
// normalize both the request body (incoming) and the response (outgoing).

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

// ---------- validation ------------------------------------------------

const CATEGORIES = ['CONTENT_GENERATION', 'IMAGE_GENERATION', 'SEO', 'TRANSLATION', 'SUMMARIZATION', 'MARKETING', 'SOCIAL_MEDIA', 'EMAIL', 'CODING', 'ANALYSIS'] as const;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  category: z.enum(CATEGORIES),
  description: z.string().max(2000).optional().or(z.literal('')),
  tags: z.union([z.string().max(2000), z.array(z.string()).max(100)]).optional(),
  variables: z.union([z.string().max(10000), z.record(z.string(), z.unknown())]).optional(),
  systemPrompt: z.string().max(50000).optional().or(z.literal('')),
  userPrompt: z.string().max(50000).optional().or(z.literal('')),
  providerId: z.string().optional().or(z.literal('')),
  modelId: z.string().optional().or(z.literal('')),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(100000).optional(),
  siteId: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'category', 'isActive', 'isFavorite', 'usageCount', 'version']);

// =====================================================================
// GET — list prompts
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  const auth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in auth) return auth.response;

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const search = sp.get('search')?.trim() || '';
    const category = sp.get('category')?.trim();
    const isActive = sp.get('isActive');
    const isFavorite = sp.get('isFavorite');
    const providerId = sp.get('providerId')?.trim();

    const where: Record<string, unknown> = {};
    if (search) where.name = { contains: search };
    if (category) where.category = category;
    if (providerId) where.providerId = providerId;
    if (isActive !== null && isActive !== undefined && isActive !== '') where.isActive = isActive === 'true';
    if (isFavorite !== null && isFavorite !== undefined && isFavorite !== '') where.isFavorite = isFavorite === 'true';

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.promptTemplate.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          provider: { select: { id: true, name: true, kind: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { versions: true } },
        },
      }),
      db.promptTemplate.count({ where }),
    ]);

    const serialized = items.map((item) => serializePrompt(item as unknown as Record<string, unknown>));

    return NextResponse.json({
      data: { data: serialized, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`[AI/PROMPTS:LIST] ${id} —`, error);
    return err('Failed to fetch prompts', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// POST — create prompt with version 1
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  const auth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in auth) return auth.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err('Request body must be valid JSON');
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const d = parsed.data;

    // Attribute the prompt to the authenticated user.
    let creator = await db.user.findUnique({ where: { id: auth.user.id }, select: { id: true } });
    if (!creator) creator = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    if (!creator) creator = await db.user.findFirst({ select: { id: true } });
    if (!creator) return err('No user exists to attribute the prompt to', 500, 'NO_USER');

    // Validate provider/model FK references + relationship
    if (d.providerId && d.providerId !== '') {
      const provider = await db.aiProvider.findUnique({ where: { id: d.providerId } });
      if (!provider) return err('Selected provider not found', 404, 'NOT_FOUND');
      if (!provider.isActive) return err('Cannot use an inactive provider for a prompt', 400, 'PROVIDER_INACTIVE');

      if (d.modelId && d.modelId !== '') {
        const model = await db.aiModel.findUnique({ where: { id: d.modelId } });
        if (!model) return err('Selected model not found', 404, 'NOT_FOUND');
        if (model.providerId !== d.providerId) {
          return err('The selected model does not belong to the selected provider', 400, 'MODEL_PROVIDER_MISMATCH');
        }
        if (!model.isActive) {
          return err('Cannot use an inactive model for a prompt', 400, 'MODEL_INACTIVE');
        }
        // Prompts execute as TEXT (chat) — reject IMAGE-type models
        if (model.type?.toUpperCase() === 'IMAGE') {
          return err('Image models cannot be used for text prompts. Please select a TEXT model.', 400, 'MODEL_TYPE_MISMATCH');
        }
      }
    } else if (d.modelId && d.modelId !== '') {
      // Model without provider — invalid
      return err('A provider must be selected when a model is specified', 400, 'MODEL_WITHOUT_PROVIDER');
    }

    // Serialize tags/variables back to JSON strings for storage
    const tagsJson = Array.isArray(d.tags) ? JSON.stringify(d.tags) : (d.tags ?? null);
    const variablesJson = (typeof d.variables === 'object' && d.variables !== null)
      ? JSON.stringify(d.variables)
      : (typeof d.variables === 'string' && d.variables !== '' ? d.variables : null);

    const item = await db.promptTemplate.create({
      data: {
        name: d.name,
        category: d.category,
        description: d.description === '' ? null : d.description ?? null,
        tags: tagsJson,
        variables: variablesJson,
        systemPrompt: d.systemPrompt === '' ? null : d.systemPrompt ?? null,
        userPrompt: d.userPrompt === '' ? null : d.userPrompt ?? null,
        providerId: d.providerId === '' ? null : d.providerId ?? null,
        modelId: d.modelId === '' ? null : d.modelId ?? null,
        temperature: d.temperature,
        maxTokens: d.maxTokens,
        siteId: d.siteId === '' ? null : d.siteId ?? null,
        isActive: d.isActive ?? true,
        version: 1,
        createdById: creator.id,
        versions: {
          create: {
            version: 1,
            systemPrompt: d.systemPrompt === '' ? null : d.systemPrompt ?? null,
            userPrompt: d.userPrompt === '' ? null : d.userPrompt ?? null,
            variables: variablesJson,
            temperature: d.temperature,
            maxTokens: d.maxTokens,
            createdById: creator.id,
          },
        },
      },
    });

    return ok(serializePrompt(item as unknown as Record<string, unknown>), { _status: 201 });
  } catch (error) {
    console.error(`[AI/PROMPTS:CREATE] ${id} —`, error);
    return err('Failed to create prompt', 500, 'INTERNAL_ERROR');
  }
}
