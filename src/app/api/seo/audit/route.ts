// ============================================================
// POST /api/seo/audit — Comprehensive Real-World SEO Audit Engine
// Discovers real URLs, probes live site & API, evaluates page-type-aware SEO
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';
import {
  auditSinglePage,
  calculateCategoryScores,
  SeoFinding,
  resolveSiteBaseUrl,
  buildPublicUrl,
  getArticleOrPagePath,
  crawlPage,
  CrawlResult,
} from '@/lib/seo';
import { saveAuditSnapshot } from '@/lib/seo/drift-tracker';

interface LiveFetchResult {
  status: number;
  finalUrl: string;
  html?: string;
  error?: string;
}

async function safeFetchLivePage(url: string, timeoutMs = 4000): Promise<LiveFetchResult> {
  try {
    const crawl = await crawlPage(url, { timeoutMs });
    return {
      status: crawl.httpStatus,
      finalUrl: crawl.finalResolvedUrl || url,
      html: crawl.html,
      error: crawl.error,
    };
  } catch (err: any) {
    return {
      status: 0,
      finalUrl: url,
      error: err?.message || 'Network error',
    };
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);
    const siteId = siteFilter.siteId;

    // 1. Obtain Site Configuration
    const site = siteId
      ? await db.site.findFirst({
          where: { id: siteId },
          select: { id: true, name: true, slug: true, domain: true, config: true },
        })
      : null;

    const baseSiteUrl = resolveSiteBaseUrl(site);
    const siteDomain = site?.domain || new URL(baseSiteUrl).hostname;

    // 2. Discover Real URLs & Content
    // Source A: Published CMS content items
    const publishedItems = await db.contentItem.findMany({
      where: { ...siteFilter, status: 'PUBLISHED', deletedAt: null },
      include: {
        contentType: { select: { slug: true, name: true } },
        author: { select: { name: true } },
        authorProfile: { select: { displayName: true, bio: true } },
        featuredImage: { select: { url: true } },
      },
    });

    // Source B: Check live Connected CMS API if available
    let liveApiArticlesCount = 0;
    try {
      const apiArticlesRes = await safeFetchLivePage(`${baseSiteUrl}/api/articles`, 3000);
      if (apiArticlesRes.status === 200 && apiArticlesRes.html) {
        const parsed = JSON.parse(apiArticlesRes.html);
        if (Array.isArray(parsed)) {
          liveApiArticlesCount = parsed.length;
        }
      }
    } catch {
      // Non-blocking: rely on CMS database content
    }

    // Source C: SEO Configs
    const resourceIds = publishedItems.map((p) => p.id);
    const seoConfigs = resourceIds.length > 0
      ? await db.seoConfig.findMany({
          where: { resourceType: 'content', resourceId: { in: resourceIds }, ...siteFilter },
          select: { resourceId: true, canonicalUrl: true, robots: true, structuredData: true },
        })
      : [];
    const seoConfigMap = new Map(seoConfigs.map((c) => [c.resourceId, c]));

    const allFindings: SeoFinding[] = [];
    let scannedPagesCount = 0;

    // 3. Probe Live Technical Signals (Robots.txt & Sitemap.xml)
    // Probe robots.txt
    const robotsLive = await safeFetchLivePage(`${baseSiteUrl}/robots.txt`, 2500);
    if (robotsLive.status === 404) {
      allFindings.push({
        id: `robots-missing-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'robots-txt-missing',
        pageType: 'OTHER_PAGE',
        intent: 'NAVIGATIONAL',
        category: 'TECHNICAL',
        severity: 'WARNING',
        title: 'Missing robots.txt on Live Website',
        problem: 'Live robots.txt file returned HTTP 404',
        issue: 'robots.txt returned HTTP 404',
        explanation: 'A robots.txt file provides essential crawl directives and points search engines to your sitemap.',
        recommendation: `Deploy a robots.txt file at ${baseSiteUrl}/robots.txt.`,
        affectedUrl: `${baseSiteUrl}/robots.txt`,
        affected_url: `${baseSiteUrl}/robots.txt`,
        detectedValue: 'HTTP 404 Not Found',
        detected_value: 'HTTP 404 Not Found',
        expectedValue: 'HTTP 200 with valid crawl rules',
        expected_value: 'HTTP 200 with valid crawl rules',
        verificationMethod: `curl -I ${baseSiteUrl}/robots.txt`,
        verification_method: `curl -I ${baseSiteUrl}/robots.txt`,
        evidence: `Live HTTP GET to ${baseSiteUrl}/robots.txt returned status 404.`,
        confidence: 1.0,
      });
    }

    // Probe sitemap.xml
    const sitemapLive = await safeFetchLivePage(`${baseSiteUrl}/sitemap.xml`, 2500);
    if (sitemapLive.status === 404) {
      allFindings.push({
        id: `sitemap-missing-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'sitemap-xml-missing',
        pageType: 'OTHER_PAGE',
        intent: 'NAVIGATIONAL',
        category: 'TECHNICAL',
        severity: 'WARNING',
        title: 'Missing XML Sitemap on Live Website',
        problem: 'Live sitemap.xml returned HTTP 404 Not Found',
        issue: 'sitemap.xml returned HTTP 404',
        explanation: 'An XML sitemap helps search crawlers efficiently discover and index all authoritative site pages.',
        recommendation: `Generate and deploy an XML sitemap at ${baseSiteUrl}/sitemap.xml.`,
        affectedUrl: `${baseSiteUrl}/sitemap.xml`,
        affected_url: `${baseSiteUrl}/sitemap.xml`,
        detectedValue: 'HTTP 404 Not Found',
        detected_value: 'HTTP 404 Not Found',
        expectedValue: 'HTTP 200 with valid XML sitemap',
        expected_value: 'HTTP 200 with valid XML sitemap',
        verificationMethod: `curl -I ${baseSiteUrl}/sitemap.xml`,
        verification_method: `curl -I ${baseSiteUrl}/sitemap.xml`,
        evidence: `Live HTTP GET to ${baseSiteUrl}/sitemap.xml returned status 404.`,
        confidence: 1.0,
      });
    }

    // 4. Probe Live Homepage
    const homeLive = await safeFetchLivePage(`${baseSiteUrl}/`, 3000);
    if (homeLive.status === 200 && homeLive.html) {
      const homeHtml = homeLive.html;
      const homeTitle = homeHtml.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
      const homeDesc = homeHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() || '';
      const homeH1Matches = homeHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
      const homeCanonical = homeHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '';

      const homeAudit = auditSinglePage({
        url: `${baseSiteUrl}/`,
        title: homeTitle || 'Home',
        slug: '',
        contentType: 'page',
        pageType: 'HOME',
        intent: 'BRAND',
        content: homeHtml,
        seoTitle: homeTitle,
        seoDescription: homeDesc,
        canonicalUrl: homeCanonical,
        siteDomain,
        httpStatus: 200,
        liveHtml: homeHtml,
      });

      for (const f of homeAudit.findings) {
        allFindings.push({
          ...f,
          resourceType: 'live_page',
          resourceId: 'homepage',
        });
      }
      scannedPagesCount++;
    }

    // 5. Audit Published Content Items (Page-Type-Aware)
    for (const item of publishedItems) {
      const isPage = item.contentType?.slug === 'page' || ['about', 'contact', 'privacy-policy', 'terms'].includes(item.slug);
      const pagePath = getArticleOrPagePath(item.slug, item.contentType?.slug);
      const pagePublicUrl = buildPublicUrl(pagePath, { domain: siteDomain });
      const config = seoConfigMap.get(item.id);

      // Probe real live page for exact data with automatic HTTP redirect following
      const crawl = await crawlPage(pagePublicUrl, { timeoutMs: 5000 });
      const liveHtml = crawl.httpStatus === 200 && crawl.html ? crawl.html : undefined;
      const targetUrl = crawl.finalResolvedUrl || pagePublicUrl;

      const pageResult = auditSinglePage({
        url: targetUrl,
        requestedUrl: pagePublicUrl,
        finalResolvedUrl: targetUrl,
        redirectChain: crawl.redirectChain,
        title: item.title,
        slug: item.slug,
        contentType: isPage ? 'page' : 'article',
        content: item.content || '',
        excerpt: item.excerpt || undefined,
        seoTitle: item.seoTitle || crawl.elements.title || undefined,
        seoDescription: item.seoDescription || crawl.elements.metaDescription || undefined,
        focusKeyword: item.focusKeyword || undefined,
        canonicalUrl: config?.canonicalUrl || crawl.elements.canonicalUrl || undefined,
        robotsDirectives: config?.robots || crawl.elements.robots || 'index, follow',
        featuredImageUrl: item.featuredImage?.url || undefined,
        authorName: item.authorProfile?.displayName || item.author?.name || undefined,
        authorBio: item.authorProfile?.bio || undefined,
        publishedAt: item.publishedAt || undefined,
        updatedAt: item.updatedAt || undefined,
        structuredDataJson: config?.structuredData || undefined,
        siteDomain,
        httpStatus: crawl.httpStatus > 0 ? crawl.httpStatus : undefined,
        liveHtml,
      });

      // Attach resource info
      for (const f of pageResult.findings) {
        allFindings.push({
          ...f,
          resourceId: item.id,
          resourceType: 'content',
        });
      }

      // Persist per-page score in ContentItem.seoReport
      await db.contentItem.update({
        where: { id: item.id },
        data: {
          seoReport: JSON.stringify({
            overallScore: pageResult.overallScore,
            grade: pageResult.grade,
            pageType: f_type(f_first(pageResult.findings)?.pageType, item.slug),
            intent: f_intent(f_first(pageResult.findings)?.intent, item.slug),
            categories: pageResult.categories.map((c) => ({ category: c.category, score: c.score })),
            auditedAt: new Date().toISOString(),
            requestedUrl: pagePublicUrl,
            finalResolvedUrl: targetUrl,
            redirectChain: crawl.redirectChain,
          }),
        },
      });

      scannedPagesCount++;
    }

    // 6. Calculate Aggregated Site Scores
    const siteScores = calculateCategoryScores(allFindings);

    // 7. Sync findings with SeoIssue table with rich evidence metadata
    if (allFindings.length > 0) {
      // Clear old unresolved issues for this site to prevent duplicate piling
      await db.seoIssue.deleteMany({
        where: { ...siteFilter, isResolved: false },
      });

      // Insert top 150 findings into SeoIssue table
      const toInsert = allFindings.slice(0, 150).map((f) => {
        const severityMap = f.severity === 'CRITICAL' ? 'CRITICAL' : (f.severity === 'WARNING' || f.severity === 'HIGH') ? 'WARNING' : 'INFO';
        
        let redirectTag = '';
        if (f.redirectChain && f.redirectChain.length > 0) {
          redirectTag = `\n[REQUESTED_URL]: ${f.requestedUrl || f.affectedUrl}\n[FINAL_URL]: ${f.finalResolvedUrl || f.affectedUrl}\n[REDIRECT_CHAIN]: ${JSON.stringify(f.redirectChain)}`;
        }

        // Encode rich evidence & verification into recommendation payload
        const metadataTag = `\n\n[RULE_ID]: ${f.ruleId || 'seo-rule'}\n[PAGE_TYPE]: ${f.pageType || 'ARTICLE'}\n[INTENT]: ${f.intent || 'INFORMATIONAL'}\n[EVIDENCE]: ${f.evidence || f.detectedValue || 'Detected during crawl'}\n[EXPECTED]: ${f.expectedValue || f.expected_value || 'Compliant SEO signal'}\n[VERIFICATION]: ${f.verificationMethod || f.verification_method || 'Inspect page source'}${redirectTag}`;
        const recommendationText = (f.recommendation || 'Optimize page content') + metadataTag;

        return {
          severity: severityMap as 'CRITICAL' | 'WARNING' | 'INFO',
          resourceType: f.resourceType || 'content',
          resourceId: f.resourceId || null,
          pageUrl: f.finalResolvedUrl || f.affectedUrl || f.affected_url || baseSiteUrl,
          problem: f.problem || f.issue || 'SEO issue detected',
          recommendation: recommendationText,
          isResolved: false,
          siteId: siteId || null,
        };
      });

      for (const issue of toInsert) {
        try {
          await db.seoIssue.create({ data: issue });
        } catch (insertErr) {
          console.warn('[SeoAudit] Failed to insert issue:', insertErr);
        }
      }
    }

    // 8. Save Audit Snapshot for Drift Tracking
    const categoryScoresObj: Record<string, number> = {};
    for (const cat of siteScores.categories) {
      categoryScoresObj[cat.category] = cat.score;
    }

    await saveAuditSnapshot({
      siteId,
      overallScore: siteScores.overallScore,
      categoryScores: categoryScoresObj,
      totalIssues: allFindings.length,
      criticalIssues: siteScores.severitySummary.critical,
      highIssues: siteScores.severitySummary.high,
      mediumIssues: siteScores.severitySummary.medium,
      lowIssues: siteScores.severitySummary.low,
      auditedPagesCount: scannedPagesCount,
    });

    return NextResponse.json({
      data: {
        summary: {
          auditedPagesCount: scannedPagesCount,
          totalPagesAudited: scannedPagesCount,
          averageHealthScore: siteScores.overallScore,
          overallScore: siteScores.overallScore,
          grade: siteScores.grade,
          categories: siteScores.categories,
          severitySummary: siteScores.severitySummary,
          connectedSite: {
            id: site?.id || siteId,
            name: site?.name || 'Verdant',
            url: baseSiteUrl,
            liveApiArticlesCount,
          },
          auditedAt: new Date().toISOString(),
        },
        findingsCount: allFindings.length,
        topFindings: allFindings.slice(0, 50),
      },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error: any) {
    console.error(`[SEO:AUDIT:POST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to execute site audit' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

function f_first(arr?: SeoFinding[]): SeoFinding | undefined {
  return arr && arr.length > 0 ? arr[0] : undefined;
}

function f_type(t?: string, slug?: string): string {
  if (t) return t;
  if (slug === 'about') return 'ABOUT';
  if (slug === 'contact') return 'CONTACT';
  if (slug?.includes('privacy')) return 'PRIVACY';
  return 'ARTICLE';
}

function f_intent(i?: string, slug?: string): string {
  if (i) return i;
  if (slug === 'about') return 'BRAND';
  if (slug === 'contact') return 'SUPPORT';
  if (slug?.includes('privacy')) return 'LEGAL';
  return 'INFORMATIONAL';
}
