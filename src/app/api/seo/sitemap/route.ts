// ============================================================
// GET  /api/seo/sitemap      — Get current sitemap config for site
// POST /api/seo/sitemap      — Generate sitemap / ping engines / toggle auto
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';

// =====================================================================
// GET — current sitemap config
// =====================================================================

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);

    const config = await db.sitemapConfig.findFirst({ where: siteFilter });

    // Upsert if not exists
    let result = config;
    if (!config) {
      result = await db.sitemapConfig.create({
        data: { siteId: siteFilter.siteId || undefined },
      });
    }

    return NextResponse.json({
      data: { ...result, totalUrls: result.urlCount },
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

/**
 * Resolve the site's canonical base URL.
 *
 * Priority:
 *   1. The `site_url` Setting (e.g. "https://cms.example.com")
 *   2. The `Origin` / `Host` header of the incoming request (best-effort fallback)
 *
 * Used to build the absolute sitemap URL that gets sent to Google / Bing.
 */
async function resolveBaseUrl(request: NextRequest): Promise<string> {
  try {
    const setting = await db.setting.findFirst({ where: { key: 'site_url' } });
    if (setting?.value) {
      // Strip trailing slash so we don't end up with `//sitemap.xml`
      return setting.value.replace(/\/+$/, '');
    }
  } catch (error) {
    console.warn('[SEO:SITEMAP] Failed to read site_url setting:', error);
  }

  // Fallback to the request's own origin (works behind proxies too)
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (host) {
    const proto = forwardedProto || request.nextUrl.protocol.replace(':', '') || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  return 'https://example.com';
}

interface PingResult {
  ok: boolean;
  httpStatus: number | null;
  message: string;
}

/**
 * Perform a real HTTP ping to a search engine's sitemap endpoint.
 *
 * NOTE: Google deprecated the public ping API in 2023, so this will usually
 * return a non-200 status (commonly 404/405/429). That is fine — we surface
 * the real upstream status instead of faking success.
 */
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
      // Don't follow redirects — we want the raw upstream status
      redirect: 'manual',
      // Give the engine a reasonable amount of time to respond
      signal: AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'CMS-Sitemap-Ping/1.0 (+https://example.com)',
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
    // Network failure, DNS, timeout, etc.
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

export async function POST(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const action = sp.get('action') || '';
    const siteFilter = await getSiteWhere(request);

    // Ensure config exists
    let config = await db.sitemapConfig.findFirst({ where: siteFilter });
    if (!config) {
      config = await db.sitemapConfig.create({
        data: { siteId: siteFilter.siteId || undefined },
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
      const baseUrl = await resolveBaseUrl(request);
      const sitemapUrl = `${baseUrl}/sitemap.xml`;
      const result = await pingSearchEngine('google', sitemapUrl);

      // Only persist the timestamp on a successful ping
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
          // Use 502 Bad Gateway to signal an upstream failure
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
      const baseUrl = await resolveBaseUrl(request);
      const sitemapUrl = `${baseUrl}/sitemap.xml`;
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

    // Default action: generate sitemap
    const publishedContent = await db.contentItem.findMany({
      where: { ...siteFilter, status: 'PUBLISHED', deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
    });

    const categories = await db.category.findMany({
      where: siteFilter,
      select: { slug: true, updatedAt: true },
    });

    const tags = await db.tag.findMany({
      where: siteFilter,
      select: { slug: true, updatedAt: true },
    });

    // Build XML sitemap
    const baseUrl = (await request.json() as Record<string, unknown>)?.baseUrl as string || 'https://example.com';
    const urls: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];

    for (const item of publishedContent) {
      urls.push(
        '  <url>',
        `    <loc>${baseUrl}/${item.slug}</loc>`,
        `    <lastmod>${item.updatedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
      );
    }

    for (const cat of categories) {
      urls.push(
        '  <url>',
        `    <loc>${baseUrl}/category/${cat.slug}</loc>`,
        `    <lastmod>${cat.updatedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}</lastmod>`,
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.6</priority>',
        '  </url>',
      );
    }

    for (const tag of tags) {
      urls.push(
        '  <url>',
        `    <loc>${baseUrl}/tag/${tag.slug}</loc>`,
        `    <lastmod>${tag.updatedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}</lastmod>`,
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.5</priority>',
        '  </url>',
      );
    }

    urls.push('</urlset>');
    const xmlContent = urls.join('\n');

    const totalUrls = publishedContent.length + categories.length + tags.length;
    const updated = await db.sitemapConfig.update({
      where: { id: config.id },
      data: {
        xmlContent,
        urlCount: totalUrls,
        status: 'GENERATED',
        lastGeneratedAt: new Date(),
      },
    });

    return NextResponse.json({
      data: { ...updated, urlCount: totalUrls },
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
