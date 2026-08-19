// ============================================================
// POST /api/navigation/[id]/items — Add item to navigation menu
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- validation ------------------------------------------------

const addItemSchema = z.object({
  item: z.object({
    id: z.string().min(1).optional(),
    label: z.string().max(200).default(''),
    type: z.enum(['PAGE_LINK', 'CATEGORY_LINK', 'CUSTOM_URL', 'SEPARATOR', 'DROPDOWN', 'CONTENT_REFERENCE']).default('CUSTOM_URL'),
    url: z.string().default(''),
    pageId: z.string().optional(),
    categoryId: z.string().optional(),
    contentId: z.string().optional(),
    tagId: z.string().optional(),
    target: z.string().default('_self'),
    parentId: z.string().optional().nullable(),
    order: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
    icon: z.string().optional(),
    description: z.string().optional(),
    cssClass: z.string().optional(),
    children: z.array(z.unknown()).optional().default([]),
  }),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// POST — add navigation item
// =====================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: navId } = await context.params;
    const siteFilter = await getSiteWhere(request);

    const navigation = await db.navigation.findFirst({ where: { ...siteFilter, id: navId } });
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

    const parsed = addItemSchema.safeParse(body);
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

    let items: Record<string, unknown>[] = [];
    try {
      items = JSON.parse(navigation.items);
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    const newItem: Record<string, unknown> = {
      ...parsed.data.item,
      id: parsed.data.item.id || 'nav_item_' + nanoid(8),
    };

    // If item has a parentId, insert it into the parent's children array
    if (newItem.parentId) {
      const inserted = insertUnderParent(items, newItem.parentId, newItem);
      if (!inserted) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Parent item not found' }, meta: { requestId: id } },
          { status: 404 },
        );
      }
    } else {
      // Add as root item
      items.push(newItem);
    }

    const updated = await db.navigation.update({
      where: { id: navId },
      data: { items: JSON.stringify(items) },
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[NAVIGATION:ADD_ITEM] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to add navigation item' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

function insertUnderParent(
  items: Record<string, unknown>[],
  parentId: string,
  newItem: Record<string, unknown>,
): boolean {
  for (const item of items) {
    if (item.id === parentId) {
      if (!Array.isArray(item.children)) item.children = [];
      (item.children as Record<string, unknown>[]).push(newItem);
      return true;
    }
    if (Array.isArray(item.children)) {
      if (insertUnderParent(item.children as Record<string, unknown>[], parentId, newItem)) {
        return true;
      }
    }
  }
  return false;
}
