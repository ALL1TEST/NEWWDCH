// ============================================================
// GET /api/content/[id]/reviews — List review assignments for a content item
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — list review assignments
// =====================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: contentId } = await context.params;
    const siteFilter = await getSiteWhere(request);

    const contentItem = await db.contentItem.findFirst({
      where: { ...siteFilter, id: contentId, deletedAt: null },
    });
    if (!contentItem) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content item not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    const reviews = await db.reviewAssignment.findMany({
      where: { contentItemId: contentId },
      include: {
        reviewer: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: reviews, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CONTENT:REVIEWS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch review assignments' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
