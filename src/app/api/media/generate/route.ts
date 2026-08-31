// ============================================================
// POST /api/media/generate — AI image generation via z-ai-web-dev-sdk
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';
import { checkAiLimit, aiLimitExceededResponse } from '@/lib/platform/usage-limits';

function reqId() {
  return 'req_' + nanoid(8);
}

const mediaIncludes = {
  folder: { select: { id: true, name: true, parentId: true } },
  uploadedBy: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

const ASPECT_MAP: Record<string, string> = {
  '1:1': '1024x1024',
  '16:9': '1344x768',
  '9:16': '768x1344',
  '4:3': '1152x864',
  '3:4': '864x1152',
};

export async function POST(request: NextRequest) {
  // Platform AI entitlement gate — this route runs EXCLUSIVELY on the
  // platform SDK (z-ai-web-dev-sdk), i.e. AI provided and paid for by
  // the platform. A Client's Own AI API-only plan gets no platform AI
  // access here (403); the plan must include Platform AI.
  const auth = await requireFeature(request, 'ai_platform');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    const body = await request.json();
    const { prompt, aspectRatio = '1:1', count = 1, folderId, uploadedById = 'system' } = body as {
      prompt: string;
      aspectRatio?: string;
      count?: number;
      folderId?: string | null;
      uploadedById?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const size = ASPECT_MAP[aspectRatio] || '1024x1024';
    const clampedCount = Math.min(Math.max(count, 1), 4);

    // Platform AI usage limit — images are counted per generated image,
    // enforced server-side before generating (the platform pays for the
    // SDK call). Client's Own AI API plans and owner bypass are never
    // counted.
    const aiLimit = await checkAiLimit(auth.user, { images: clampedCount });
    if (aiLimit && !aiLimit.ok) return aiLimitExceededResponse(aiLimit);

    // Dynamically import z-ai-web-dev-sdk
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = new ZAI({
      baseUrl: process.env.ZAI_BASE_URL || 'http://localhost:9999',
      apiKey: process.env.ZAI_API_KEY || 'default-key',
    });

    const siteFilter = await getSiteWhere(request);
    const siteId = (siteFilter.siteId as string) || request.nextUrl.searchParams.get('siteId') || undefined;

    const results = [];

    for (let i = 0; i < clampedCount; i++) {
      const res = await zai.images.generations.create({ prompt: prompt.trim(), size });

      for (const img of res.data || []) {
        const base64Url = `data:image/png;base64,${img.base64}`;
        const filename = `ai_${nanoid(8)}_${Date.now()}.png`;

        const item = await db.media.create({
          data: {
            filename,
            originalName: `AI: ${prompt.trim().slice(0, 60)}`,
            mimeType: 'image/png',
            size: Math.round((img.base64.length * 3) / 4),
            url: base64Url,
            folderId: folderId === '' ? null : folderId || null,
            siteId,
            uploadedById,
            processingStatus: 'READY',
          },
          include: mediaIncludes,
        });

        results.push(item);
      }
    }

    // The platform pays for the SDK call — count it in the Platform AI
    // monthly usage tracker (AiLog), using the same "[IMAGE] " marker +
    // imagesGenerated JSON convention as the ai-service image path.
    if (results.length > 0) {
      await db.aiLog
        .create({
          data: {
            providerId: null,
            providerName: 'Platform SDK (media)',
            modelId: null,
            question: `[IMAGE] ${prompt.trim()}`,
            response: JSON.stringify({
              imagesGenerated: results.length,
              size,
              format: 'b64_json',
              model: 'z-ai-web-dev-sdk',
            }),
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costUsd: 0,
            durationMs: null,
            status: 'success',
            siteId: siteId ?? null,
            userId: auth.user.id,
          },
        })
        .catch(() => {
          /* usage logging failure shouldn't mask the result */
        });
    }

    return NextResponse.json({ data: results, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[MEDIA:GENERATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate images' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
