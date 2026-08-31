'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeChat } from '@/lib/ai/ai-service';
import type { ChatMessage } from '@/lib/ai/ai-service';
import { z } from 'zod/v4';
import { requireFeature } from '@/lib/platform/platform-auth';
import { checkAiLimit, aiLimitExceededResponse } from '@/lib/platform/usage-limits';

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
// POST — generate article draft from AI
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

    // Read global AI settings for default provider/model/temperature/maxTokens
    const aiSettings = await db.aiSettings.findUnique({ where: { scope: 'global' } });

    // Resolve provider: use AiSettings.defaultProviderId if set, else AiProvider.isDefault, else any active
    let activeProvider = null as Awaited<ReturnType<typeof db.aiProvider.findFirst>> | null;
    if (aiSettings?.defaultProviderId) {
      activeProvider = await db.aiProvider.findFirst({
        where: { id: aiSettings.defaultProviderId, isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: true },
      });
    }
    if (!activeProvider) {
      activeProvider = await db.aiProvider.findFirst({
        where: { isActive: true, isDefault: true, apiKeyEncrypted: { not: null } },
        include: { models: true },
      });
    }
    if (!activeProvider) {
      const fallback = await db.aiProvider.findFirst({
        where: { isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: true },
      });
      if (!fallback) {
        return err('No active AI provider configured. Please set up an AI provider in Settings > AI.', 400, 'NO_PROVIDER');
      }
      activeProvider = fallback;
    }

    // Resolve model: use AiSettings.defaultModelId if set and belongs to the provider
    const defaultModel = aiSettings?.defaultModelId
      ? activeProvider.models.find((m) => m.id === aiSettings.defaultModelId && m.isActive)
      : null;
    const modelId = defaultModel?.modelId ?? activeProvider.models.find((m) => m.isActive)?.modelId;

    // Use settings temperature/maxTokens if available
    const genTemperature = aiSettings?.defaultTemperature ?? 0.7;
    const genMaxTokens = aiSettings?.defaultMaxTokens ?? 8000;

    const lengthMap: Record<string, string> = {
      'Short (300-600 words)': '300-600',
      'Medium (800-1200 words)': '800-1200',
      'Long (1500-2500 words)': '1500-2500',
      'Comprehensive (3000+ words)': '3000+',
    };
    const wordCount = lengthMap[targetLength] || targetLength;

    const systemPrompt = `You are a professional content writer. Write an article in HTML format using common HTML tags like <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>. Do NOT use <html>, <head>, <body>, or <div> wrapper tags. Start directly with an <h2> or <p> tag.

Writing style: ${writingStyle}
Target length: ${wordCount} words
${includeCta ? 'Include a compelling call-to-action at the end.' : ''}`;

    const userPrompt = `Write an article with the following details:

Title: ${title}
${brief ? `Brief/Description: ${brief}` : ''}
${keywords ? `Target keywords: ${keywords}` : ''}

Write the full article content now. Use proper HTML formatting for headings, paragraphs, lists, and emphasis. Make it engaging and SEO-optimized.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const drafts = [];
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
