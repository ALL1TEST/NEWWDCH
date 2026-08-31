// ============================================================
// POST /api/content/ai-ideas — Generate AI article ideas
// Uses DB-configured provider via executeChat if available,
// falls back to z-ai-web-dev-sdk otherwise.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeChat } from '@/lib/ai/ai-service';
import type { ChatMessage } from '@/lib/ai/ai-service';
import { z } from 'zod/v4';
import { requireFeature } from '@/lib/platform/platform-auth';

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
  count: z.number().int().min(1).max(10).optional().default(6),
  existingTitles: z.array(z.string()).optional().default([]),
});

// Build a strict system prompt that asks the model to return rich idea data
function buildSystemPrompt(count: number, existingTitles: string[]): string {
  const avoidBlock =
    existingTitles.length > 0
      ? `\nIMPORTANT: Avoid returning ideas that are duplicates or near-duplicates of these existing titles (different phrasing of the same topic is also a duplicate):\n${existingTitles
          .map((t) => `  - ${t}`)
          .join('\n')}\n`
      : '';

  return `You are an expert SEO content strategist. Generate ${count} compelling, distinct article ideas for a website.

${avoidBlock}

For each idea, you MUST provide ALL of these fields:
1. "title" — a compelling, click-worthy article title (max ~80 chars)
2. "seoOpportunity" — integer 0-100, your estimate of the SEO opportunity for this topic (higher = better opportunity). Consider search demand, ranking feasibility, and topical authority potential.
3. "topicRelevance" — integer 0-100, how relevant this topic is to the website's stated niche (higher = more central to the niche)
4. "competition" — one of: "Low" | "Medium" | "High" (SERP competition)
5. "contentPotential" — one of: "High" | "Medium" | "Low" (how much valuable, in-depth content this topic can sustain)
6. "searchIntent" — one of: "Informational" | "Commercial" | "Transactional" | "Navigational"
7. "primaryKeyword" — the single most important target keyword/phrase for this article (lowercase, no quotes)
8. "keywords" — array of 3-5 closely related keywords/keyphrases
9. "description" — 1-2 sentence description of what the article would cover and why it matters
10. "suggestedAngle" — a short description of the recommended article angle/approach (e.g. "Step-by-step tutorial with examples", "Comparison table + analysis", "Data-driven listicle")
11. "tags" — array of 3-5 relevant tags (single words or short phrases, lowercase)

IMPORTANT:
- Do NOT generate any "monthlyVolume" or "search volume" field. Use only seoOpportunity / topicRelevance / competition as AI-internal scoring.
- Do NOT include "seoScore" or "difficulty" fields. Use seoOpportunity and competition instead.
- Each idea must be genuinely distinct from the others in the same response.
- Respond with valid JSON only. No markdown fences, no commentary.

You MUST respond with valid JSON in this exact shape:
{
  "ideas": [
    {
      "title": "Article Title Here",
      "seoOpportunity": 78,
      "topicRelevance": 92,
      "competition": "Medium",
      "contentPotential": "High",
      "searchIntent": "Informational",
      "primaryKeyword": "primary keyword phrase",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "description": "A brief 1-2 sentence description of what this article would cover.",
      "suggestedAngle": "Recommended article approach",
      "tags": ["tag1", "tag2", "tag3"]
    }
  ]
}

Return ONLY valid JSON. Do NOT include any text outside the JSON object.`;
}

function buildUserPrompt(niche: string, keywords: string, count: number): string {
  const nichePart = niche ? ` for a website in the ${niche} niche` : ' for a general-purpose content website';
  const kwPart = keywords ? ` — focusing on these target keywords/topics: ${keywords}` : '';
  return `Generate ${count} SEO article ideas${nichePart}${kwPart}. For each idea include seoOpportunity, topicRelevance, competition, contentPotential, searchIntent, primaryKeyword, keywords, description, suggestedAngle, and tags. Respond with JSON only.`;
}

