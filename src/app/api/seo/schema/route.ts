// ============================================================
// GET /api/seo/schema?resourceId=xxx — Generate JSON-LD for content
// GET /api/seo/schema?type=site     — Generate site-level schemas
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const resourceId = sp.get('resourceId');
    const type = sp.get('type');
    const siteFilter = await getSiteWhere(request);

    // Fetch site info for base URLs
    const site = siteFilter.siteId
      ? await db.site.findFirst({
          where: { id: siteFilter.siteId },
          select: { name: true, domain: true, slug: true },
        })
      : await db.site.findFirst({
          select: { name: true, domain: true, slug: true },
        });

    const siteName = site?.name || undefined;
    const siteDomain = site?.domain;
    const siteUrl = siteDomain ? `https://${siteDomain}` : undefined;

    const schemas: { type: string; jsonLd: Record<string, unknown> }[] = [];

    // Site-level schemas (no resourceId)
    if (type === 'site' || !resourceId) {
      // WebSite schema
      if (siteName) {
        const websiteSchema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteName,
        };
        if (siteUrl) websiteSchema.url = siteUrl;
        schemas.push({ type: 'WebSite', jsonLd: websiteSchema });
      }

      // Organization schema
      if (siteName) {
        const orgSchema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: siteName,
        };
        if (siteUrl) orgSchema.url = siteUrl;
        schemas.push({ type: 'Organization', jsonLd: orgSchema });
      }

      return NextResponse.json({
        data: { schemas },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Resource-specific schemas
    const contentItem = await db.contentItem.findFirst({
      where: { id: resourceId, deletedAt: null },
      include: {
        author: { select: { name: true } },
        authorProfile: { select: { displayName: true } },
        featuredImage: { select: { url: true } },
        seoImage: { select: { url: true } },
        category: { select: { name: true, slug: true } },
        contentType: { select: { name: true } },
      },
    });

    if (!contentItem) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Content item not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    const pageUrl = siteDomain ? `https://${siteDomain}/${contentItem.slug}` : undefined;
    const imageUrl = contentItem.seoImage?.url || contentItem.featuredImage?.url || undefined;
    const authorName = contentItem.authorProfile?.displayName || contentItem.author?.name || undefined;
    const categoryName = contentItem.category?.name || contentItem.contentType?.name || undefined;
    const categorySlug = contentItem.category?.slug;
    const categoryUrl = siteDomain && categorySlug ? `https://${siteDomain}/${categorySlug}` : undefined;

    // 1. Article/BlogPosting schema
    const articleSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: contentItem.title,
    };

    const description = contentItem.seoDescription || contentItem.excerpt || undefined;
    if (description) articleSchema.description = description;
    if (imageUrl) articleSchema.image = imageUrl;
    if (contentItem.publishedAt) articleSchema.datePublished = contentItem.publishedAt.toISOString();
    articleSchema.dateModified = contentItem.updatedAt.toISOString();

    if (authorName) {
      articleSchema.author = { '@type': 'Person', name: authorName };
    }
    if (siteName) {
      articleSchema.publisher = { '@type': 'Organization', name: siteName };
    }
    if (pageUrl) articleSchema.mainEntityOfPage = pageUrl;

    schemas.push({ type: 'Article', jsonLd: articleSchema });

    // 2. BreadcrumbList schema
    const breadcrumbItems: { '@type': string; position: number; name: string; item?: string }[] = [];

    // Home
    const homeItem: { '@type': string; position: number; name: string; item?: string } = {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
    };
    if (siteUrl) homeItem.item = siteUrl;
    breadcrumbItems.push(homeItem);

    // Category
    if (categoryName && categoryUrl) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: 2,
        name: categoryName,
        item: categoryUrl,
      });
    }

    // Current page
    const pagePosition = breadcrumbItems.length + 1;
    const pageItem: { '@type': string; position: number; name: string; item?: string } = {
      '@type': 'ListItem',
      position: pagePosition,
      name: contentItem.title,
    };
    if (pageUrl) pageItem.item = pageUrl;
    breadcrumbItems.push(pageItem);

    schemas.push({
      type: 'BreadcrumbList',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      },
    });

    // 3. WebSite schema
    if (siteName) {
      const websiteSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteName,
      };
      if (siteUrl) websiteSchema.url = siteUrl;
      schemas.push({ type: 'WebSite', jsonLd: websiteSchema });
    }

    // 4. Organization schema
    if (siteName) {
      const orgSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: siteName,
      };
      if (siteUrl) orgSchema.url = siteUrl;
      schemas.push({ type: 'Organization', jsonLd: orgSchema });
    }

    return NextResponse.json({
      data: { schemas },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:SCHEMA] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate schema' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
