'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MARKETPLACE_PACKS } from '@/lib/ai/ai-service';
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

const installSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
  siteId: z.string().optional().or(z.literal('')),
  providerId: z.string().optional().or(z.literal('')),
  modelId: z.string().optional().or(z.literal('')),
});

// =====================================================================
// GET — list marketplace packs
// =====================================================================

export async function GET() {
  const id = reqId();

  try {
    // Seed marketplace packs if they don't exist
    for (const pack of MARKETPLACE_PACKS) {
      await db.aiPromptMarketplace.upsert({
        where: { slug: pack.slug },
        update: { packName: pack.packName, description: pack.description, category: pack.category, prompts: pack.prompts },
        create: { packName: pack.packName, slug: pack.slug, description: pack.description, category: pack.category, prompts: pack.prompts },
      });
    }

    const items = await db.aiPromptMarketplace.findMany({
      where: { isActive: true },
      orderBy: { installCount: 'desc' },
    });

    return ok(items);
  } catch (error) {
    console.error(`[AI/MARKETPLACE:LIST] ${id} —`, error);
    return err('Failed to fetch marketplace packs', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// POST — install a pack
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

    const parsed = installSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const d = parsed.data;

    const pack = await db.aiPromptMarketplace.findUnique({ where: { slug: d.slug } });
    if (!pack) return err('Pack not found', 404, 'NOT_FOUND');

    const promptObjects: Array<{
      name: string;
      category?: string;
      systemPrompt?: string;
      userPrompt: string;
      variables?: string;
    }> = JSON.parse(pack.prompts);

    const createdPrompts = [];
    for (const p of promptObjects) {
      const prompt = await db.promptTemplate.create({
        data: {
          name: p.name,
          category: (p.category as 'CONTENT_GENERATION' | 'SEO' | 'MARKETING' | 'EMAIL' | 'SOCIAL_MEDIA' | 'CUSTOM') || 'CUSTOM',
          systemPrompt: p.systemPrompt || null,
          userPrompt: p.userPrompt,
          variables: p.variables || null,
          version: 1,
          siteId: d.siteId === '' ? null : d.siteId ?? null,
          providerId: d.providerId === '' ? null : d.providerId ?? null,
          modelId: d.modelId === '' ? null : d.modelId ?? null,
          createdById: 'system',
          versions: {
            create: {
              version: 1,
              systemPrompt: p.systemPrompt || null,
              userPrompt: p.userPrompt,
              variables: p.variables || null,
              createdById: 'system',
            },
          },
        },
      });
      createdPrompts.push(prompt);
    }

    // Increment install count
    await db.aiPromptMarketplace.update({
      where: { slug: d.slug },
      data: { installCount: { increment: 1 } },
    });

    return ok({ installedCount: createdPrompts.length, prompts: createdPrompts });
  } catch (error) {
    console.error(`[AI/MARKETPLACE:INSTALL] ${id} —`, error);
    return err('Failed to install pack', 500, 'INTERNAL_ERROR');
  }
}
