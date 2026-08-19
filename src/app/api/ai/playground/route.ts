'use server';

import { NextRequest, NextResponse } from 'next/server';
import { executeChat } from '@/lib/ai/ai-service';
import type { ChatMessage } from '@/lib/ai/ai-service';
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
    });

    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chat execution failed';
    console.error(`[AI/PLAYGROUND] ${id} —`, error);
    return err(msg, 500, 'CHAT_ERROR');
  }
}
