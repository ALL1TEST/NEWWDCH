'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeChat } from '@/lib/ai/ai-service';
import type { ChatMessage } from '@/lib/ai/ai-service';
import { z } from 'zod/v4';
import { requireFeature } from '@/lib/platform/platform-auth';
import { checkAiLimit, aiLimitExceededResponse } from '@/lib/platform/usage-limits';
import { resolvePlatformPrompt, platformOwnedProviderFilter } from '@/lib/ai/platform-ai';

function reqId() {
  return 'req_' + crypto.randomUUID().slice(0, 8);
}

function err(message: string, status = 400, code = 'VALIDATION_ERROR') {
  return NextResponse.json(
    { error: { code, message }, meta: { requestId: reqId(), timestamp: new Date().toISOString() } },
    { status },
  );
}

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  brief: z.string().optional().or(z.literal('')),
  keywords: z.string().optional().or(z.literal('')),
  writingStyle: z.string().optional().default('Professional'),
  targetLength: z.string().optional().default('Medium (800-1200 words)'),
  numberOfDrafts: z.number().int().min(1).max(3).optional().default(1),
  includeCta: z.boolean().optional().default(false),
});

// =====================================================================
// POST — generate article draft with AI (client AI tool)
// =====================================================================
// This is a PLATFORM AI generation endpoint:
//   • Requires the Platform AI plan feature — a client without it is
//     denied (403). The client never configures providers or API keys;
//     the platform's configured provider/model is used automatically.
//   • Usage is tracked against the plan's AI Articles / month limit.
//   • The system internally selects the matching Platform Admin
//     prompt (Prompt Library slot "article") and injects the tool
//     variables — the client never sees the prompt templates.
//   • Generation runs exclusively on PLATFORM-OWNED providers
//     (created by platform staff) or, when none is configured, on
//     the platform SDK (z-ai-web-dev-sdk).
// =====================================================================

