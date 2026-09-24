// ============================================================
// POST /api/content/generate-seo — AI-generate SEO metadata for articles
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { requireFeatureAllowStaff, isPlatformStaff } from '@/lib/platform/platform-auth';
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

    const { title = '', content = '', excerpt = '' } = body;
    if (!title?.trim() && !content?.trim() && !excerpt?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Article title or content is required to generate SEO metadata.' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Resolve active AI provider for user/platform (strictly for text generation)
    const activeProvider = await resolveAiProviderForUser(auth.user.id, 'TEXT');
    if (!activeProvider) {
      return NextResponse.json(
        { error: { code: 'NO_PROVIDER_CONFIGURED', message: 'No active AI Provider configured. Please configure a provider under Platform Admin > AI or AI Providers.' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Pick top-ranked fast, high-quality candidate model if default is not explicitly set
    const rankedCandidates = rankCandidateModels(activeProvider.models, 'TEXT_GENERATION');
    const textModel = rankedCandidates[0]
      ?? activeProvider.models.find((m) => m.isActive && (m.isDefaultText || m.isDefault) && m.type?.toUpperCase() === 'TEXT')
      ?? activeProvider.models.find((m) => m.isActive && m.type?.toUpperCase() === 'TEXT');

    const cleanArticleSample = (content || excerpt || '').replace(/<[^>]*>/g, ' ').slice(0, 1500).trim();

    const systemPrompt = `You are an elite SEO Specialist and copywriter. Your task is to generate high-CTR, search-engine-optimized meta tags for an article.
Output ONLY a valid JSON object with EXACTLY two fields:
{
  "seoTitle": "A concise, engaging meta title under 60 characters including the primary keyword",
  "seoDescription": "A compelling meta description under 155 characters that drives clicks"
}
Do NOT include any markdown code blocks, backticks, or other text outside the raw JSON.`;

    const userPrompt = `Generate SEO meta tags for this article:
Title: "${title || 'Untitled Article'}"
Excerpt / Summary: "${excerpt || ''}"
Content Snippet:
"${cleanArticleSample}"

Ensure:
1. seoTitle is 40-60 characters, catchy, relevant, and no quotes.
2. seoDescription is 120-155 characters, engaging, action-oriented, with a clear hook.`;

    const chatRes = await executeChat({
      providerId: activeProvider.id,
      modelId: textModel?.id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 500,
      userId: auth.user.id,
    });

    let rawOutput = chatRes.content.trim();
    if (rawOutput.startsWith('```')) {
      rawOutput = rawOutput.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    let parsedResult: { seoTitle?: string; seoDescription?: string } = {};
    try {
      parsedResult = JSON.parse(rawOutput);
    } catch {
      const titleMatch = rawOutput.match(/"seoTitle"\s*:\s*"([^"]+)"/i);
      const descMatch = rawOutput.match(/"seoDescription"\s*:\s*"([^"]+)"/i);
      parsedResult = {
        seoTitle: titleMatch ? titleMatch[1] : (title || 'SEO Title').slice(0, 60),
        seoDescription: descMatch ? descMatch[1] : (excerpt || title || 'SEO Description').slice(0, 155),
      };
    }

    const finalSeoTitle = (parsedResult.seoTitle || title || '').slice(0, 60).trim();
    const finalSeoDescription = (parsedResult.seoDescription || excerpt || '').slice(0, 160).trim();

    return NextResponse.json({
      data: {
        seoTitle: finalSeoTitle,
        seoDescription: finalSeoDescription,
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[CONTENT:GENERATE-SEO] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to generate SEO metadata' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
