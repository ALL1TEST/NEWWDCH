// ============================================================
// POST /api/media/[id]/generate-seo — AI-generate SEO metadata
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { requireFeature } from '@/lib/platform/platform-auth';
import { checkAiLimit, aiLimitExceededResponse } from '@/lib/platform/usage-limits';
import { resolveAiProviderForUser } from '@/lib/ai/platform-ai';
import { executeChat, rankCandidateModels } from '@/lib/ai/ai-service';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  // Platform AI entitlement gate — requires Platform AI plan feature
  const auth = await requireFeature(_request, 'ai_platform');
  if ('response' in auth) return auth.response;

  // Platform AI usage limit
  const aiLimit = await checkAiLimit(auth.user, { articles: 1 });
  if (aiLimit && !aiLimit.ok) return aiLimitExceededResponse(aiLimit);
  const id = reqId();

  try {
    const { id: mediaId } = await context.params;

    const media = await db.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Media item not found' } },
        { status: 404 },
      );
    }

    // Only allow SEO generation for images
    if (!media.mimeType.startsWith('image/')) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'SEO generation is only available for images' } },
        { status: 400 },
      );
    }

    const fileName = media.originalName || media.filename;

    // Resolve active AI provider for user/platform (strictly text generation)
    const activeProvider = await resolveAiProviderForUser(auth.user.id, 'TEXT');
    if (!activeProvider) {
      return NextResponse.json(
        { error: { code: 'NO_PROVIDER_CONFIGURED', message: 'No active AI Provider configured. Please configure a provider in Platform Admin > AI.' } },
        { status: 400 },
      );
    }

    const userSettings = await db.aiSettings.findUnique({ where: { scope: `user:${auth.user.id}` } });
    const globalSettings = await db.aiSettings.findUnique({ where: { scope: 'global' } });
    const configuredModelDbId = userSettings?.defaultModelId || globalSettings?.defaultModelId;

    const targetModel = configuredModelDbId
      ? activeProvider.models.find((m) => (m.id === configuredModelDbId || m.modelId === configuredModelDbId) && m.isActive)
      : null;

    const rankedCandidates = rankCandidateModels(activeProvider.models, 'TEXT_GENERATION');
    const defaultModel = targetModel
      ?? rankedCandidates[0]
      ?? activeProvider.models.find((m) => m.isActive && (m.isDefaultText || m.isDefault))
      ?? activeProvider.models.find((m) => m.isActive && m.type?.toUpperCase() === 'TEXT')
      ?? activeProvider.models.find((m) => m.isActive);

    if (!defaultModel) {
      return NextResponse.json(
        { error: { code: 'NO_MODEL_CONFIGURED', message: 'No active text model found for this provider.' } },
        { status: 400 },
      );
    }

    const prompt = `Analyze this image details and generate optimized SEO metadata.
Image Details:
- Title / Filename: "${fileName}"
- Original Name: "${media.originalName || fileName}"
- Existing Alt: "${media.alt || 'None'}"
- Existing Caption: "${media.caption || 'None'}"

Generate accurate, high-quality SEO metadata. Be descriptive and realistic based on the image name and context.
Return ONLY valid JSON (no markdown fences, no explanatory text) with these exact keys:
{
  "seoTitle": "A concise, descriptive title around 50-60 characters",
  "metaDescription": "A natural description around 150-160 characters with relevant keywords",
  "alt": "A concise accessibility description of what is visually present (under 120 chars)",
  "caption": "A short, engaging caption suitable for content display",
  "focusKeywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "imageDescription": "A detailed 2-3 sentence description of the image for SEO and accessibility."
}

Rules:
- seoTitle: Descriptive and relevant, no fluff.
- metaDescription: Natural language with relevant keywords.
- alt: What is visually present for accessibility.
- focusKeywords: 3-8 relevant keywords in the array.`;

    const chatResponse = await executeChat({
      providerId: activeProvider.id,
      modelId: defaultModel.id,
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO specialist and web accessibility director. Always return strictly valid JSON matching the requested schema.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      jsonMode: true,
      userId: auth.user.id,
      siteId: media.siteId ?? undefined,
    });

    const content = chatResponse.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: { code: 'AI_ERROR', message: 'AI returned empty response' } },
        { status: 500 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      const jsonStr = content
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start >= 0 && end > start) {
        parsed = JSON.parse(content.slice(start, end + 1));
      } else {
        return NextResponse.json(
          { error: { code: 'AI_PARSE_ERROR', message: 'Failed to parse AI response' } },
          { status: 500 },
        );
      }
    }

    const keywordsStr = Array.isArray(parsed.focusKeywords)
      ? parsed.focusKeywords.filter((k: unknown) => typeof k === 'string' && (k as string).trim()).join(', ')
      : (typeof parsed.focusKeywords === 'string' ? parsed.focusKeywords : '');

    const seoData = {
      seoTitle: typeof parsed.seoTitle === 'string' ? parsed.seoTitle.slice(0, 200) : null,
      metaDescription: typeof parsed.metaDescription === 'string' ? parsed.metaDescription.slice(0, 500) : null,
      alt: typeof parsed.alt === 'string' ? parsed.alt.slice(0, 500) : null,
      caption: typeof parsed.caption === 'string' ? parsed.caption.slice(0, 500) : null,
      focusKeywords: keywordsStr || null,
      imageDescription: typeof parsed.imageDescription === 'string' ? parsed.imageDescription.slice(0, 2000) : null,
    };

    return NextResponse.json({ data: seoData });
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : 'Failed to generate SEO metadata';
    console.error(`[MEDIA:GENERATE_SEO] ${id} -`, error);
    const msg = rawMsg.includes('.z-ai-config')
      ? 'No active AI Provider configured. Please configure a provider in Platform Admin > AI.'
      : rawMsg;
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: msg } },
      { status: 500 },
    );
  }
}
