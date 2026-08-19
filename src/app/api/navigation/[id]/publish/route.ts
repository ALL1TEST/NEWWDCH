// ============================================================
// POST /api/navigation/[id]/publish — Publish a navigation menu
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

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

    // Basic validation before publishing
    const warnings: string[] = [];

    try {
      const items = JSON.parse(navigation.items) as unknown[];
      if (!Array.isArray(items)) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Items must be a valid JSON array' }, meta: { requestId: id } },
          { status: 400 },
        );
      }

      // Check for items with empty labels
      const checkLabels = (arr: unknown[]): void => {
        for (const item of arr) {
          const obj = item as Record<string, unknown>;
          if (obj.type !== 'SEPARATOR' && (!obj.label || String(obj.label).trim() === '')) {
            warnings.push(`Item "${obj.id}" has an empty label`);
          }
          if (Array.isArray(obj.children)) checkLabels(obj.children);
        }
      };
      checkLabels(items);
    } catch {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Items must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const published = await db.navigation.update({
      where: { id: navId },
      data: {
        status: 'ACTIVE',
        isActive: true,
      },
    });

    return NextResponse.json({
      data: published,
      meta: { requestId: id },
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    console.error(`[NAVIGATION:PUBLISH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to publish navigation' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
