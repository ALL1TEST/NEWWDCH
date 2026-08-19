// ============================================================
// POST /api/redirects/hit — Increment hit count for a fromPath
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

const hitSchema = z.object({
  fromPath: z.string().min(1, 'fromPath is required').trim(),
});

export async function POST(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const parsed = hitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { requestId: id, timestamp: new Date().toISOString() },
        },
        { status: 400 },
      );
    }

    const { fromPath } = parsed.data;
    const siteFilter = await getSiteWhere(request);

    const redirect = await db.redirect.findFirst({
      where: { ...siteFilter, fromPath, isActive: true },
    });

    if (!redirect) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No active redirect found for this path' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    const updated = await db.redirect.update({
      where: { id: redirect.id },
      data: { hitCount: { increment: 1 } },
    });

    return NextResponse.json({ data: { fromPath, toPath: updated.toPath, hitCount: updated.hitCount }, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[REDIRECTS:HIT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to record hit' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
