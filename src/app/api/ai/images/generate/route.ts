'use server';

import { NextRequest, NextResponse } from 'next/server';
import { executeImageGeneration } from '@/lib/ai/ai-service';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import type { ApiResponse, ApiError } from '@/shared/types';
import { requireFeature } from '@/lib/platform/platform-auth';

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

const VALID_SIZES = [
  '256x256',
  '512x512',
  '1024x1024',
  '1792x1024',
  '1024x1792',
  '1536x1024',
  '1024x1536',
] as const;

const VALID_QUALITIES = ['standard', 'hd'] as const;
const VALID_STYLES = ['vivid', 'natural'] as const;
const VALID_FORMATS = ['url', 'b64_json'] as const;

const imageGenSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  modelId: z.string().optional(),
  prompt: z.string().min(1, 'Prompt is required').max(4000, 'Prompt must be under 4000 characters'),
  negativePrompt: z.string().max(2000, 'Negative prompt must be under 2000 characters').optional(),
  size: z.enum(VALID_SIZES).optional().default('1024x1024'),
  quality: z.enum(VALID_QUALITIES).optional().default('standard'),
  style: z.enum(VALID_STYLES).optional().default('vivid'),
  n: z.number().int().min(1).max(10).optional().default(1),
  responseFormat: z.enum(VALID_FORMATS).optional().default('url'),
  siteId: z.string().optional(),
});

// =====================================================================
// POST — generate image(s)
// =====================================================================

export async function POST(request: NextRequest) {
  const auth = await requireFeature(request, 'ai_content');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err('Request body must be valid JSON');
    }

    const parsed = imageGenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const d = parsed.data;

    // Pre-validate that the provider is active and supports image generation
    const provider = await db.aiProvider.findUnique({ where: { id: d.providerId } });
    if (!provider) return err('Provider not found', 404, 'NOT_FOUND');
    if (!provider.isActive) return err('Provider is disabled. Please activate it first.', 400, 'PROVIDER_INACTIVE');
    if (!['OPENAI', 'GEMINI', 'CUSTOM'].includes(provider.kind)) {
      return err(`${provider.kind} does not support image generation. Please use OpenAI, Gemini, or a Custom OpenAI-compatible provider.`, 400, 'UNSUPPORTED');
    }

    // Pre-validate the model is an IMAGE-type model belonging to this provider
    if (d.modelId) {
      const model = await db.aiModel.findUnique({ where: { id: d.modelId } });
      if (!model) return err('Selected model not found', 404, 'NOT_FOUND');
      if (model.providerId !== d.providerId) {
        return err('The selected model does not belong to the selected provider', 400, 'MODEL_PROVIDER_MISMATCH');
      }
      if (!model.isActive) return err('Selected model is inactive', 400, 'MODEL_INACTIVE');
      if (model.type?.toUpperCase() !== 'IMAGE') {
        return err('The selected model is not an image generation model. Please select an IMAGE-type model.', 400, 'MODEL_TYPE_MISMATCH');
      }
    }

    const result = await executeImageGeneration({
      providerId: d.providerId,
      modelId: d.modelId,
      prompt: d.prompt,
      negativePrompt: d.negativePrompt,
      size: d.size,
      quality: d.quality,
      style: d.style,
      n: d.n,
      responseFormat: d.responseFormat,
      siteId: d.siteId,
    });

    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Image generation failed';
    console.error(`[AI/IMAGES/GENERATE] ${id} —`, error);
    // Validation errors from the service are user errors (400), upstream API errors are 502
    const isUserError = /inactive|not found|does not belong|does not support|not an image|not a text/i.test(msg);
    return err(msg, isUserError ? 400 : 502, isUserError ? 'VALIDATION_ERROR' : 'IMAGE_GENERATION_ERROR');
  }
}

