// ============================================================
// GET /api/seo/social-preview?resourceId=xxx — Social preview data
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const resourceId = sp.get('resourceId');

    if (!resourceId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAM', message: 'resourceId query parameter is required' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const siteFilter = await getSiteWhere(request);

    const contentItem = await db.contentItem.findFirst({
      where: { id: resourceId, deletedAt: null },
      include: {
        author: { select: { name: true } },
        authorProfile: { select: { displayName: true } },
        featuredImage: { select: { url: true } },
        seoImage: { select: { url: true } },
        category: { select: { name: true, slug: true } },
      },
    });

    if (!contentItem) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content item not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    // Fetch SEO config for OG overrides
    const seoConfig = await db.seoConfig.findFirst({
      where: { resourceType: 'content', resourceId: contentItem.id, ...siteFilter },
      include: {
        ogImage: { select: { url: true } },
      },
    });

    // Fetch site info
    const site = siteFilter.siteId
      ? await db.site.findFirst({
          where: { id: siteFilter.siteId },
          select: { name: true, domain: true },
        })
      : await db.site.findFirst({
          select: { name: true, domain: true },
        });

    const domain = site?.domain || 'example.com';
    const siteName = site?.name || '';
    const pageUrl = `https://${domain}/${contentItem.slug}`;

    // Build social preview data
    const ogTitle = seoConfig?.ogTitle || contentItem.seoTitle || contentItem.title;
    const ogDescription = seoConfig?.ogDescription || contentItem.seoDescription || contentItem.excerpt || '';
    const ogImage = seoConfig?.ogImage?.url || contentItem.seoImage?.url || contentItem.featuredImage?.url || '';

    const data = {
      ogTitle,
      ogDescription,
      ogImage,
      ogUrl: pageUrl,
      ogType: 'article',
      ogSiteName: siteName,
      twitterCard: 'summary_large_image',
      twitterTitle: ogTitle,
      twitterDescription: ogDescription,
      twitterImage: ogImage,
      pageUrl,
      domain,
    };

    return NextResponse.json({
      data,
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:SOCIAL-PREVIEW] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch social preview' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
