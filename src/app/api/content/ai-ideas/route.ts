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
  niche: z.string().optional().or(z.literal('')),
  keywords: z.string().optional().or(z.literal('')),
  count: z.number().int().min(1).max(10).optional().default(5),
});

// =====================================================================
// POST — generate AI article ideas
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

    const { niche, keywords, count } = parsed.data;

    // Find an active AI provider with an API key
    const provider = await db.aiProvider.findFirst({
      where: { isActive: true, isDefault: true, apiKeyEncrypted: { not: null } },
      include: { models: true },
    });

    if (!provider) {
      // Fallback: find any active provider
      const fallback = await db.aiProvider.findFirst({
        where: { isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: true },
      });
      if (!fallback) {
        return err('No active AI provider configured. Please set up an AI provider in Settings > AI.', 400, 'NO_PROVIDER');
      }
    }

    const activeProvider = provider!;

    const systemPrompt = `You are an expert SEO content strategist. Generate ${count} article ideas for a website.
${niche ? `The website's niche is: ${niche}` : 'Generate general content ideas.'}
${keywords ? `Focus on these keywords/topics: ${keywords}` : ''}

For each idea, provide:
1. A compelling title
2. SEO Score (0-100)
3. Difficulty (Easy, Medium, Hard, Very Hard)
4. Monthly Search Volume (realistic estimate)
5. Search Intent (Informational, Commercial, Transactional, Navigational)
6. 3-5 relevant keywords
7. A short 1-2 sentence description
8. 3-5 related tags

You MUST respond with valid JSON in this exact format:
{
  "ideas": [
    {
      "title": "Article Title Here",
      "seoScore": 78,
      "difficulty": "Medium",
      "monthlyVolume": 2400,
      "searchIntent": "Informational",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "description": "A brief description of what this article would cover.",
      "tags": ["tag1", "tag2", "tag3"]
    }
  ]
}

Do NOT include any text outside the JSON object. Return ONLY valid JSON.`;

    const userPrompt = `Generate ${count} SEO article ideas${niche ? ` for a ${niche} website` : ''}${keywords ? ` targeting keywords: ${keywords}` : ''}. Provide realistic SEO metrics for each idea.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await executeChat({
      providerId: activeProvider.id,
      messages,
      temperature: 0.8,
      maxTokens: 4000,
      jsonMode: true,
    });

    let ideas;
    try {
      const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      ideas = JSON.parse(cleaned);
    } catch {
      return err('Failed to parse AI response. Please try again.', 500, 'PARSE_ERROR');
    }

    return NextResponse.json({
      data: ideas,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd },
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate ideas';
    console.error(`[CONTENT/AI-IDEAS] ${id} —`, error);
    return err(msg, 500, 'AI_ERROR');
  }
}