export async function POST(request: NextRequest) {
  const auth = await requireFeature(request, 'ai_platform');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err('Request body must be valid JSON');
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    // Platform AI usage limit — one article generation per requested
    // draft, enforced server-side before generating. Client's Own AI
    // API plans and owner bypass are never counted.
    const aiLimit = await checkAiLimit(auth.user, { articles: parsed.data.numberOfDrafts ?? 1 });
    if (aiLimit && !aiLimit.ok) return aiLimitExceededResponse(aiLimit);

    const { title, brief, keywords, writingStyle, targetLength, numberOfDrafts, includeCta } = parsed.data;

    const lengthMap: Record<string, string> = {
      'Short (300-600 words)': '300-600',
      'Medium (800-1200 words)': '800-1200',
      'Long (1500-2500 words)': '1500-2500',
      'Comprehensive (3000+ words)': '3000+',
    };
    const wordCount = lengthMap[targetLength] || targetLength;

    // ---- Built-in default prompts (used when no Platform Admin
    // prompt is bound to the "article" slot) ----
    const defaultSystemPrompt = `You are a professional content writer. Write an article in HTML format using common HTML tags like <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>. Do NOT use <html>, <head>, <body>, or <div> wrapper tags. Start directly with an <h2> or <p> tag.

Writing style: ${writingStyle}
Target length: ${wordCount} words
${includeCta ? 'Include a compelling call-to-action at the end.' : ''}`;

    const defaultUserPrompt = `Write an article with the following details:

Title: ${title}
${brief ? `Brief/Description: ${brief}` : ''}
${keywords ? `Target keywords: ${keywords}` : ''}

Write the full article content now. Use proper HTML formatting for headings, paragraphs, lists, and emphasis. Make it engaging and SEO-optimized.`;

    // ---- Internally select the Platform Admin prompt (Prompt
    // Library slot "article") and inject the tool variables. ----
    const platformPrompt = await resolvePlatformPrompt('article', {
      title,
      brief: brief ?? '',
      keywords: keywords ?? '',
      style: writingStyle,
      length: wordCount,
      cta: includeCta ? 'Include a compelling call-to-action at the end.' : '',
    });
    const systemPrompt = platformPrompt?.systemPrompt || defaultSystemPrompt;
    const userPrompt = platformPrompt?.userPrompt || defaultUserPrompt;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // ---- Resolve the platform's configured provider ----
    // Read global AI settings (managed by Platform Admin) for the
    // default provider/model/temperature/maxTokens.
    const aiSettings = await db.aiSettings.findUnique({ where: { scope: 'global' } });
    const owned = await platformOwnedProviderFilter();

    // Resolution order (PLATFORM-OWNED providers only):
    //   1. AiSettings.defaultProviderId
    //   2. Any platform-owned provider flagged default
    //   3. Any active platform-owned provider
    const findProvider = (extra: Record<string, unknown>) =>
      db.aiProvider.findFirst({
        where: { ...extra, ...owned },
        include: { models: true },
      });

    let activeProvider = aiSettings?.defaultProviderId
      ? await findProvider({ id: aiSettings.defaultProviderId, isActive: true, apiKeyEncrypted: { not: null } })
      : null;
    if (!activeProvider) {
      activeProvider = await findProvider({ isActive: true, isDefault: true, apiKeyEncrypted: { not: null } });
    }
    if (!activeProvider) {
      activeProvider = await findProvider({ isActive: true, apiKeyEncrypted: { not: null } });
    }

    const drafts: Array<{ content: string; wordCount: number }> = [];

    if (activeProvider) {
      // Resolve model: use AiSettings.defaultModelId if set and belongs to the provider
      const defaultModel = aiSettings?.defaultModelId
        ? activeProvider.models.find((m) => m.id === aiSettings.defaultModelId && m.isActive)
        : null;
      const modelId = defaultModel?.modelId ?? activeProvider.models.find((m) => m.isActive)?.modelId;

      // Use platform-configured temperature/maxTokens (a Platform Admin
      // prompt override wins, then request defaults, then settings).
      const genTemperature = platformPrompt?.temperature ?? aiSettings?.defaultTemperature ?? 0.7;
      const genMaxTokens = platformPrompt?.maxTokens ?? aiSettings?.defaultMaxTokens ?? 8000;

      for (let i = 0; i < numberOfDrafts; i++) {
        const result = await executeChat({
          providerId: activeProvider.id,
          messages,
          temperature: genTemperature + i * 0.15,
          maxTokens: genMaxTokens,
          ...(modelId ? { modelId } : {}),
          // Attribute the usage to the user for the Platform AI monthly
          // usage tracker (AiLog).
          userId: auth.user.id,
        });
        drafts.push({
          content: result.content,
          wordCount: result.content.split(/\s+/).length,
        });
      }
    } else {
      // ---- Platform SDK fallback (z-ai-web-dev-sdk) ----
      // The SDK is AI provided and paid for by the platform; it is the
      // platform's built-in engine when no provider is configured.
      // Usage is logged to AiLog so the plan limits see it.
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      for (let i = 0; i < numberOfDrafts; i++) {
        const response = await zai.chat.completions.create({
          messages,
          thinking: { type: 'disabled' },
        });
        const content = response?.choices?.[0]?.message?.content ?? '';
        if (!content) {
          return err('AI generation returned no content. Please try again.', 502, 'AI_ERROR');
        }
        await db.aiLog
          .create({
            data: {
              providerId: null,
              providerName: 'Platform SDK (fallback)',
              modelId: null,
              question: userPrompt,
              response: content,
              inputTokens: response?.usage?.promptTokens ?? 0,
              outputTokens: response?.usage?.completionTokens ?? 0,
              totalTokens:
                (response?.usage?.promptTokens ?? 0) + (response?.usage?.completionTokens ?? 0),
              costUsd: 0,
              durationMs: null,
              status: 'success',
              userId: auth.user.id,
            },
          })
          .catch(() => {
            /* usage logging failure shouldn't mask the result */
          });
        drafts.push({
          content,
          wordCount: content.split(/\s+/).length,
        });
      }
    }

    return NextResponse.json({
      data: { drafts },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate article';
    console.error(`[CONTENT/AI-GENERATE] ${id} —`, error);
    return err(msg, 500, 'AI_ERROR');
  }
}
