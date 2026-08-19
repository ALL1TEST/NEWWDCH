// ============================================================
// PATCH  /api/seo/broken-links/[id] — Update broken link status
// DELETE /api/seo/broken-links/[id] — Remove broken link
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  brokenUrl: z.string().min(1).max(2048).optional(),
  sourcePage: z.string().min(1).max(2048).optional(),
  statusCode: z.number().int().optional(),
  linkType: z.enum(['INTERNAL', 'EXTERNAL', 'IMAGE', 'PDF', 'ANCHOR']).optional(),
  status: z.enum(['BROKEN', 'IGNORED', 'FIXED']).optional(),
  anchorText: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// PATCH — update status (fix, ignore, recheck)
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: linkId } = await context.params;

    const existing = await db.brokenLink.findUnique({ where: { id: linkId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Broken link not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const parsed = updateSchema.safeParse(body);
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

    const d = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (d.brokenUrl !== undefined) updateData.brokenUrl = d.brokenUrl;
    if (d.sourcePage !== undefined) updateData.sourcePage = d.sourcePage;
    if (d.statusCode !== undefined) updateData.statusCode = d.statusCode;
    if (d.linkType !== undefined) updateData.linkType = d.linkType;
    if (d.status !== undefined) updateData.status = d.status;
    if (d.anchorText !== undefined) updateData.anchorText = d.anchorText;

    const item = await db.brokenLink.update({
      where: { id: linkId },
      data: updateData,
    });

    return NextResponse.json({ data: item, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[SEO:BROKEN_LINKS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update broken link' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — remove
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: linkId } = await context.params;

    const existing = await db.brokenLink.findUnique({ where: { id: linkId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Broken link not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    await db.brokenLink.delete({ where: { id: linkId } });

    return NextResponse.json({ data: { id: linkId, deleted: true }, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[SEO:BROKEN_LINKS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete broken link' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
