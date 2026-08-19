// ============================================================
// PATCH  /api/navigation/[id]/items/[itemId] — Update a nav item
// DELETE /api/navigation/[id]/items/[itemId] — Remove a nav item
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

const updateItemSchema = z.object({
  label: z.string().max(200).optional(),
  type: z.enum(['PAGE_LINK', 'CATEGORY_LINK', 'CUSTOM_URL', 'SEPARATOR', 'DROPDOWN', 'CONTENT_REFERENCE']).optional(),
  url: z.string().optional(),
  pageId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  contentId: z.string().optional().nullable(),
  tagId: z.string().optional().nullable(),
  target: z.string().optional(),
  parentId: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  icon: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  cssClass: z.string().optional().nullable(),
  children: z.array(z.unknown()).optional(),
});

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

// ---------- helper to recursively find/update/delete items -----------

type NavItem = Record<string, unknown>;

function findAndRemoveItem(items: NavItem[], itemId: string, removeChildren: boolean): { items: NavItem[]; removed: boolean; movedChildren?: NavItem[] } {
  let removed = false;
  let movedChildren: NavItem[] | undefined;

  const result: NavItem[] = [];
  for (const item of items) {
    if (item.id === itemId) {
      removed = true;
      if (!removeChildren && Array.isArray(item.children) && item.children.length > 0) {
        // Move children to parent level
        movedChildren = item.children as NavItem[];
        result.push(...(item.children as NavItem[]));
      }
      continue;
    }
    if (Array.isArray(item.children) && item.children.length > 0) {
      const { items: newChildren, removed: childRemoved, movedChildren: mc } = findAndRemoveItem(
        item.children as NavItem[],
        itemId,
        removeChildren,
      );
      if (childRemoved) {
        removed = true;
        if (mc) {
          // Move children up to this level
          const idx = result.length;
          result.push({ ...item, children: newChildren });
          result.splice(idx + 1, 0, ...mc);
          continue;
        }
      }
      result.push({ ...item, children: newChildren });
      continue;
    }
    result.push(item);
  }
  return { items: result, removed, movedChildren };
}

function findAndUpdateItem(items: NavItem[], itemId: string, updates: Record<string, unknown>): { items: NavItem[]; updated: boolean } {
  let updated = false;

  const result = items.map((item) => {
    if (item.id === itemId) {
      updated = true;
      const merged = { ...item };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          merged[key] = value;
        }
      }
      return merged;
    }
    if (Array.isArray(item.children) && item.children.length > 0) {
      const { items: newChildren, updated: childUpdated } = findAndUpdateItem(
        item.children as NavItem[],
        itemId,
        updates,
      );
      if (childUpdated) updated = true;
      return { ...item, children: newChildren };
    }
    return item;
  });

  return { items: result, updated };
}

// =====================================================================
// PATCH — update navigation item
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: navId, itemId } = await context.params;

    const navigation = await db.navigation.findUnique({ where: { id: navId } });
    if (!navigation) {
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

    const parsed = updateItemSchema.safeParse(body);
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

    let items: NavItem[] = [];
    try {
      items = JSON.parse(navigation.items);
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    const updates: Record<string, unknown> = { ...parsed.data };

    const { items: newItems, updated } = findAndUpdateItem(items, itemId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Navigation item not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    const result = await db.navigation.update({
      where: { id: navId },
      data: { items: JSON.stringify(newItems) },
    });

    return NextResponse.json({ data: result, meta: { requestId: id } });
  } catch (error) {
    console.error(`[NAVIGATION:UPDATE_ITEM] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update navigation item' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — remove navigation item
// =====================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: navId, itemId } = await context.params;

    const navigation = await db.navigation.findUnique({ where: { id: navId } });
    if (!navigation) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Navigation not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    let items: NavItem[] = [];
    try {
      items = JSON.parse(navigation.items);
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    // Check if the request wants to remove children or keep them
    const sp = new URL(request.url).searchParams;
    const removeChildren = sp.get('removeChildren') === 'true';

    const { items: newItems, removed } = findAndRemoveItem(items, itemId, removeChildren);
    if (!removed) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Navigation item not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    const result = await db.navigation.update({
      where: { id: navId },
      data: { items: JSON.stringify(newItems) },
    });

    return NextResponse.json({ data: { id: itemId, removed: true, navigation: result }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[NAVIGATION:DELETE_ITEM] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to remove navigation item' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
