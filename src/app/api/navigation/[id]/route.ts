// ============================================================
// GET    /api/navigation/[id]       — Get single navigation
// PATCH  /api/navigation/[id]       — Update navigation
// DELETE /api/navigation/[id]       — Delete navigation
// POST   /api/navigation/[id]/duplicate — Duplicate navigation
// POST   /api/navigation/[id]/publish   — Publish navigation
// POST   /api/navigation/[id]/validate  — Validate navigation items
// =====================================================================

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
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim().optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).trim().optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  items: z.string().min(1, 'Items JSON is required').optional(),
  location: z.enum(['HEADER', 'SECONDARY', 'FOOTER', 'MOBILE']).optional().nullable(),
  status: z.enum(['ACTIVE', 'DRAFT', 'DISABLED']).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: navId } = await context.params;

    const item = await db.navigation.findUnique({
      where: { id: navId },
      include: { site: { select: { id: true, name: true, slug: true } } },
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Navigation not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[NAVIGATION:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch navigation' }, meta: { requestId: id } },
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
    const { id: navId } = await context.params;

    const existing = await db.navigation.findUnique({ where: { id: navId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Navigation not found' }, meta: { requestId: id } },
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

    // Validate that items is valid JSON if provided
    if (d.items !== undefined) {
      try {
        const parsed = JSON.parse(d.items);
        if (!Array.isArray(parsed)) throw new Error();
      } catch {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Items must be a valid JSON array' }, meta: { requestId: id } },
          { status: 400 },
        );
      }
    }

    // Check slug uniqueness if being changed
    if (d.slug !== undefined && d.slug !== existing.slug) {
      const slugExists = await db.navigation.findFirst({ where: { slug: d.slug, id: { not: navId } } });
      if (slugExists) {
        return NextResponse.json(
          { error: { code: 'CONFLICT', message: 'A navigation menu with this slug already exists' }, meta: { requestId: id } },
          { status: 409 },
        );
      }
    }

    // Check location uniqueness per site
    if (d.location !== undefined && d.location !== null) {
      const locExisting = await db.navigation.findFirst({
        where: { location: d.location, siteId: existing.siteId, id: { not: navId } },
      });
      if (locExisting) {
        return NextResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: `Location "${d.location}" is already assigned to menu "${locExisting.name}". Unassign it first.`,
            },
            meta: { requestId: id },
          },
          { status: 409 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (d.name !== undefined) updateData.name = d.name;
    if (d.slug !== undefined) updateData.slug = d.slug;
    if (d.description !== undefined) updateData.description = d.description === '' ? null : d.description;
    if (d.items !== undefined) updateData.items = d.items;
    if (d.location !== undefined) updateData.location = d.location;
    if (d.status !== undefined) updateData.status = d.status;
    if (d.isActive !== undefined) updateData.isActive = d.isActive;

    const item = await db.navigation.update({ where: { id: navId }, data: updateData });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[NAVIGATION:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update navigation' }, meta: { requestId: id } },
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
    const { id: navId } = await context.params;

    const existing = await db.navigation.findUnique({ where: { id: navId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Navigation not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.navigation.delete({ where: { id: navId } });

    return NextResponse.json({ data: { id: navId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[NAVIGATION:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete navigation' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
