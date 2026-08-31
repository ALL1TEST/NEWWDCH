// ============================================================
// POST /api/media/[id]/generate-seo — AI-generate SEO metadata
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import ZAI from 'z-ai-web-dev-sdk';
import { requireFeature } from '@/lib/platform/platform-auth';
import { checkAiLimit, aiLimitExceededResponse } from '@/lib/platform/usage-limits';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  // Platform AI entitlement gate — this route runs EXCLUSIVELY on the
  // platform SDK (z-ai-web-dev-sdk), i.e. AI provided and paid for by
  // the platform. A Client's Own AI API-only plan gets no platform AI
  // access here (403); the plan must include Platform AI.
  const auth = await requireFeature(_request, 'ai_platform');
  if ('response' in auth) return auth.response;
  // Platform AI usage limit — enforced server-side before generating.
  // Client's Own AI API-only plans and owner bypass are never counted.
  const aiLimit = await checkAiLimit(auth.user, { articles: 1 });
  if (aiLimit && !aiLimit.ok) return aiLimitExceededResponse(aiLimit);
  const id = reqId();

  try {
    const { id: mediaId } = await context.params;

    const media = await db.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });

    if (!media) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Media not found' } },
        { status: 404 },
      );
    }

    if (!media.mimeType.startsWith('image/')) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'SEO generation is only available for images' } },
        { status: 400 },
      );
    }

    const imageUrl = media.url;
    const fileName = media.originalName || media.filename;

    const prompt = `Analyze this image carefully and generate SEO metadata. Be specific to what you actually see — objects, people, environment, text, context. Do NOT hallucinate or guess information not visible.

Return ONLY valid JSON (no markdown, no code fences) with these exact keys:
{
  "seoTitle": "A concise, descriptive title around 50-60 characters",
  "metaDescription": "A natural description around 150-160 characters with relevant keywords",
  "alt": "A concise accessibility description of what is visually present",
  "caption": "A short, engaging caption suitable for social media or content display",
  "focusKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "imageDescription": "A detailed description of the image contents for internal use, SEO, and accessibility. Describe objects, people, setting, colors, composition, text visible, and overall context."
}

Rules:
- seoTitle: No keyword stuffing. Descriptive and relevant.
- metaDescription: Natural language, includes relevant keywords.
- alt: Describes what is visually present for accessibility. NOT keyword-stuffed.
- caption: Short and engaging.
- focusKeywords: 3-8 relevant keywords as an array of strings.
- imageDescription: 2-4 sentences of detailed description.
- If the filename is "${fileName}", use it as a hint for context.
- Do NOT output generic text like "Beautiful image" or "High quality photo".`;

    const zai = await ZAI.create();

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: { code: 'AI_ERROR', message: 'AI returned empty response' } },
        { status: 500 },
      );
    }

    // Parse JSON from the AI response, tolerating markdown fences
    let parsed: Record<string, unknown>;
    try {
      const jsonStr = content
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: { code: 'AI_PARSE_ERROR', message: 'Failed to parse AI response' } },
        { status: 500 },
      );
    }

    const seoData = {
      seoTitle: typeof parsed.seoTitle === 'string' ? parsed.seoTitle.slice(0, 200) : null,
      metaDescription: typeof parsed.metaDescription === 'string' ? parsed.metaDescription.slice(0, 500) : null,
      alt: typeof parsed.alt === 'string' ? parsed.alt.slice(0, 500) : null,
      caption: typeof parsed.caption === 'string' ? parsed.caption.slice(0, 500) : null,
      focusKeywords: Array.isArray(parsed.focusKeywords)
        ? parsed.focusKeywords.filter((k: unknown) => typeof k === 'string').join(', ')
        : null,
      imageDescription: typeof parsed.imageDescription === 'string' ? parsed.imageDescription.slice(0, 2000) : null,
    };

    return NextResponse.json({ data: seoData });
  } catch (error) {
    console.error(`[MEDIA:GENERATE_SEO] ${id} -`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate SEO metadata' } },
      { status: 500 },
    );
  }
}
