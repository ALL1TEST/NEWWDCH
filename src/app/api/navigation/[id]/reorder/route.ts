// ============================================================
// POST /api/navigation/[id]/reorder — Bulk reorder navigation items
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';
import { z } from 'zod/v4';

function reqId() {
  return 'req_' + nanoid(8);
}

const reorderSchema = z.object({
  items: z.array(z.unknown()).min(1, 'Items array is required'),
});

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = reorderSchema.safeParse(body);
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

    const result = await db.navigation.update({
      where: { id: navId },
      data: { items: JSON.stringify(parsed.data.items) },
    });

    return NextResponse.json({ data: result, meta: { requestId: id } });
  } catch (error) {
    console.error(`[NAVIGATION:REORDER] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to reorder navigation items' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
