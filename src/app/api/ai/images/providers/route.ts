'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFeatureAllowStaff, isPlatformStaff } from '@/lib/platform/platform-auth';

// =====================================================================
// GET /api/ai/images/providers — Find providers capable of image generation
// =====================================================================
// OpenAI, Gemini, and Custom (OpenAI-compatible) providers support image
// generation. A provider qualifies if it's active, has an API key, and has
// at least one active IMAGE-type model.
//
// Connection-management data: platform staff see the platform
// infrastructure; ai_client clients see ONLY their own connections.

export async function GET(request: NextRequest) {
  const requestId = 'req_' + crypto.randomUUID().slice(0, 8);

  const featureAuth = await requireFeatureAllowStaff(request, 'ai_client');
  if ('response' in featureAuth) return featureAuth.response;
  const staff = isPlatformStaff(featureAuth.user);

  try {
    const where: Record<string, unknown> = {
      isActive: true,
      apiKeyEncrypted: { not: null },
      kind: { in: ['OPENAI', 'GEMINI', 'CUSTOM'] },
    };
    // Non-staff callers (Client's Own AI API) only ever see their own
    // provider connections.
    if (!staff) where.createdById = featureAuth.user.id;

    const providers = await db.aiProvider.findMany({
      where,
      include: {
        models: {
          where: { isActive: true, type: 'IMAGE' },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    // Filter out providers that have no image models after all
    const imageProviders = providers
      .filter((p) => p.models.length > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        isDefault: p.isDefault,
        models: p.models.map((m) => ({
          id: m.id,
          modelId: m.modelId,
          name: m.name,
          isDefault: m.isDefault,
        })),
      }));

    return NextResponse.json({
      data: imageProviders,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error(`[AI/IMAGES/PROVIDERS] ${requestId} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch image providers' }, meta: { requestId, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
