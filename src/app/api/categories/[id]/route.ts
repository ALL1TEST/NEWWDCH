// ============================================================
// GET    /api/categories/[id] — Get single category
// PATCH  /api/categories/[id] — Update category
// DELETE /api/categories/[id] — Delete category
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const categoryIncludes = {
  parent: { select: { id: true, name: true, slug: true } },
  children: true,
  _count: { select: { content: true, children: true } },
} as const;

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim().optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).trim().optional(),
  description: z.string().max(1000).optional().or(z.literal('')),
  parentId: z.string().optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: categoryId } = await context.params;

    const item = await db.category.findUnique({
      where: { id: categoryId },
      include: categoryIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Category not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CATEGORIES:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch category' }, meta: { requestId: id } },
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
    const { id: categoryId } = await context.params;

    const existing = await db.category.findUnique({ where: { id: categoryId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Category not found' }, meta: { requestId: id } },
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
    if (d.parentId !== undefined) updateData.parentId = d.parentId === '' ? null : d.parentId;
    if (d.sortOrder !== undefined) updateData.sortOrder = d.sortOrder;

    const item = await db.category.update({
      where: { id: categoryId },
      data: updateData,
      include: categoryIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CATEGORIES:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update category' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — hard delete (with conflict check)
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: categoryId } = await context.params;

    const existing = await db.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { content: true, children: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Category not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    if (existing._count.children > 0) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'Cannot delete category with child categories' }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    await db.category.delete({ where: { id: categoryId } });

    return NextResponse.json({ data: { id: categoryId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CATEGORIES:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete category' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
