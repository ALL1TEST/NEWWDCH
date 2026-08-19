// ============================================================
// GET    /api/content-types/[id] — Get single content type
// PATCH  /api/content-types/[id] — Update content type
// DELETE /api/content-types/[id] — Delete content type
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim().optional(),
  slug: z.string().min(1, 'Slug is required').max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format').trim().optional(),
  description: z.string().max(1000).trim().optional().or(z.literal('')),
  icon: z.string().trim().optional().or(z.literal('')),
  fields: z.string().min(1).optional(),
  allowedStatuses: z.string().min(1).optional(),
  isBuiltIn: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

const typeIncludes = { _count: { select: { contentItems: true, fieldPermissions: true } } } as const;

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: typeId } = await context.params;

    const item = await db.contentType.findUnique({
      where: { id: typeId },
      include: typeIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content type not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CONTENT_TYPES:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content type' }, meta: { requestId: id } },
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
    const { id: typeId } = await context.params;

    const existing = await db.contentType.findUnique({ where: { id: typeId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content type not found' }, meta: { requestId: id } },
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
    if (d.name !== undefined) updateData.name = d.name;
    if (d.slug !== undefined) updateData.slug = d.slug;
    if (d.description !== undefined) updateData.description = d.description === '' ? null : d.description;
    if (d.icon !== undefined) updateData.icon = d.icon === '' ? null : d.icon;
    if (d.fields !== undefined) updateData.fields = d.fields;
    if (d.allowedStatuses !== undefined) updateData.allowedStatuses = d.allowedStatuses;
    if (d.isBuiltIn !== undefined) updateData.isBuiltIn = d.isBuiltIn;

    const item = await db.contentType.update({
      where: { id: typeId },
      data: updateData,
      include: typeIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CONTENT_TYPES:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update content type' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — hard delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: typeId } = await context.params;

    const existing = await db.contentType.findUnique({
      where: { id: typeId },
      include: { _count: { select: { contentItems: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content type not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    if (existing.isBuiltIn) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Cannot delete built-in content types' }, meta: { requestId: id } },
        { status: 403 },
      );
    }

    if (existing._count.contentItems > 0) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'Cannot delete content type with existing content items' }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    await db.contentType.delete({ where: { id: typeId } });

    return NextResponse.json({ data: { id: typeId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CONTENT_TYPES:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete content type' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
