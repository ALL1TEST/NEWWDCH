'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt, decrypt, maskSecret } from '@/lib/encryption';
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
 kind: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'GROQ', 'DEEPSEEK']).optional(),
 baseUrl: z.string().max(2048).optional().or(z.literal('')),
 apiKey: z.string().max(1000).optional().or(z.literal('')),
  apiVersion: z.string().max(100).optional().or(z.literal('')),
  config: z.string().max(50000).optional().or(z.literal('')),
  siteId: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

// =====================================================================
// GET — single provider
// =====================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: providerId } = await params;

    const item = await db.aiProvider.findUnique({
      where: { id: providerId },
      include: {
        models: { select: { id: true, modelId: true, name: true, isActive: true, isDefault: true, supportsVision: true, supportsFunctionCalling: true } },
        jobs: { select: { id: true, status: true } },
        fallbacksFrom: { select: { id: true, fallbackId: true, priority: true } },
      },
    });

    if (!item) return err('Provider not found', 404, 'NOT_FOUND');

    let maskedKey: string | null = null;
    if (item.apiKeyEncrypted) {
      try {
        const raw = await decrypt(item.apiKeyEncrypted);
        maskedKey = maskSecret(raw);
      } catch {
        maskedKey = '••••••••';
      }
    }

    const { apiKeyEncrypted, ...rest } = item;
    return ok({ ...rest, apiKeyMasked: maskedKey });
  } catch (error) {
    console.error(`[AI/PROVIDERS:GET] ${id} —`, error);
    return err('Failed to fetch provider', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: providerId } = await params;

    const existing = await db.aiProvider.findUnique({ where: { id: providerId } });
    if (!existing) return err('Provider not found', 404, 'NOT_FOUND');

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
    if (d.kind !== undefined) data.kind = d.kind;
    if (d.baseUrl !== undefined) data.baseUrl = d.baseUrl === '' ? null : d.baseUrl;
    if (d.apiVersion !== undefined) data.apiVersion = d.apiVersion === '' ? null : d.apiVersion;
    if (d.config !== undefined) data.config = d.config === '' ? null : d.config;
    if (d.siteId !== undefined) data.siteId = d.siteId === '' ? null : d.siteId;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    // If apiKey provided, re-encrypt
    if (d.apiKey !== undefined && d.apiKey !== '') {
      data.apiKeyEncrypted = await encrypt(d.apiKey);
    }

    const item = await db.aiProvider.update({ where: { id: providerId }, data });
    return ok(item);
  } catch (error) {
    console.error(`[AI/PROVIDERS:UPDATE] ${id} —`, error);
    return err('Failed to update provider', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// DELETE — hard delete
// =====================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  try {
    const { id: providerId } = await params;

    const existing = await db.aiProvider.findUnique({ where: { id: providerId } });
    if (!existing) return err('Provider not found', 404, 'NOT_FOUND');

    // Delete models, fallbacks first (cascade should handle it, but be explicit)
    await db.aiModel.deleteMany({ where: { providerId } });
    await db.aiProviderFallback.deleteMany({ where: { providerId } });
    await db.aiProviderFallback.deleteMany({ where: { fallbackId: providerId } });

    await db.aiProvider.delete({ where: { id: providerId } });
    return ok({ deleted: true });
  } catch (error) {
    console.error(`[AI/PROVIDERS:DELETE] ${id} —`, error);
    return err('Failed to delete provider', 500, 'INTERNAL_ERROR');
  }
}
