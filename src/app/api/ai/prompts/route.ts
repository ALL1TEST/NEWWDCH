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

const CATEGORIES = ['CONTENT_GENERATION', 'IMAGE_GENERATION', 'SEO', 'TRANSLATION', 'SUMMARIZATION', 'MARKETING', 'SOCIAL_MEDIA', 'EMAIL', 'CODING', 'ANALYSIS', 'CUSTOM'] as const;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  category: z.enum(CATEGORIES),
  description: z.string().max(2000).optional().or(z.literal('')),
  tags: z.string().max(2000).optional().or(z.literal('')),
  variables: z.string().max(10000).optional().or(z.literal('')),
  systemPrompt: z.string().max(50000).optional().or(z.literal('')),
  userPrompt: z.string().max(50000).optional().or(z.literal('')),
  providerId: z.string().optional().or(z.literal('')),
  modelId: z.string().optional().or(z.literal('')),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(100000).optional(),
  siteId: z.string().optional().or(z.literal('')),
});

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'category', 'isActive', 'isFavorite', 'usageCount', 'version']);

// =====================================================================
// GET — list prompts
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

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

    const where: Record<string, unknown> = {};
    if (search) where.name = { contains: search };
    if (category) where.category = category;
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

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
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

    const item = await db.promptTemplate.create({
      data: {
        name: d.name,
        category: d.category,
        description: d.description === '' ? null : d.description ?? null,
        tags: d.tags === '' ? null : d.tags ?? null,
        variables: d.variables === '' ? null : d.variables ?? null,
        systemPrompt: d.systemPrompt === '' ? null : d.systemPrompt ?? null,
        userPrompt: d.userPrompt === '' ? null : d.userPrompt ?? null,
        providerId: d.providerId === '' ? null : d.providerId ?? null,
        modelId: d.modelId === '' ? null : d.modelId ?? null,
        temperature: d.temperature,
        maxTokens: d.maxTokens,
        siteId: d.siteId === '' ? null : d.siteId ?? null,
        version: 1,
        createdById: 'system',
        versions: {
          create: {
            version: 1,
            systemPrompt: d.systemPrompt === '' ? null : d.systemPrompt ?? null,
            userPrompt: d.userPrompt === '' ? null : d.userPrompt ?? null,
            variables: d.variables === '' ? null : d.variables ?? null,
            temperature: d.temperature,
            maxTokens: d.maxTokens,
            createdById: 'system',
          },
        },
      },
    });

    return ok(item, { _status: 201 });
  } catch (error) {
    console.error(`[AI/PROMPTS:CREATE] ${id} —`, error);
    return err('Failed to create prompt', 500, 'INTERNAL_ERROR');
  }
}
