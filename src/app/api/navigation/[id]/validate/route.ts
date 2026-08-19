// ============================================================
// POST /api/navigation/[id]/validate — Validate navigation items
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

interface ValidationWarning {
  itemId: string;
  label: string;
  type: 'empty_label' | 'empty_url' | 'invalid_url' | 'broken_reference' | 'circular_hierarchy' | 'orphaned_parent';
  message: string;
  severity: 'warning' | 'error';
}

function checkCircularHierarchy(items: unknown[]): boolean {
  const idSet = new Set<string>();
  const collectIds = (arr: unknown[]): void => {
    for (const item of arr) {
      const obj = item as Record<string, unknown>;
      if (obj.id) idSet.add(String(obj.id));
      if (Array.isArray(obj.children)) collectIds(obj.children);
    }
  };
  collectIds(items);

  const checkParent = (arr: unknown[], parentId?: string): boolean => {
    for (const item of arr) {
      const obj = item as Record<string, unknown>;
      if (obj.parentId && String(obj.parentId) === obj.id) return true;
      if (obj.parentId && !idSet.has(String(obj.parentId))) return true;
      if (Array.isArray(obj.children)) {
        if (checkParent(obj.children, String(obj.id))) return true;
      }
    }
    return false;
  };
  return checkParent(items);
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

    const warnings: ValidationWarning[] = [];
    let items: unknown[] = [];

    try {
      items = JSON.parse(navigation.items);
      if (!Array.isArray(items)) items = [];
    } catch {
      return NextResponse.json(
        {
          data: {
            valid: false,
            warnings: [{ itemId: 'root', label: 'Menu', type: 'invalid_json' as const, message: 'Items is not valid JSON', severity: 'error' as const }],
          },
          meta: { requestId: id },
        },
      );
    }

    // Collect all IDs for parent validation
    const allItemIds = new Set<string>();
    const collectIds = (arr: unknown[]): void => {
      for (const item of arr) {
        const obj = item as Record<string, unknown>;
        if (obj.id) allItemIds.add(String(obj.id));
        if (Array.isArray(obj.children)) collectIds(obj.children);
      }
    };
    collectIds(items);

    // Collect referenced content IDs for bulk check
    const referencedPageIds = new Set<string>();
    const referencedContentIds = new Set<string>();
    const referencedCategoryIds = new Set<string>();

    // Validate each item
    const validateItems = (arr: unknown[], depth = 0): void => {
      for (const item of arr) {
        const obj = item as Record<string, unknown>;
        const itemId = String(obj.id || 'unknown');
        const label = String(obj.label || 'Untitled');
        const type = String(obj.type || 'CUSTOM_URL');

        // Check empty label (skip separators)
        if (type !== 'SEPARATOR' && (!obj.label || String(obj.label).trim() === '')) {
          warnings.push({ itemId, label, type: 'empty_label', message: 'Item has an empty label', severity: 'error' });
        }

        // Check URL requirements
        if (type === 'CUSTOM_URL') {
          if (!obj.url || String(obj.url).trim() === '') {
            warnings.push({ itemId, label, type: 'empty_url', message: 'Custom link has no URL', severity: 'error' });
          }
        }

        // Collect references for bulk validation
        if (obj.pageId) referencedPageIds.add(String(obj.pageId));
        if (obj.contentId) referencedContentIds.add(String(obj.contentId));
        if (obj.categoryId) referencedCategoryIds.add(String(obj.categoryId));

        // Check depth
        if (depth >= 3) {
          warnings.push({ itemId, label, type: 'orphaned_parent', message: 'Item exceeds maximum nesting depth (3 levels)', severity: 'warning' });
        }

        // Recurse
        if (Array.isArray(obj.children)) {
          validateItems(obj.children, depth + 1);
        }
      }
    };
    validateItems(items);

    // Bulk check referenced content exists
    if (referencedPageIds.size > 0) {
 const existingPages = await db.contentItem.findMany({
        where: { id: { in: Array.from(referencedPageIds) } },
        select: { id: true },
      });
      const existingPageIds = new Set(existingPages.map(p => p.id));
      for (const pageId of referencedPageIds) {
        if (!existingPageIds.has(pageId)) {
          warnings.push({
            itemId: 'unknown',
            label: `Page ${pageId}`,
            type: 'broken_reference',
            message: `Referenced page "${pageId}" no longer exists`,
            severity: 'error',
          });
        }
      }
    }

    if (referencedContentIds.size > 0) {
      const existingContent = await db.contentItem.findMany({
        where: { id: { in: Array.from(referencedContentIds) } },
        select: { id: true },
      });
      const existingContentIds = new Set(existingContent.map(c => c.id));
      for (const contentId of referencedContentIds) {
        if (!existingContentIds.has(contentId)) {
          warnings.push({
            itemId: 'unknown',
            label: `Content ${contentId}`,
            type: 'broken_reference',
            message: `Referenced content "${contentId}" no longer exists`,
            severity: 'error',
          });
        }
      }
    }

    if (referencedCategoryIds.size > 0) {
      const existingCats = await db.category.findMany({
        where: { id: { in: Array.from(referencedCategoryIds) } },
        select: { id: true },
      });
      const existingCatIds = new Set(existingCats.map(c => c.id));
      for (const catId of referencedCategoryIds) {
        if (!existingCatIds.has(catId)) {
          warnings.push({
            itemId: 'unknown',
            label: `Category ${catId}`,
            type: 'broken_reference',
            message: `Referenced category "${catId}" no longer exists`,
            severity: 'error',
          });
        }
      }
    }

    // Check circular hierarchy
    if (checkCircularHierarchy(items)) {
      warnings.push({
        itemId: 'root',
        label: 'Menu',
        type: 'circular_hierarchy',
        message: 'Circular or invalid parent references detected',
        severity: 'error',
      });
    }

    const hasErrors = warnings.some(w => w.severity === 'error');

    return NextResponse.json({
      data: {
        valid: !hasErrors,
        warnings,
        totalItems: allItemIds.size,
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[NAVIGATION:VALIDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to validate navigation' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
