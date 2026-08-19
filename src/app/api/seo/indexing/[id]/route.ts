// ============================================================
// PATCH  /api/seo/indexing/[id] — Update indexing record status
// DELETE /api/seo/indexing/[id] — Remove indexing record
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  status: z.enum(['INDEXED', 'PENDING', 'EXCLUDED', 'DISCOVERED', 'ERROR']).optional(),
  lastCrawl: z.string().datetime({ offset: true }).optional(),
  lastIndexed: z.string().datetime({ offset: true }).optional(),
  coverageError: z.string().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  pageUrl: z.string().min(1).max(2048).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// PATCH — update status
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: recordId } = await context.params;

    const existing = await db.indexingRecord.findUnique({ where: { id: recordId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Indexing record not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
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
    if (d.status !== undefined) updateData.status = d.status;
    if (d.lastCrawl !== undefined) updateData.lastCrawl = new Date(d.lastCrawl);
    if (d.lastIndexed !== undefined) updateData.lastIndexed = new Date(d.lastIndexed);
    if (d.coverageError !== undefined) updateData.coverageError = d.coverageError;
    if (d.title !== undefined) updateData.title = d.title;
    if (d.pageUrl !== undefined) updateData.pageUrl = d.pageUrl;

    // If requesting indexing, set status to PENDING
    const sp = new URL(request.url).searchParams;
    if (sp.get('action') === 'request-indexing') {
      updateData.status = 'PENDING';
    }

    const item = await db.indexingRecord.update({
      where: { id: recordId },
      data: updateData,
    });

    return NextResponse.json({ data: item, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[SEO:INDEXING:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update indexing record' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — remove record
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: recordId } = await context.params;

    const existing = await db.indexingRecord.findUnique({ where: { id: recordId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Indexing record not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    await db.indexingRecord.delete({ where: { id: recordId } });

    return NextResponse.json({ data: { id: recordId, deleted: true }, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[SEO:INDEXING:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete indexing record' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
