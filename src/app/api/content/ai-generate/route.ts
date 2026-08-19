'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeChat } from '@/lib/ai/ai-service';
import type { ChatMessage } from '@/lib/ai/ai-service';
import { z } from 'zod/v4';

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

    const { title, brief, keywords, writingStyle, targetLength, numberOfDrafts, includeCta } = parsed.data;

    // Find an active AI provider
    const provider = await db.aiProvider.findFirst({
      where: { isActive: true, isDefault: true, apiKeyEncrypted: { not: null } },
      include: { models: true },
    });

    if (!provider) {
      const fallback = await db.aiProvider.findFirst({
        where: { isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: true },
      });
      if (!fallback) {
        return err('No active AI provider configured. Please set up an AI provider in Settings > AI.', 400, 'NO_PROVIDER');
      }
    }

    const activeProvider = provider!;

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
        temperature: 0.7 + i * 0.15,
        maxTokens: 8000,
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
