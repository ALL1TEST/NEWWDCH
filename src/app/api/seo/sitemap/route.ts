// ============================================================
// GET  /api/seo/sitemap      — Get current sitemap config for site
// POST /api/seo/sitemap      — Generate sitemap / ping engines / toggle auto
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';
import { resolveSiteBaseUrl, getArticleOrPagePath } from '@/lib/seo/url-utils';

/**
 * Resolves the connected site's canonical base URL.
 * Strictly avoids cms.example.com or example.com, defaulting to verdantt.vercel.app.
 */
async function resolveConnectedBaseUrl(request: NextRequest, siteFilter?: Record<string, unknown>): Promise<{ baseUrl: string; siteId: string | null }> {
  let siteId: string | null = (siteFilter?.siteId as string) || null;

  if (!siteId) {
    const rawSiteParam = request.nextUrl.searchParams.get('siteId');
    if (rawSiteParam && rawSiteParam !== 'all' && rawSiteParam !== 'platform') {
      siteId = rawSiteParam;
    }
  }

  let site = null;
  if (siteId) {
    site = await db.site.findFirst({
      where: { OR: [{ id: siteId }, { slug: siteId }] },
      select: { id: true, name: true, slug: true, domain: true, config: true },
    });
  }

  if (!site) {
    // Locate the active Verdant site as primary connected site
    site = await db.site.findFirst({
      where: {
        OR: [
          { domain: 'verdantt.vercel.app' },
          { slug: 'verdant' },
        ],
      },
      select: { id: true, name: true, slug: true, domain: true, config: true },
    });
  }

  const baseUrl = resolveSiteBaseUrl(site);
  // Guarantee clean URL without trailing slash or example.com
  const cleanBase = (baseUrl && !baseUrl.includes('example.com'))
    ? baseUrl.replace(/\/+$/, '')
    : 'https://verdantt.vercel.app';

  return { baseUrl: cleanBase, siteId: site?.id || null };
}

/**
 * Probes the public sitemap endpoint on the live website.
 * Distinguishes whether the real sitemap is live (HTTP 200 with XML) or not yet published (404/HTML).
 */
