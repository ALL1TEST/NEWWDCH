// ============================================================
// GET /api/content/[id]/versions — List versions for a content item
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
// GET — list versions
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

    const versions = await db.contentVersion.findMany({
      where: { contentItemId: contentId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });

    return NextResponse.json({ data: versions, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CONTENT:VERSIONS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content versions' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