// Tolerant JSON parser — strips markdown fences and trims trailing commas
function parseIdeasJson(raw: string): unknown {
  let cleaned = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  // Find the first { ... last } to be safe
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

// Normalize a raw idea object into the expected shape (string + number coercion, defaults)
function normalizeIdea(raw: unknown): ArticleIdeaDTO | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === 'string' ? r.title.trim() : '';
  if (!title) return null;

  const clamp = (v: unknown): number => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
    if (!Number.isFinite(n)) return 50;
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  const oneOf = (v: unknown, allowed: string[], fallback: string): string => {
    if (typeof v === 'string' && allowed.includes(v)) return v;
    if (typeof v === 'string') {
      const lc = v.trim();
      if (allowed.includes(lc)) return lc;
      // case-insensitive match
      const hit = allowed.find((a) => a.toLowerCase() === lc.toLowerCase());
      if (hit) return hit;
    }
    return fallback;
  };

  const asStringArray = (v: unknown): string[] => {
    if (Array.isArray(v)) {
      return v
        .filter((x) => typeof x === 'string' && x.trim().length > 0)
        .map((x: string) => x.trim())
        .slice(0, 8);
    }
    if (typeof v === 'string') {
      return v
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
    }
    return [];
  };

  const primaryKeyword =
    typeof r.primaryKeyword === 'string' && r.primaryKeyword.trim()
      ? r.primaryKeyword.trim()
      : (asStringArray(r.keywords)[0] ?? '');

  return {
    title,
    seoOpportunity: clamp(r.seoOpportunity),
    topicRelevance: clamp(r.topicRelevance),
    competition: oneOf(r.competition, ['Low', 'Medium', 'High'], 'Medium'),
    contentPotential: oneOf(r.contentPotential, ['High', 'Medium', 'Low'], 'Medium'),
    searchIntent: oneOf(
      r.searchIntent,
      ['Informational', 'Commercial', 'Transactional', 'Navigational'],
      'Informational',
    ),
    primaryKeyword,
    keywords: asStringArray(r.keywords),
    description:
      typeof r.description === 'string' && r.description.trim()
        ? r.description.trim()
        : '',
    suggestedAngle:
      typeof r.suggestedAngle === 'string' && r.suggestedAngle.trim()
        ? r.suggestedAngle.trim()
        : '',
    tags: asStringArray(r.tags),
  };
}

interface ArticleIdeaDTO {
  title: string;
  seoOpportunity: number;
  topicRelevance: number;
  competition: string;
  contentPotential: string;
  searchIntent: string;
  primaryKeyword: string;
  keywords: string[];
  description: string;
  suggestedAngle: string;
  tags: string[];
}

// =====================================================================
// POST — generate AI article ideas
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

    const { niche, keywords, count, existingTitles } = parsed.data;

    const systemPrompt = buildSystemPrompt(count, existingTitles);
    const userPrompt = buildUserPrompt(niche ?? '', keywords ?? '', count);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // ---- Path 1: DB-configured provider via executeChat ----
    const provider = await db.aiProvider.findFirst({
      where: { isActive: true, isDefault: true, apiKeyEncrypted: { not: null } },
      include: { models: true },
    });
    const activeProvider =
      provider ??
      (await db.aiProvider.findFirst({
        where: { isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: true },
      }));

    let rawContent: string | null = null;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let costUsd: number | undefined;

    if (activeProvider) {
      const result = await executeChat({
        providerId: activeProvider.id,
        messages,
        temperature: 0.8,
        maxTokens: 4000,
        jsonMode: true,
      });
      rawContent = result.content;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      costUsd = result.costUsd;
    } else {
      // ---- Path 2: Fallback to z-ai-web-dev-sdk ----
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const response = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });
      rawContent = response?.choices?.[0]?.message?.content ?? null;
    }

    if (!rawContent) {
      return err('AI returned an empty response. Please try again.', 500, 'AI_EMPTY');
    }

    // Parse + normalize
    let parsedIdeas: unknown;
    try {
      parsedIdeas = parseIdeasJson(rawContent);
    } catch {
      return err('Failed to parse AI response. Please try again.', 500, 'PARSE_ERROR');
    }

    const ideasRaw =
      parsedIdeas && typeof parsedIdeas === 'object' && 'ideas' in (parsedIdeas as Record<string, unknown>)
        ? (parsedIdeas as { ideas: unknown }).ideas
        : Array.isArray(parsedIdeas)
          ? parsedIdeas
          : null;

    if (!Array.isArray(ideasRaw)) {
      return err('AI did not return an ideas array. Please try again.', 500, 'PARSE_ERROR');
    }

    const ideas: ArticleIdeaDTO[] = ideasRaw
      .map(normalizeIdea)
      .filter((x): x is ArticleIdeaDTO => x !== null);

    return NextResponse.json({
      data: { ideas },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        ...(inputTokens !== undefined ? { usage: { inputTokens, outputTokens, costUsd } } : {}),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate ideas';
    console.error(`[CONTENT/AI-IDEAS] ${id} —`, error);
    return err(msg, 500, 'AI_ERROR');
  }
}
