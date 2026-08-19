'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// =====================================================================
// GET /api/ai/images/providers — Find providers capable of image generation
// =====================================================================

export async function GET() {
  const requestId = 'req_' + crypto.randomUUID().slice(0, 8);

  try {
    const providers = await db.aiProvider.findMany({
      where: {
        isActive: true,
        apiKeyEncrypted: { not: null },
        kind: { in: ['OPENAI', 'OPENROUTER', 'AZURE_OPENAI', 'GEMINI'] },
      },
      include: {
        models: {
          where: { isActive: true, supportsImages: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    const imageProviders = providers.map((p) => ({
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
