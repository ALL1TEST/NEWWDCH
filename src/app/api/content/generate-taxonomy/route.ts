// ============================================================
// POST /api/content/generate-taxonomy — AI-generate categories & tags
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { requireFeatureAllowStaff } from '@/lib/platform/platform-auth';
import { resolveAiProviderForUser } from '@/lib/ai/platform-ai';
import { executeChat, rankCandidateModels } from '@/lib/ai/ai-service';

function reqId() {
  return 'req_' + nanoid(8);
}

export async function POST(request: NextRequest) {
  const auth = await requireFeatureAllowStaff(request, 'ai_platform');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const {
      type = 'tags',
      title = '',
      content = '',
      seoTitle = '',
      seoDescription = '',
      existing = [],
      count = 6,
    } = body;

    // Resolve active AI provider for user/platform (strictly for text generation)
    const activeProvider = await resolveAiProviderForUser(auth.user.id, 'TEXT');
    if (!activeProvider) {
      return NextResponse.json(
        { error: { code: 'NO_PROVIDER_CONFIGURED', message: 'No active AI Provider configured. Please configure a provider under Platform Admin > AI or AI Providers.' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const rankedCandidates = rankCandidateModels(activeProvider.models, 'TEXT_GENERATION');
    const textModel =
      rankedCandidates[0] ??
      activeProvider.models.find((m) => m.isActive && (m.isDefaultText || m.isDefault) && m.type?.toUpperCase() === 'TEXT') ??
      activeProvider.models.find((m) => m.isActive && m.type?.toUpperCase() === 'TEXT');

    const cleanArticleSample = (content || '').replace(/<[^>]*>/g, ' ').slice(0, 1500).trim();

    const isCategory = type === 'categories';
    const targetCount = isCategory ? Math.min(count || 5, 8) : Math.min(count || 8, 12);

    const systemPrompt = `You are a professional SEO specialist and content taxonomy expert. Your task is to analyze the article title and SEO metadata (meta title, meta description, and context) to generate high-value, searchable SEO keywords and tags.
Output ONLY a valid JSON array of strings:
["Keyword 1", "Keyword 2", "Keyword 3"]
Rules:
1. Return exactly ${targetCount} ${isCategory ? 'concise category names (1-3 words each, title case)' : 'high-impact SEO keywords/tags (1-3 words each, lowercase or title case, derived from article title and SEO context)'}.
2. Make them highly relevant, searchable, and specific to the article's topic and SEO keywords.
3. Do NOT include any explanations, markdown blocks, backticks, or other text outside the raw JSON array.`;

    const userPrompt = `Generate ${targetCount} ${isCategory ? 'categories' : 'SEO keywords and tags'} based on:
Article Title: "${title || 'Untitled'}"
${seoTitle ? `SEO Meta Title: "${seoTitle}"` : ''}
${seoDescription ? `SEO Meta Description: "${seoDescription}"` : ''}
Content Context: "${cleanArticleSample}"
${existing && existing.length > 0 ? `Already existing ${isCategory ? 'categories' : 'tags'}: ${existing.slice(0, 20).join(', ')} (provide fresh, distinct ones)` : ''}`;

    const chatRes = await executeChat({
      providerId: activeProvider.id,
      modelId: textModel?.id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      maxTokens: 300,
      userId: auth.user.id,
    });

    const rawReply = (chatRes.content || (chatRes as any).reply || '').trim();
    let items: string[] = [];

    try {
      const cleaned = rawReply.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        items = parsed.map((item) => String(item).trim()).filter(Boolean);
      } else if (parsed && typeof parsed === 'object') {
        const arr = (parsed as any).items || (parsed as any).categories || (parsed as any).tags || Object.values(parsed).find((v) => Array.isArray(v));
        if (Array.isArray(arr)) {
          items = arr.map((item: any) => String(item).trim()).filter(Boolean);
        }
      }
    } catch {
      // Fallback regex extraction or comma split
      const jsonMatch = rawReply.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            items = parsed.map((item) => String(item).trim()).filter(Boolean);
          }
        } catch {}
      }
      if (items.length === 0) {
        items = rawReply
          .replace(/[\[\]"]/g, '')
          .split(/[,\n]+/)
          .map((s) => s.replace(/^[-*•\d\.\)]\s*/, '').trim())
          .filter((s) => s.length > 0 && s.length < 50 && !s.toLowerCase().startsWith('here are') && !s.toLowerCase().startsWith('sure'))
          .slice(0, targetCount);
      }
    }

    // Heuristic fallback if AI returned empty array or couldn't parse
    if (items.length === 0) {
      const combinedText = `${title} ${content} ${seoTitle} ${seoDescription}`;
      const kwMatch = combinedText.match(/Keywords:\s*([^\n\r]+)/i);
      if (kwMatch && kwMatch[1]) {
        items = kwMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, targetCount);
      }
    }

    if (items.length === 0 && title.trim()) {
      // Extract significant terms from title
      const cleanTitle = title.replace(/[:\-–—\(\)\?!]/g, ' ');
      const words = cleanTitle.split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 3);
      if (words.length > 0) {
        items = Array.from(new Set(words)).slice(0, targetCount);
      }
    }

    return NextResponse.json({
      data: { items },
      meta: { requestId: id },
    });
  } catch (error: any) {
    console.error(`[GENERATE:TAXONOMY] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to generate taxonomy' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
