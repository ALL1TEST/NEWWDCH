// ============================================================
// GET /api/seo/overview — SEO dashboard KPI stats + recent issues
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
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 10));

    const siteFilter = await getSiteWhere(request);
    const baseWhere: Record<string, unknown> = { ...siteFilter, deletedAt: null };

    // Fetch published content for various in-memory checks
    const publishedContent = await db.contentItem.findMany({
      where: { ...baseWhere, status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        siteId: true,
      },
    });

    // Fetch SEO configs for published content
    const resourceIds = publishedContent.map((p) => p.id);
    const seoConfigs = resourceIds.length > 0
      ? await db.seoConfig.findMany({
          where: { resourceType: 'content', resourceId: { in: resourceIds }, ...siteFilter },
          select: { resourceId: true, canonicalUrl: true, structuredData: true },
        })
      : [];
    const seoConfigMap = new Map(seoConfigs.map((c) => [c.resourceId, c]));

    // Fetch site for domain
    const site = siteFilter.siteId
      ? await db.site.findFirst({ where: { id: siteFilter.siteId }, select: { domain: true } })
      : null;
    const siteDomain = site?.domain || null;

    // ---- Calculations ----

    // indexedPages: count of PUBLISHED content
    const indexedPages = publishedContent.length;

    // notIndexed: from IndexingRecord with status EXCLUDED, DISCOVERED, or ERROR
    const notIndexed = await db.indexingRecord.count({
      where: { ...siteFilter, status: { in: ['EXCLUDED', 'DISCOVERED', 'ERROR'] } },
    });

    // missingMetaTitles: published items where seoTitle is null or empty
    const missingMetaTitles = publishedContent.filter(
      (p) => !p.seoTitle || p.seoTitle.trim() === '',
    ).length;

    // missingMetaDescriptions: published items where seoDescription is null or empty
    const missingMetaDescriptions = publishedContent.filter(
      (p) => !p.seoDescription || p.seoDescription.trim() === '',
    ).length;

    // missingH1: published items where content doesn't contain <h1
    const missingH1 = publishedContent.filter(
      (p) => !p.content || !p.content.includes('<h1'),
    ).length;

    // duplicateTitles: count of published items sharing the same title (only duplicates, not first occurrence)
    const titleCounts = new Map<string, number>();
    for (const p of publishedContent) {
      titleCounts.set(p.title, (titleCounts.get(p.title) || 0) + 1);
    }
    let duplicateTitles = 0;
    for (const count of titleCounts.values()) {
      if (count > 1) duplicateTitles += count - 1;
    }

    // duplicateDescriptions: count of published items sharing the same seoDescription (only duplicates)
    const descCounts = new Map<string, number>();
    for (const p of publishedContent) {
      const desc = p.seoDescription?.trim() || '';
      if (desc) {
        descCounts.set(desc, (descCounts.get(desc) || 0) + 1);
      }
    }
    let duplicateDescriptions = 0;
    for (const count of descCounts.values()) {
      if (count > 1) duplicateDescriptions += count - 1;
    }

    // brokenLinksCount: BrokenLink records with status BROKEN
    const brokenLinksCount = await db.brokenLink.count({
      where: { ...siteFilter, status: 'BROKEN' },
    });

    // redirectsCount: active Redirect records
    const redirectsCount = await db.redirect.count({
      where: { ...siteFilter, isActive: true },
    });

    // missingCanonicals: published items that have no SeoConfig OR SeoConfig.canonicalUrl is null/empty
    const missingCanonicals = publishedContent.filter((p) => {
      const config = seoConfigMap.get(p.id);
      return !config || !config.canonicalUrl || config.canonicalUrl.trim() === '';
    }).length;

    // canonicalIssues: SeoConfigs where canonicalUrl points to a different domain
    let canonicalIssues = 0;
    if (siteDomain) {
      for (const config of seoConfigs) {
        if (config.canonicalUrl && config.canonicalUrl.trim() !== '') {
          try {
            const url = new URL(config.canonicalUrl);
            if (url.hostname !== siteDomain) {
              canonicalIssues++;
            }
          } catch {
            // Invalid URL, don't count as external domain issue
          }
        }
      }
    }

    // sitemapStatus, sitemapAutoGenerate, sitemapLastGenerated
    const sitemapConfig = await db.sitemapConfig.findFirst({ where: siteFilter });
    const sitemapStatus = sitemapConfig?.status ?? 'PENDING';
    const sitemapAutoGenerate = sitemapConfig?.autoGenerate ?? false;
    const sitemapLastGenerated = sitemapConfig?.lastGeneratedAt ?? null;

    // robotsStatus
    const robotsTxt = await db.robotsTxt.findFirst({ where: siteFilter });
    const robotsStatus = robotsTxt ? 'CONFIGURED' : 'NOT_CONFIGURED';

    // schemaStatus: 'ACTIVE' if any published content has SeoConfig with structuredData
    const hasSchema = seoConfigs.some((c) => c.structuredData && c.structuredData.trim() !== '');
    const schemaStatus = hasSchema ? 'ACTIVE' : 'NONE';

    // searchConsoleConnected
    const searchConsoleConn = await db.searchConsoleConnection.findFirst({
      where: { ...siteFilter, status: 'CONNECTED' },
    });
    const searchConsoleConnected = !!searchConsoleConn;

    // overallScore: 0-100 based on issues
    let score = 100;
    score -= Math.min(25, missingMetaTitles * 5);
    score -= Math.min(25, missingMetaDescriptions * 5);
    score -= Math.min(20, missingH1 * 10);
    score -= Math.min(15, duplicateTitles * 3);
    score -= Math.min(15, brokenLinksCount * 5);
    score = Math.max(0, score);
    const overallScore = Math.round(score);

    // Recent SEO issues
    const [recentIssues, recentIssuesTotal] = await Promise.all([
      db.seoIssue.findMany({
        where: { ...siteFilter },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.seoIssue.count({ where: siteFilter }),
    ]);

    const stats = {
      indexedPages,
      notIndexed,
      missingMetaTitles,
      missingMetaDescriptions,
      missingH1,
      duplicateTitles,
      duplicateDescriptions,
      brokenLinksCount,
      redirectsCount,
      missingCanonicals,
      canonicalIssues,
      sitemapStatus,
      sitemapAutoGenerate,
      sitemapLastGenerated,
      robotsStatus,
      schemaStatus,
      overallScore,
      searchConsoleConnected,
    };

    return NextResponse.json({
      data: {
        stats,
        recentIssues,
      },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
        pagination: {
          page,
          pageSize,
          total: recentIssuesTotal,
          totalPages: Math.ceil(recentIssuesTotal / pageSize),
        },
      },
    });
  } catch (error) {
    console.error(`[SEO:OVERVIEW] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SEO overview' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
