// ============================================================
// GET /api/seo/overview/detail?type=X
// Returns filtered content items for SEO Overview metric cards
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';

const VALID_TYPES = new Set([
  'missing-meta-title',
  'missing-meta-description',
  'missing-h1',
  'duplicate-titles',
  'duplicate-descriptions',
  'missing-canonicals',
  'canonical-issues',
]);

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const type = sp.get('type');

    if (!type || !VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing type parameter' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const siteFilter = await getSiteWhere(request);
    const baseWhere = { ...siteFilter, deletedAt: null, status: 'PUBLISHED' };

    // Fetch published content items
    const items = await db.contentItem.findMany({
      where: baseWhere,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    // Fetch SEO configs for these items
    const resourceIds = items.map((i) => i.id);
    const configs = resourceIds.length > 0
      ? await db.seoConfig.findMany({
          where: { resourceType: 'content', resourceId: { in: resourceIds }, ...siteFilter },
          select: { resourceId: true, canonicalUrl: true, structuredData: true },
        })
      : [];

    return NextResponse.json({
      data: { items, configs },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:OVERVIEW:DETAIL] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SEO detail data' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
