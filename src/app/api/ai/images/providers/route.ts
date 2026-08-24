'use server';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// =====================================================================
// GET /api/ai/images/providers — Find providers capable of image generation
// =====================================================================
// Only OpenAI and Gemini support image generation among the 5 supported kinds.
// A provider qualifies if it's active, has an API key, and has at least one
// active IMAGE-type model.

export async function GET() {
  const requestId = 'req_' + crypto.randomUUID().slice(0, 8);

  try {
    const providers = await db.aiProvider.findMany({
      where: {
        isActive: true,
        apiKeyEncrypted: { not: null },
        kind: { in: ['OPENAI', 'GEMINI'] },
      },
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
