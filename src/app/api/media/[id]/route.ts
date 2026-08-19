// ============================================================
// GET    /api/media/[id] — Get single media
// PATCH  /api/media/[id] — Update media
// DELETE /api/media/[id] — Soft-delete media
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const mediaIncludes = {
  folder: { select: { id: true, name: true, parentId: true } },
  uploadedBy: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  alt: z.string().trim().optional().or(z.literal('')),
  caption: z.string().max(500).trim().optional().or(z.literal('')),
  folderId: z.string().optional().or(z.literal('')),
  seoTitle: z.string().max(200).trim().optional().or(z.literal('')),
  metaDescription: z.string().max(500).trim().optional().or(z.literal('')),
  focusKeywords: z.string().max(1000).trim().optional().or(z.literal('')),
  imageDescription: z.string().max(2000).trim().optional().or(z.literal('')),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: mediaId } = await context.params;

    const item = await db.media.findFirst({
      where: { id: mediaId, deletedAt: null },
      include: mediaIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Media not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MEDIA:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch media' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: mediaId } = await context.params;

    const existing = await db.media.findFirst({ where: { id: mediaId, deletedAt: null } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Media not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
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
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (d.alt !== undefined) updateData.alt = d.alt === '' ? null : d.alt;
    if (d.caption !== undefined) updateData.caption = d.caption === '' ? null : d.caption;
    if (d.folderId !== undefined) updateData.folderId = d.folderId === '' ? null : d.folderId;
    if (d.seoTitle !== undefined) updateData.seoTitle = d.seoTitle === '' ? null : d.seoTitle;
    if (d.metaDescription !== undefined) updateData.metaDescription = d.metaDescription === '' ? null : d.metaDescription;
    if (d.focusKeywords !== undefined) updateData.focusKeywords = d.focusKeywords === '' ? null : d.focusKeywords;
    if (d.imageDescription !== undefined) updateData.imageDescription = d.imageDescription === '' ? null : d.imageDescription;

    const item = await db.media.update({
      where: { id: mediaId },
      data: updateData,
      include: mediaIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MEDIA:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update media' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — soft delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: mediaId } = await context.params;

    const existing = await db.media.findFirst({ where: { id: mediaId, deletedAt: null } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Media not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.media.update({
      where: { id: mediaId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: { id: mediaId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MEDIA:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete media' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
