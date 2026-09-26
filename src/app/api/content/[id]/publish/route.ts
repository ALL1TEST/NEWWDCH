// ============================================================
// POST /api/content/[id]/publish — Publish/sync article to connected external site
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { publishArticleToConnectedSite } from '@/lib/connection/site-publisher';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: contentId } = await context.params;

    const existing = await db.contentItem.findFirst({
      where: { id: contentId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content item not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    let siteId = existing.siteId;
    let body: any = {};
    try {
      body = await request.json().catch(() => ({}));
      if (body?.siteId) siteId = body.siteId;
    } catch {}

    // First ensure latest state and published status are persisted in DB
    const updateData: Record<string, unknown> = {
      status: 'PUBLISHED',
      publishedAt: existing.publishedAt || new Date(),
      siteId: siteId || existing.siteId,
    };
    if (body?.title !== undefined) updateData.title = body.title;
    if (body?.slug !== undefined) updateData.slug = body.slug;
    if (body?.content !== undefined) updateData.content = body.content === '' || body.content === null ? null : body.content;
    if (body?.excerpt !== undefined) updateData.excerpt = body.excerpt === '' || body.excerpt === null ? null : body.excerpt;
    if (body?.featuredImageId !== undefined) updateData.featuredImageId = body.featuredImageId === '' || body.featuredImageId === null ? null : body.featuredImageId;
    if (body?.categoryId !== undefined) updateData.categoryId = body.categoryId === '' || body.categoryId === null ? null : body.categoryId;
    if (body?.seoTitle !== undefined) updateData.seoTitle = body.seoTitle === '' || body.seoTitle === null ? null : body.seoTitle;
    if (body?.seoDescription !== undefined) updateData.seoDescription = body.seoDescription === '' || body.seoDescription === null ? null : body.seoDescription;

    const updated = await db.contentItem.update({
      where: { id: contentId },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true } },
        featuredImage: { select: { id: true, url: true, alt: true } },
      },
    });

    // Now sync to external connected site
    const syncResult = await publishArticleToConnectedSite(contentId, siteId);

    return NextResponse.json({
      data: {
        item: updated,
        externalSync: syncResult,
      },
      meta: { requestId: id },
    });
  } catch (error: any) {
    console.error(`[CONTENT:PUBLISH] ${id} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'PUBLISH_FAILED',
          message: error.message || 'Failed to publish to external site',
        },
        meta: { requestId: id },
      },
      { status: 502 },
    );
  }
}
