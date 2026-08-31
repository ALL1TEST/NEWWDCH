'use server';

import { NextRequest, NextResponse } from 'next/server';
import { executeChat } from '@/lib/ai/ai-service';
import type { ChatMessage } from '@/lib/ai/ai-service';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';

// ============================================================
// AI PLAYGROUND — Platform Admin ONLY.
// The raw chat playground is a provider-testing tool for the
// platform staff who configure the AI infrastructure. It is NOT a
// client AI tool (the client AI experience is the AI Tools
// workspace) and is unreachable in the client navigation.
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

// ---------- validation ------------------------------------------------

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
});

const playgroundSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  modelId: z.string().optional(),
  messages: z.array(messageSchema).min(1, 'At least one message is required'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(100000).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  jsonMode: z.boolean().optional(),
  siteId: z.string().optional(),
});

// =====================================================================
// POST — execute chat completion
// =====================================================================

export async function POST(request: NextRequest) {
  // Platform staff only — internal provider testing tool.
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err('Request body must be valid JSON');
    }

    const parsed = playgroundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const d = parsed.data;

    // Pre-validate the provider exists + is active
    const provider = await db.aiProvider.findUnique({ where: { id: d.providerId } });
    if (!provider) return err('Provider not found', 404, 'NOT_FOUND');
    if (!provider.isActive) return err('Provider is disabled. Please activate it first.', 400, 'PROVIDER_INACTIVE');
    if (!provider.apiKeyEncrypted) return err('API key not configured for this provider.', 400, 'NO_API_KEY');

    // Pre-validate the model is a TEXT-type model belonging to this provider
    if (d.modelId) {
      const model = await db.aiModel.findUnique({ where: { id: d.modelId } });
      if (!model) return err('Selected model not found', 404, 'NOT_FOUND');
      if (model.providerId !== d.providerId) {
        return err('The selected model does not belong to the selected provider', 400, 'MODEL_PROVIDER_MISMATCH');
      }
      if (!model.isActive) return err('Selected model is inactive', 400, 'MODEL_INACTIVE');
      if (model.type?.toUpperCase() !== 'TEXT') {
        return err('The selected model is not a text model. Please select a TEXT-type model for chat.', 400, 'MODEL_TYPE_MISMATCH');
      }
    }

    const result = await executeChat({
      providerId: d.providerId,
      modelId: d.modelId,
      messages: d.messages as ChatMessage[],
      temperature: d.temperature,
      maxTokens: d.maxTokens,
      topP: d.topP,
      frequencyPenalty: d.frequencyPenalty,
      presencePenalty: d.presencePenalty,
      jsonMode: d.jsonMode,
      siteId: d.siteId,
      // Attribute the usage to the user for the Platform AI monthly
      // usage tracker (AiLog).
      userId: auth.user.id,
    });

    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chat execution failed';
    console.error(`[AI/PLAYGROUND] ${id} —`, error);
    // Validation errors from the service are user errors (400), upstream API errors are 502
    const isUserError = /inactive|not found|does not belong|does not support|not an image|not a text|No active/i.test(msg);
    return err(msg, isUserError ? 400 : 502, isUserError ? 'VALIDATION_ERROR' : 'CHAT_ERROR');
  }
}

