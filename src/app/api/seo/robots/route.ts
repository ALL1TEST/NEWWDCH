// ============================================================
// GET  /api/seo/robots  — Get robots.txt and live verification
// PUT  /api/seo/robots  — Save robots.txt content & re-verify
// POST /api/seo/robots  — Action handler (e.g. action=verify)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { resolveSiteBaseUrl } from '@/lib/seo/url-utils';
import { verifyRobotsSemantic } from '@/lib/seo/robots-verifier';

const putSchema = z.object({
  content: z.string().min(1, 'Content is required').max(50000, 'Content must be 50000 characters or less'),
});

async function resolveConnectedBaseUrl(request: NextRequest, siteFilter?: Record<string, unknown>): Promise<{ baseUrl: string; siteId: string | null; domain: string }> {
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

  const rawBase = resolveSiteBaseUrl(site);
  const baseUrl = (rawBase && !rawBase.includes('example.com'))
    ? rawBase.replace(/\/+$/, '')
    : 'https://verdantt.vercel.app';

  const domain = site?.domain || new URL(baseUrl).hostname;
  return { baseUrl, siteId: site?.id || null, domain };
}

/**
 * Probes the live public robots.txt and sitemap.xml on the connected site.
 */
async function probeLiveEndpoints(publicRobotsUrl: string, publicSitemapUrl: string): Promise<{
  robotsContent: string;
  robotsHttpStatus: number;
  sitemapHttpStatus: number;
}> {
  let robotsContent = '';
  let robotsHttpStatus = 0;
  let sitemapHttpStatus = 0;

  try {
    const rRes = await fetch(publicRobotsUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Verdant-Robots-Verifier/2.0 (+https://verdantt.vercel.app)',
      },
      signal: AbortSignal.timeout(4000),
      redirect: 'follow',
    });
    robotsHttpStatus = rRes.status;
    if (rRes.status === 200) {
      robotsContent = await rRes.text();
    }
  } catch {
    robotsHttpStatus = 0;
  }

  try {
    const sRes = await fetch(publicSitemapUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Verdant-Sitemap-Verifier/2.0 (+https://verdantt.vercel.app)',
        Accept: 'application/xml,text/xml,*/*',
      },
      signal: AbortSignal.timeout(4000),
      redirect: 'follow',
    });
    sitemapHttpStatus = sRes.status;
  } catch {
    sitemapHttpStatus = 0;
  }

  return { robotsContent, robotsHttpStatus, sitemapHttpStatus };
}