async function checkPublicSitemapAccessibility(sitemapUrl: string): Promise<{
  isPubliclyAccessible: boolean;
  httpStatus: number;
  message: string;
}> {
  try {
    const response = await fetch(sitemapUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Verdant-Sitemap-Verifier/1.0 (+https://verdantt.vercel.app)',
        Accept: 'application/xml,text/xml,*/*',
      },
      signal: AbortSignal.timeout(4000),
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    const isXml = contentType.includes('xml');

    if (response.status === 200 && isXml) {
      return {
        isPubliclyAccessible: true,
        httpStatus: response.status,
        message: 'Sitemap is live and publicly accessible on the connected site.',
      };
    }

    if (response.status === 200 && !isXml) {
      return {
        isPubliclyAccessible: false,
        httpStatus: 404,
        message: 'Public endpoint returned HTML instead of XML (sitemap.xml is not deployed).',
      };
    }

    return {
      isPubliclyAccessible: false,
      httpStatus: response.status,
      message: `Public endpoint returned HTTP ${response.status}.`,
    };
  } catch (error: any) {
    return {
      isPubliclyAccessible: false,
      httpStatus: 0,
      message: `Could not reach public sitemap: ${error?.message || 'Network error'}`,
    };
  }
}

// =====================================================================
// GET — current sitemap config
// =====================================================================

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);
    const { baseUrl, siteId } = await resolveConnectedBaseUrl(request, siteFilter);
    const sitemapUrl = `${baseUrl}/sitemap.xml`;

    let config = await db.sitemapConfig.findFirst({
      where: siteId ? { siteId } : siteFilter,
    });

    // Upsert if not exists
    if (!config) {
      config = await db.sitemapConfig.create({
        data: { siteId: siteId || (siteFilter.siteId as string) || undefined },
      });
    }

    // Check if the public sitemap is actually live on the connected site
    const publicCheck = await checkPublicSitemapAccessibility(sitemapUrl);

    // Clean up any legacy xmlContent that contained cms.example.com
    let currentXml = config.xmlContent || '';
    if (currentXml.includes('cms.example.com') || currentXml.includes('example.com')) {
      currentXml = '';
      await db.sitemapConfig.update({
        where: { id: config.id },
        data: { xmlContent: '', urlCount: 0, status: 'PENDING' },
      });
      config.urlCount = 0;
      config.status = 'PENDING';
      config.xmlContent = '';
    }

    const publishingStatus = publicCheck.isPubliclyAccessible
      ? 'PUBLISHED'
      : config.status === 'GENERATED'
        ? 'GENERATED_LOCAL'
        : 'PENDING';

    const publishingMessage = publicCheck.isPubliclyAccessible
      ? 'Sitemap is live and publicly accessible.'
      : config.status === 'GENERATED'
        ? `Generated in CMS — not published to the public site (public endpoint ${sitemapUrl} returned HTTP ${publicCheck.httpStatus || 404}).`
        : 'Sitemap has not been generated yet.';

    return NextResponse.json({
      data: {
        ...config,
        xmlContent: currentXml,
        totalUrls: config.urlCount,
        lastGenerated: config.lastGeneratedAt,
        lastPingGoogle: config.lastPingedGoogle,
        lastPingBing: config.lastPingedBing,
        sitemapUrl,
        isPubliclyAccessible: publicCheck.isPubliclyAccessible,
        publicHttpStatus: publicCheck.httpStatus,
        publishingStatus,
        publishingMessage,
      },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:SITEMAP:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sitemap config' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — generate / ping / toggle auto
// =====================================================================

interface PingResult {
  ok: boolean;
  httpStatus: number | null;
  message: string;
}

async function pingSearchEngine(
  engine: 'google' | 'bing',
  sitemapUrl: string,
): Promise<PingResult> {
  const endpoint =
    engine === 'google'
      ? `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
      : `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'Verdant-Sitemap-Ping/1.0 (+https://verdantt.vercel.app)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    });

    if (response.ok) {
      return {
        ok: true,
        httpStatus: response.status,
        message: `Ping accepted by ${engine === 'google' ? 'Google' : 'Bing'} (HTTP ${response.status})`,
      };
    }

    return {
      ok: false,
      httpStatus: response.status,
      message:
        engine === 'google'
          ? `Google returned HTTP ${response.status} for the ping request (the public ping API was deprecated in 2023)`
          : `Bing returned HTTP ${response.status} for the ping request`,
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    return {
      ok: false,
      httpStatus: null,
      message: isTimeout
        ? `Request to ${engine === 'google' ? 'Google' : 'Bing'} timed out`
        : `Network error while pinging ${engine === 'google' ? 'Google' : 'Bing'}: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

/**
 * Escapes characters for XML sitemap inclusion.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const action = sp.get('action') || '';
    const siteFilter = await getSiteWhere(request);
    const { baseUrl, siteId } = await resolveConnectedBaseUrl(request, siteFilter);
    const sitemapUrl = `${baseUrl}/sitemap.xml`;

    // Ensure config exists
    let config = await db.sitemapConfig.findFirst({
      where: siteId ? { siteId } : siteFilter,
    });
    if (!config) {
      config = await db.sitemapConfig.create({
        data: { siteId: siteId || (siteFilter.siteId as string) || undefined },
      });
    }

    // Toggle auto-generation
    if (action === 'toggle-auto') {
      const updated = await db.sitemapConfig.update({
        where: { id: config.id },
        data: { autoGenerate: !config.autoGenerate },
      });
      return NextResponse.json({
        data: updated,
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Ping Google
    if (action === 'ping-google') {
      const result = await pingSearchEngine('google', sitemapUrl);
      const updated = result.ok
        ? await db.sitemapConfig.update({
            where: { id: config.id },
            data: { lastPingedGoogle: new Date() },
          })
        : config;

      if (!result.ok) {
        return NextResponse.json(
          {
            error: {
              code: 'PING_FAILED',
              message: result.message,
              details: { engine: 'google', httpStatus: result.httpStatus, sitemapUrl },
            },
            data: { ...updated, pingResult: result.message, pingHttpStatus: result.httpStatus },
            meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        data: {
          ...updated,
          pingResult: result.message,
          pingHttpStatus: result.httpStatus,
          sitemapUrl,
        },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Ping Bing
    if (action === 'ping-bing') {
      const result = await pingSearchEngine('bing', sitemapUrl);
      const updated = result.ok
        ? await db.sitemapConfig.update({
            where: { id: config.id },
            data: { lastPingedBing: new Date() },
          })
        : config;

      if (!result.ok) {
        return NextResponse.json(
          {
            error: {
              code: 'PING_FAILED',
              message: result.message,
              details: { engine: 'bing', httpStatus: result.httpStatus, sitemapUrl },
            },
            data: { ...updated, pingResult: result.message, pingHttpStatus: result.httpStatus },
            meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        data: {
          ...updated,
          pingResult: result.message,
          pingHttpStatus: result.httpStatus,
          sitemapUrl,
        },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // =================================================================
    // Default action: Generate Real Sitemap for Connected Verdant Site
    // =================================================================

    // 1. Fetch real published CMS content for this site
    const publishedContent = await db.contentItem.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(siteId ? { siteId } : siteFilter),
      },
      include: {
        contentType: { select: { slug: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    // 2. Fetch SEO configs to exclude any noindex pages
    const contentIds = publishedContent.map((c) => c.id);
    const seoConfigs = contentIds.length > 0
      ? await db.seoConfig.findMany({
          where: { resourceType: 'content', resourceId: { in: contentIds } },
          select: { resourceId: true, robots: true },
        })
      : [];
    const noIndexSet = new Set(
      seoConfigs
        .filter((c) => c.robots && c.robots.toLowerCase().includes('noindex'))
        .map((c) => c.resourceId),
    );

    // 3. Assemble candidate entries
    interface CandidateEntry {
      path: string;
      lastmod: string;
      changefreq: string;
      priority: string;
    }

    const candidateEntries: CandidateEntry[] = [];

    // Homepage
    candidateEntries.push({
      path: '/',
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'daily',
      priority: '1.0',
    });

    // Blog Hub
    candidateEntries.push({
      path: '/blog',
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'daily',
      priority: '0.9',
    });

    // Content items
    for (const item of publishedContent) {
      if (noIndexSet.has(item.id)) continue;

      let path = getArticleOrPagePath(item.slug, item.contentType?.slug);
      // Canonicalize known static pages (e.g. privacy-policy -> privacy)
      if (path === '/privacy-policy') path = '/privacy';

      const lastmod = item.updatedAt
        ? item.updatedAt.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const isPage = item.contentType?.slug === 'page';
      candidateEntries.push({
        path,
        lastmod,
        changefreq: isPage ? 'monthly' : 'weekly',
        priority: isPage ? '0.7' : '0.8',
      });
    }

    // Fetch active redirects to ensure redirect-only URLs are NEVER included in sitemap
    const activeRedirects = await db.redirect.findMany({
      where: {
        isActive: true,
        ...(siteId ? { siteId } : siteFilter),
      },
      select: { fromPath: true },
    });
    const redirectFromPaths = new Set(
      activeRedirects.map((r) => r.fromPath.toLowerCase()),
    );

    // Deduplicate candidate paths and exclude redirect sources
    const uniqueCandidates = new Map<string, CandidateEntry>();
    for (const entry of candidateEntries) {
      if (redirectFromPaths.has(entry.path.toLowerCase())) {
        continue; // Strictly exclude redirect-only paths from sitemap
      }
      if (!uniqueCandidates.has(entry.path)) {
        uniqueCandidates.set(entry.path, entry);
      }
    }

    // 4. Verify each URL against the live connected website
    // Rejects 404s, example.com URLs, and follows redirects to canonical destinations
    const verifiedEntries: CandidateEntry[] = [];

    for (const [path, entry] of uniqueCandidates.entries()) {
      const fullUrl = `${baseUrl}${path}`;

      // Strictly reject any mock or invalid domain
      if (fullUrl.includes('cms.example.com') || fullUrl.includes('example.com')) {
        continue;
      }

      try {
        const probeRes = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Verdant-Sitemap-Verifier/1.0 (+https://verdantt.vercel.app)',
          },
          signal: AbortSignal.timeout(3500),
          redirect: 'manual',
        });

        if (probeRes.status === 200) {
          verifiedEntries.push(entry);
        } else if (probeRes.status >= 300 && probeRes.status < 400) {
          const location = probeRes.headers.get('location');
          if (location) {
            let redirectPath = location.startsWith('http')
              ? new URL(location).pathname
              : location;
            redirectPath = redirectPath.replace(/\/+$/, '') || '/';
            // If redirected within the connected domain and not yet added, use the target path
            if (!uniqueCandidates.has(redirectPath)) {
              verifiedEntries.push({
                ...entry,
                path: redirectPath,
              });
            }
          }
        }
        // Reject 404, 410, and server errors
      } catch {
        // Fallback: If network check times out, include ONLY if it is a confirmed published article or core page
        if (entry.path === '/' || entry.path === '/blog' || entry.path.startsWith('/blog/')) {
          verifiedEntries.push(entry);
        }
      }
    }

    // 5. Construct XML Sitemap
    const xmlLines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];

    for (const entry of verifiedEntries) {
      const loc = `${baseUrl}${entry.path}`;
      xmlLines.push('  <url>');
      xmlLines.push(`    <loc>${escapeXml(loc)}</loc>`);
      xmlLines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
      xmlLines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      xmlLines.push(`    <priority>${entry.priority}</priority>`);
      xmlLines.push('  </url>');
    }

    xmlLines.push('</urlset>');
    const xmlContent = xmlLines.join('\n');

    // 6. Check public sitemap availability
    const publicCheck = await checkPublicSitemapAccessibility(sitemapUrl);

    // Save in database
    const updated = await db.sitemapConfig.update({
      where: { id: config.id },
      data: {
        xmlContent,
        urlCount: verifiedEntries.length,
        status: 'GENERATED',
        lastGeneratedAt: new Date(),
      },
    });

    const publishingStatus = publicCheck.isPubliclyAccessible
      ? 'PUBLISHED'
      : 'GENERATED_LOCAL';

    const publishingMessage = publicCheck.isPubliclyAccessible
      ? 'Sitemap is live and publicly accessible on the connected site.'
      : `Generated in CMS — not published to the public site (public endpoint ${sitemapUrl} returned HTTP ${publicCheck.httpStatus || 404}). Requires frontend sitemap.xml deployment.`;

    return NextResponse.json({
      data: {
        ...updated,
        totalUrls: updated.urlCount,
        lastGenerated: updated.lastGeneratedAt,
        lastPingGoogle: updated.lastPingedGoogle,
        lastPingBing: updated.lastPingedBing,
        sitemapUrl,
        isPubliclyAccessible: publicCheck.isPubliclyAccessible,
        publicHttpStatus: publicCheck.httpStatus,
        publishingStatus,
        publishingMessage,
      },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:SITEMAP:POST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to process sitemap request' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
