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

const upsertSchema = z.object({
  defaultProviderId: z.string().optional().or(z.literal('')),
  defaultModelId: z.string().optional().or(z.literal('')),
  defaultTemperature: z.number().min(0).max(2).optional(),
  defaultMaxTokens: z.number().int().positive().max(100000).optional(),
  streamingEnabled: z.boolean().optional(),
  jsonModeEnabled: z.boolean().optional(),
  functionCallingEnabled: z.boolean().optional(),
  imageModelId: z.string().optional().or(z.literal('')),
  embeddingModelId: z.string().optional().or(z.literal('')),
  monthlyBudgetUsd: z.number().min(0).optional(),
  warningThreshold: z.number().min(0).max(100).optional(),
  stopOnBudget: z.boolean().optional(),
  requestsPerMinute: z.number().int().positive().optional(),
  tokensPerDay: z.number().int().positive().optional(),
  config: z.string().max(50000).optional().or(z.literal('')),
});

// =====================================================================
// GET — get settings for scope
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const scope = sp.get('scope')?.trim() || 'global';

    const item = await db.aiSettings.findUnique({ where: { scope } });
    return ok(item);
  } catch (error) {
    console.error(`[AI/SETTINGS:GET] ${id} —`, error);
    return err('Failed to fetch AI settings', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// POST — upsert settings
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

    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const scope = (body as Record<string, unknown>).scope as string | undefined || 'global';

    const data: Record<string, unknown> = {
      defaultProviderId: d.defaultProviderId === '' ? null : d.defaultProviderId ?? undefined,
      defaultModelId: d.defaultModelId === '' ? null : d.defaultModelId ?? undefined,
      imageModelId: d.imageModelId === '' ? null : d.imageModelId ?? undefined,
      embeddingModelId: d.embeddingModelId === '' ? null : d.embeddingModelId ?? undefined,
      config: d.config === '' ? null : d.config ?? undefined,
    };
    if (d.defaultTemperature !== undefined) data.defaultTemperature = d.defaultTemperature;
    if (d.defaultMaxTokens !== undefined) data.defaultMaxTokens = d.defaultMaxTokens;
    if (d.streamingEnabled !== undefined) data.streamingEnabled = d.streamingEnabled;
    if (d.jsonModeEnabled !== undefined) data.jsonModeEnabled = d.jsonModeEnabled;
    if (d.functionCallingEnabled !== undefined) data.functionCallingEnabled = d.functionCallingEnabled;
    if (d.monthlyBudgetUsd !== undefined) data.monthlyBudgetUsd = d.monthlyBudgetUsd;
    if (d.warningThreshold !== undefined) data.warningThreshold = d.warningThreshold;
    if (d.stopOnBudget !== undefined) data.stopOnBudget = d.stopOnBudget;
    if (d.requestsPerMinute !== undefined) data.requestsPerMinute = d.requestsPerMinute;
    if (d.tokensPerDay !== undefined) data.tokensPerDay = d.tokensPerDay;

    const item = await db.aiSettings.upsert({
      where: { scope },
      update: data,
      create: { scope, ...data },
    });

    return ok(item);
  } catch (error) {
    console.error(`[AI/SETTINGS:UPSERT] ${id} —`, error);
    return err('Failed to save AI settings', 500, 'INTERNAL_ERROR');
  }
}