// =====================================================================
// GET — get robots.txt with semantic live verification
// =====================================================================

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);
    const { baseUrl, siteId, domain } = await resolveConnectedBaseUrl(request, siteFilter);
    const publicUrl = `${baseUrl}/robots.txt`;
    const sitemapUrl = `${baseUrl}/sitemap.xml`;

    let robots = await db.robotsTxt.findFirst({
      where: siteId ? { siteId } : siteFilter,
    });

    const defaultContent = `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}`;

    // Upsert if not exists
    if (!robots) {
      robots = await db.robotsTxt.create({
        data: {
          content: defaultContent,
          siteId: siteId || (siteFilter.siteId as string) || undefined,
        },
      });
    }

    // Auto-clean any legacy demo URLs or empty sitemap directive in DB
    let currentContent = robots.content || '';
    if (
      !currentContent.trim() ||
      currentContent.includes('cms.example.com') ||
      currentContent.includes('example.com') ||
      /Sitemap:\s*(\n|$)/i.test(currentContent)
    ) {
      if (!currentContent.trim()) {
        currentContent = defaultContent;
      } else {
        currentContent = currentContent
          .replace(/https:\/\/cms\.example\.com/g, baseUrl)
          .replace(/https:\/\/example\.com/g, baseUrl);

        if (/Sitemap:\s*(\n|$)/i.test(currentContent)) {
          currentContent = currentContent.replace(/Sitemap:\s*(\n|$)/gi, `Sitemap: ${sitemapUrl}$1`);
        } else if (!currentContent.toLowerCase().includes('sitemap:')) {
          currentContent = `${currentContent.trim()}\n\nSitemap: ${sitemapUrl}`;
        }
      }

      robots = await db.robotsTxt.update({
        where: { id: robots.id },
        data: { content: currentContent },
      });
    }

    // Probe live endpoints and verify semantically
    const live = await probeLiveEndpoints(publicUrl, sitemapUrl);
    const verification = verifyRobotsSemantic({
      cmsContent: currentContent,
      publicContent: live.robotsContent,
      publicRobotsHttpStatus: live.robotsHttpStatus,
      publicSitemapHttpStatus: live.sitemapHttpStatus,
      expectedSitemapUrl: sitemapUrl,
      connectedDomain: domain,
    });

    return NextResponse.json({
      data: {
        ...robots,
        content: currentContent,
        publicUrl,
        sitemapUrl,
        domain,
        liveContent: live.robotsContent,
        publicHttpStatus: live.robotsHttpStatus,
        publicSitemapHttpStatus: live.sitemapHttpStatus,
        isLiveSynced: verification.isLiveSynced,
        status: verification.status,
        statusLabel: verification.statusLabel,
        publishingStatus: verification.status,
        publishingMessage: verification.message,
        verificationDetails: verification.details,
      },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:ROBOTS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch robots.txt' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PUT — save robots.txt content & re-verify semantically
// =====================================================================

export async function PUT(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { requestId: id, timestamp: new Date().toISOString() },
        },
        { status: 400 },
      );
    }

    const siteFilter = await getSiteWhere(request);
    const { baseUrl, siteId, domain } = await resolveConnectedBaseUrl(request, siteFilter);
    const publicUrl = `${baseUrl}/robots.txt`;
    const sitemapUrl = `${baseUrl}/sitemap.xml`;

    let cleanContent = parsed.data.content;
    cleanContent = cleanContent
      .replace(/https:\/\/cms\.example\.com/g, baseUrl)
      .replace(/https:\/\/example\.com/g, baseUrl);

    // If Sitemap line is empty, inject the real sitemap URL
    if (/Sitemap:\s*(\n|$)/i.test(cleanContent)) {
      cleanContent = cleanContent.replace(/Sitemap:\s*(\n|$)/gi, `Sitemap: ${sitemapUrl}$1`);
    }

    let robots = await db.robotsTxt.findFirst({
      where: siteId ? { siteId } : siteFilter,
    });

    let result;
    if (robots) {
      result = await db.robotsTxt.update({
        where: { id: robots.id },
        data: { content: cleanContent },
      });
    } else {
      result = await db.robotsTxt.create({
        data: {
          content: cleanContent,
          siteId: siteId || (siteFilter.siteId as string) || undefined,
        },
      });
    }

    // Probe live endpoints and verify semantically
    const live = await probeLiveEndpoints(publicUrl, sitemapUrl);
    const verification = verifyRobotsSemantic({
      cmsContent: cleanContent,
      publicContent: live.robotsContent,
      publicRobotsHttpStatus: live.robotsHttpStatus,
      publicSitemapHttpStatus: live.sitemapHttpStatus,
      expectedSitemapUrl: sitemapUrl,
      connectedDomain: domain,
    });

    return NextResponse.json({
      data: {
        ...result,
        publicUrl,
        sitemapUrl,
        domain,
        liveContent: live.robotsContent,
        publicHttpStatus: live.robotsHttpStatus,
        publicSitemapHttpStatus: live.sitemapHttpStatus,
        isLiveSynced: verification.isLiveSynced,
        status: verification.status,
        statusLabel: verification.statusLabel,
        publishingStatus: verification.status,
        message: verification.message,
        publishingMessage: verification.message,
        verificationDetails: verification.details,
      },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:ROBOTS:PUT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save robots.txt' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — on-demand verification action: POST /api/seo/robots?action=verify
// =====================================================================

export async function POST(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const action = sp.get('action') || 'verify';

    const siteFilter = await getSiteWhere(request);
    const { baseUrl, siteId, domain } = await resolveConnectedBaseUrl(request, siteFilter);
    const publicUrl = `${baseUrl}/robots.txt`;
    const sitemapUrl = `${baseUrl}/sitemap.xml`;

    const robots = await db.robotsTxt.findFirst({
      where: siteId ? { siteId } : siteFilter,
    });

    const currentContent = robots?.content || `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}`;

    // Probe live endpoints
    const live = await probeLiveEndpoints(publicUrl, sitemapUrl);
    const verification = verifyRobotsSemantic({
      cmsContent: currentContent,
      publicContent: live.robotsContent,
      publicRobotsHttpStatus: live.robotsHttpStatus,
      publicSitemapHttpStatus: live.sitemapHttpStatus,
      expectedSitemapUrl: sitemapUrl,
      connectedDomain: domain,
    });

    return NextResponse.json({
      data: {
        ...robots,
        content: currentContent,
        publicUrl,
        sitemapUrl,
        domain,
        liveContent: live.robotsContent,
        publicHttpStatus: live.robotsHttpStatus,
        publicSitemapHttpStatus: live.sitemapHttpStatus,
        isLiveSynced: verification.isLiveSynced,
        status: verification.status,
        statusLabel: verification.statusLabel,
        publishingStatus: verification.status,
        publishingMessage: verification.message,
        verificationDetails: verification.details,
      },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:ROBOTS:POST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to verify robots.txt' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
