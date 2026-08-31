'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt, decrypt, maskSecret } from '@/lib/encryption';
import { z } from 'zod/v4';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requireFeatureAllowStaff } from '@/lib/platform/platform-auth';

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
 kind: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'GROQ', 'DEEPSEEK', 'CUSTOM']).optional(),
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

  // Client's Own AI API entitlement gate — updating a provider
  // connection (including its API key) requires the feature. Platform
  // staff always pass.
  const featureAuth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in featureAuth) return featureAuth.response;

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

    // CUSTOM providers require a Base URL. Validate if kind is changing to CUSTOM
    // or if baseUrl is being updated on an existing CUSTOM provider.
    const effectiveKind = (d.kind ?? existing.kind) as string;
    if (effectiveKind === 'CUSTOM') {
      const effectiveBaseUrl = d.baseUrl !== undefined ? (d.baseUrl === '' ? null : d.baseUrl) : existing.baseUrl;
      if (!effectiveBaseUrl || effectiveBaseUrl.trim() === '') {
        return err('Base URL is required for Custom providers', 400, 'BASE_URL_REQUIRED');
      }
      try {
        const u = new URL(effectiveBaseUrl);
        if (!['http:', 'https:'].includes(u.protocol)) {
          return err('Base URL must use http or https protocol', 400, 'INVALID_URL');
        }
      } catch {
        return err('Base URL is not a valid URL', 400, 'INVALID_URL');
      }
    }

    // If apiKey provided, re-encrypt
    if (d.apiKey !== undefined && d.apiKey !== '') {
      data.apiKeyEncrypted = await encrypt(d.apiKey);
    }

    const item = await db.aiProvider.update({ where: { id: providerId }, data });

    // Strip apiKeyEncrypted from the response — never send ciphertext to client
    const { apiKeyEncrypted: _stripped, ...safeItem } = item;
    let maskedKey: string | null = null;
    if (existing.apiKeyEncrypted) {
      try {
        const raw = await decrypt(existing.apiKeyEncrypted);
        maskedKey = maskSecret(raw);
      } catch {
        maskedKey = '••••••••';
      }
    }
    return ok({ ...safeItem, apiKeyMasked: maskedKey });
  } catch (error) {
    console.error(`[AI/PROVIDERS:UPDATE] ${id} —`, error);
    return err('Failed to update provider', 500, 'INTERNAL_ERROR');
  }
}

// =====================================================================
// DELETE — hard delete
// Handles FK constraints: nullifies PromptTemplate.providerId/modelId,
// nullifies AiLog.providerId, deletes AiJob references, clears AiSettings
// references, then deletes models + fallbacks + the provider.
// =====================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = reqId();

  // Client's Own AI API entitlement gate — removing a provider
  // connection requires the feature. Platform staff always pass.
  const featureAuth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const { id: providerId } = await params;

    const existing = await db.aiProvider.findUnique({ where: { id: providerId } });
    if (!existing) return err('Provider not found', 404, 'NOT_FOUND');

    // Collect model IDs belonging to this provider (for clearing prompt/log references)
    const modelIds = await db.aiModel.findMany({ where: { providerId }, select: { id: true } });
    const modelIdList = modelIds.map((m) => m.id);

    // Clear all FK references that would block deletion (no cascade on these relations)
    await db.$transaction([
      // Nullify prompt references to this provider or its models
      db.promptTemplate.updateMany({ where: { providerId }, data: { providerId: null, modelId: null } }),
      db.promptTemplate.updateMany({ where: { modelId: { in: modelIdList } }, data: { modelId: null } }),
      // Nullify log references
      db.aiLog.updateMany({ where: { providerId }, data: { providerId: null } }),
      db.aiLog.updateMany({ where: { modelId: { in: modelIdList } }, data: { modelId: null } }),
      // Clear AI Settings references
      db.aiSettings.updateMany({ where: { defaultProviderId: providerId }, data: { defaultProviderId: null, defaultModelId: null } }),
      db.aiSettings.updateMany({ where: { imageProviderId: providerId }, data: { imageProviderId: null, imageModelId: null } }),
      // Delete jobs that reference this provider (jobs require a provider)
      db.aiJob.deleteMany({ where: { providerId } }),
      // Delete fallbacks (both directions)
      db.aiProviderFallback.deleteMany({ where: { providerId } }),
      db.aiProviderFallback.deleteMany({ where: { fallbackId: providerId } }),
      // Delete models
      db.aiModel.deleteMany({ where: { providerId } }),
    ]);

    // Finally delete the provider
    await db.aiProvider.delete({ where: { id: providerId } });
    return ok({ deleted: true });
  } catch (error) {
    console.error(`[AI/PROVIDERS:DELETE] ${id} —`, error);
    return err('Failed to delete provider. It may still be referenced by other records.', 500, 'INTERNAL_ERROR');
  }
}
