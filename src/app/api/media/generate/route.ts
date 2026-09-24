// ============================================================
// POST /api/media/generate — AI image generation via z-ai-web-dev-sdk
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';
import { checkAiLimit, aiLimitExceededResponse } from '@/lib/platform/usage-limits';
import { resolvePlatformPrompt } from '@/lib/ai/platform-ai';

import { isPlatformStaff } from '@/lib/platform/platform-auth';
import { canProviderSupportImageGeneration, isModelForbiddenForImageGeneration, parseCapabilities } from '@/lib/ai/providers';
import { executeImageGeneration } from '@/lib/ai/ai-service';

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
  // Platform AI entitlement gate
  const auth = await requireFeature(request, 'ai_platform');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    const body = await request.json();
    const { prompt, aspectRatio = '1:1', count = 1, folderId, uploadedById } = body as {
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

    const uploaderId = uploadedById && uploadedById !== 'system' ? uploadedById : auth.user.id;
    const size = ASPECT_MAP[aspectRatio] || '1024x1024';
    const clampedCount = Math.min(Math.max(count, 1), 4);

    const aiLimit = await checkAiLimit(auth.user, { images: clampedCount });
    if (aiLimit && !aiLimit.ok) return aiLimitExceededResponse(aiLimit);

    // Determine if the user explicitly requested text on the image
    const wantsText =
      /\b(?:with\s+text|text\s+(?:saying|written|overlay)|written\s+on\s+it|typography|letters|quote|sign|caption|كتابة|مكتوب|نص)\b/i.test(
        prompt,
      );

    let effectivePrompt = prompt.trim();
    if (!wantsText && !/no\s+(?:text|words|letters|typography)/i.test(effectivePrompt)) {
      effectivePrompt = `${effectivePrompt}, clean photography, high quality, photorealistic, no text, no words, no letters, no typography, no captions, no watermark, no labels`;
    }

    const siteFilter = await getSiteWhere(request);
    let resolvedSiteId: string | undefined = undefined;
    const querySiteId = request.nextUrl.searchParams.get('siteId');
    if (typeof querySiteId === 'string' && querySiteId.trim() && querySiteId !== 'all') {
      resolvedSiteId = querySiteId.trim();
    } else if (typeof siteFilter.siteId === 'string' && !siteFilter.siteId.startsWith('__')) {
      resolvedSiteId = siteFilter.siteId;
    } else if (siteFilter.siteId && typeof siteFilter.siteId === 'object' && 'in' in (siteFilter.siteId as any)) {
      const inArr = (siteFilter.siteId as any).in;
      if (Array.isArray(inArr) && inArr.length > 0 && typeof inArr[0] === 'string') {
        resolvedSiteId = inArr[0];
      }
    }
    const siteId = resolvedSiteId;

    // Resolve Image Provider & Model:
    // 1. User settings (if client has BYOK / own configured image provider)
    // 2. Global settings (Platform AI configured in Platform Admin)
    // 3. System default image model (isDefaultImage: true)
    // 4. Any active Cloudflare provider with active image models
    // 5. Any active image provider
    const isStaff = isPlatformStaff(auth.user);
    const userScope = isStaff ? 'global' : `user:${auth.user.id}`;
    const userSettings = await db.aiSettings.findUnique({ where: { scope: userScope } });
    const globalSettings = await db.aiSettings.findUnique({ where: { scope: 'global' } });

    const isModelValid = (m: { isActive: boolean; capabilities?: string | null; type?: string; modelId: string; provider?: { kind?: string } }) => {
      if (!m.isActive) return false;
      const caps = parseCapabilities(m.capabilities ?? (m.type === 'IMAGE' ? ['IMAGE_GENERATION'] : ['TEXT_GENERATION']));
      if (!caps.includes('IMAGE_GENERATION')) return false;
      if (m.provider?.kind && !canProviderSupportImageGeneration(m.provider.kind)) return false;
      const forbidden = isModelForbiddenForImageGeneration(m.provider?.kind ?? '', m.modelId);
      if (forbidden.forbidden) return false;
      return true;
    };

    let targetProviderId: string | null = null;
    let targetModelId: string | null = null;

    // 1. User settings check (if client BYOK or configured)
    if (userSettings?.imageProviderId) {
      const p = await db.aiProvider.findFirst({
        where: { id: userSettings.imageProviderId, isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: { where: { isActive: true } } },
      });
      if (p && canProviderSupportImageGeneration(p.kind)) {
        const m = userSettings.imageModelId
          ? p.models.find((model) => (model.id === userSettings.imageModelId || model.modelId === userSettings.imageModelId) && isModelValid({ ...model, provider: p }))
          : null;
        if (m) {
          targetProviderId = p.id;
          targetModelId = m.id;
        } else {
          const defM = p.models.find((model) => model.isDefaultImage && isModelValid({ ...model, provider: p }))
            ?? p.models.find((model) => model.modelId.includes('flux-1-schnell') && isModelValid({ ...model, provider: p }))
            ?? p.models.find((model) => isModelValid({ ...model, provider: p }));
          if (defM) {
            targetProviderId = p.id;
            targetModelId = defM.id;
          }
        }
      }
    }

    // 2. Global settings check (Platform AI)
    if (!targetProviderId && globalSettings?.imageProviderId) {
      const p = await db.aiProvider.findFirst({
        where: { id: globalSettings.imageProviderId, isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: { where: { isActive: true } } },
      });
      if (p && canProviderSupportImageGeneration(p.kind)) {
        const m = globalSettings.imageModelId
          ? p.models.find((model) => (model.id === globalSettings.imageModelId || model.modelId === globalSettings.imageModelId) && isModelValid({ ...model, provider: p }))
          : null;
        if (m) {
          targetProviderId = p.id;
          targetModelId = m.id;
        } else {
          const defM = p.models.find((model) => model.isDefaultImage && isModelValid({ ...model, provider: p }))
            ?? p.models.find((model) => model.modelId.includes('flux-1-schnell') && isModelValid({ ...model, provider: p }))
            ?? p.models.find((model) => isModelValid({ ...model, provider: p }));
          if (defM) {
            targetProviderId = p.id;
            targetModelId = defM.id;
          }
        }
      }
    }

    // 3. System default image model (isDefaultImage: true on active provider)
    if (!targetProviderId) {
      const defaultImageModel = await db.aiModel.findFirst({
        where: {
          isDefaultImage: true,
          isActive: true,
          provider: { isActive: true, apiKeyEncrypted: { not: null } },
        },
        include: { provider: true },
        orderBy: [
          { provider: { isDefault: 'desc' } },
          { updatedAt: 'desc' },
        ],
      });
      if (defaultImageModel && isModelValid(defaultImageModel)) {
        targetProviderId = defaultImageModel.providerId;
        targetModelId = defaultImageModel.id;
      }
    }

    // 4. Any active Cloudflare provider with active image models
    if (!targetProviderId) {
      const cfProvider = await db.aiProvider.findFirst({
        where: { kind: 'CLOUDFLARE', isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: { where: { isActive: true } } },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      });
      if (cfProvider && cfProvider.models.length > 0) {
        const m = cfProvider.models.find((model) => model.isDefaultImage && isModelValid({ ...model, provider: cfProvider }))
          ?? cfProvider.models.find((model) => model.modelId.includes('flux-1-schnell') && isModelValid({ ...model, provider: cfProvider }))
          ?? cfProvider.models.find((model) => isModelValid({ ...model, provider: cfProvider }));
        if (m) {
          targetProviderId = cfProvider.id;
          targetModelId = m.id;
        }
      }
    }

    // 5. Any other active provider that supports image generation
    if (!targetProviderId) {
      const otherProviders = await db.aiProvider.findMany({
        where: { isActive: true, apiKeyEncrypted: { not: null } },
        include: { models: { where: { isActive: true } } },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      });
      for (const p of otherProviders) {
        if (canProviderSupportImageGeneration(p.kind)) {
          const m = p.models.find((model) => model.isDefaultImage && isModelValid({ ...model, provider: p }))
            ?? p.models.find((model) => isModelValid({ ...model, provider: p }));
          if (m) {
            targetProviderId = p.id;
            targetModelId = m.id;
            break;
          }
        }
      }
    }

    if (!targetProviderId) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_IMAGE_PROVIDER_CONFIGURED',
            message: 'No active AI Image Provider or Model configured. Please configure an image provider (such as Cloudflare) under Platform Admin > AI.',
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const results = [];

    // Use configured / resolved AI Provider and Model
    const imgRes = await executeImageGeneration({
      providerId: targetProviderId,
      modelId: targetModelId ?? undefined,
      prompt: effectivePrompt,
      size: (size as any) || '1024x1024',
      n: clampedCount,
      responseFormat: 'b64_json',
      siteId,
      userId: auth.user.id,
    });

    for (const img of imgRes.images) {
      const base64Url = img.b64_json
        ? (img.b64_json.startsWith('data:') ? img.b64_json : `data:image/png;base64,${img.b64_json}`)
        : (img.url || '');
      const filename = `ai_${nanoid(8)}_${Date.now()}.png`;

      const item = await db.media.create({
        data: {
          filename,
          originalName: `AI: ${prompt.trim().slice(0, 60)}`,
          mimeType: 'image/png',
          size: Math.round((base64Url.length * 3) / 4),
          url: base64Url,
          folderId: folderId === '' ? null : folderId || null,
          siteId,
          uploadedById: uploaderId,
          processingStatus: 'READY',
        },
        include: mediaIncludes,
      });

      results.push(item);
    }

    return NextResponse.json({ data: results, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : 'Failed to generate images';
    console.error(`[MEDIA:GENERATE] ${id} —`, error);
    const msg = rawMsg.includes('.z-ai-config')
      ? 'No active AI Image Provider or Model configured. Please configure an image provider (such as Cloudflare) under Platform Admin > AI.'
      : rawMsg;
    const isClientError = /does not support|not found|disabled|invalid|configured/i.test(msg);
    return NextResponse.json(
      { error: { code: 'IMAGE_GENERATION_ERROR', message: msg }, meta: { requestId: id } },
      { status: isClientError ? 400 : 500 },
    );
  }
}
