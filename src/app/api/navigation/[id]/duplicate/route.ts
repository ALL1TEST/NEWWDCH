// ============================================================
// POST /api/navigation/[id]/duplicate — Duplicate a navigation menu
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

function reassignItemIds(items: unknown[]): unknown[] {
  return items.map((item) => {
    const obj = item as Record<string, unknown>;
    const newItem = { ...obj, id: 'nav_item_' + nanoid(8) };
    if (Array.isArray(obj.children) && obj.children.length > 0) {
      newItem.children = reassignItemIds(obj.children);
    }
    return newItem;
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: navId } = await context.params;
    const siteFilter = await getSiteWhere(request);

    const navigation = await db.navigation.findFirst({
      where: { ...siteFilter, id: navId },
    });

    if (!navigation) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Navigation not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Deep clone items with new IDs
    let clonedItems: unknown[] = [];
    try {
      const parsed = JSON.parse(navigation.items);
      if (Array.isArray(parsed)) {
        clonedItems = reassignItemIds(parsed);
      }
    } catch {
      // ignore parse errors
    }

    const newSlug = `${navigation.slug}-copy-${nanoid(4)}`;
    const newName = `${navigation.name} Copy`;

    // Ensure unique slug
    let finalSlug = newSlug;
    let counter = 1;
    while (await db.navigation.findFirst({ where: { ...siteFilter, slug: finalSlug } })) {
      finalSlug = `${newSlug}-${counter++}`;
    }

    const duplicated = await db.navigation.create({
      data: {
        name: newName,
        slug: finalSlug,
        description: navigation.description,
        items: JSON.stringify(clonedItems),
        location: null, // Don't duplicate location assignment
        status: 'DRAFT' as const,
        isActive: true,
        siteId: navigation.siteId,
      },
    });

    return NextResponse.json({ data: duplicated, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[NAVIGATION:DUPLICATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to duplicate navigation' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
