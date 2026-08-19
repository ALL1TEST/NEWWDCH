// ============================================================
// GET /api/seo/canonicals — Analyze canonical URLs across content
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);

    // Fetch published content
    const publishedItems = await db.contentItem.findMany({
      where: { ...siteFilter, status: 'PUBLISHED', deletedAt: null },
      select: { id: true, title: true, slug: true, siteId: true },
    });

    // Fetch SEO configs
    const resourceIds = publishedItems.map((p) => p.id);
    const seoConfigs = resourceIds.length > 0
      ? await db.seoConfig.findMany({
          where: { resourceType: 'content', resourceId: { in: resourceIds }, ...siteFilter },
          select: { resourceId: true, canonicalUrl: true },
        })
      : [];
    const seoConfigMap = new Map(seoConfigs.map((c) => [c.resourceId, c.canonicalUrl || null]));

    // Fetch site domain
    const site = siteFilter.siteId
      ? await db.site.findFirst({ where: { id: siteFilter.siteId }, select: { domain: true } })
      : await db.site.findFirst({ select: { domain: true } });
    const siteDomain = site?.domain || null;

    const items: { contentId: string; title: string; slug: string; canonicalUrl: string | null; status: 'OK' | 'MISSING' | 'DUPLICATE' | 'EXTERNAL' | 'INVALID'; issue: string | null }[] = [];

    // Build a map of canonical URLs for duplicate detection
    const canonicalUsage = new Map<string, string[]>(); // canonicalUrl -> [contentId, ...]

    // First pass: determine each item's canonical URL (auto-generate if missing)
    const itemCanonicals = new Map<string, string | null>(); // contentId -> canonicalUrl

    for (const item of publishedItems) {
      const configCanonical = seoConfigMap.get(item.id);
      if (configCanonical && configCanonical.trim() !== '') {
        itemCanonicals.set(item.id, configCanonical);
        const existing = canonicalUsage.get(configCanonical) || [];
        existing.push(item.id);
        canonicalUsage.set(configCanonical, existing);
      } else {
        // Auto-generate canonical
        const itemSiteDomain = item.siteId
          ? (await db.site.findFirst({ where: { id: item.siteId }, select: { domain: true } }))?.domain || siteDomain || 'example.com'
          : siteDomain || 'example.com';
        const autoCanonical = `https://${itemSiteDomain}/${item.slug}`;
        itemCanonicals.set(item.id, autoCanonical);
      }
    }

    // Second pass: classify each item
    for (const item of publishedItems) {
      const configCanonical = seoConfigMap.get(item.id);
      const hasConfig = configCanonical !== undefined && configCanonical !== null;
      const canonicalUrl = itemCanonicals.get(item.id) || null;

      let status: 'OK' | 'MISSING' | 'DUPLICATE' | 'EXTERNAL' | 'INVALID' = 'OK';
      let issue: string | null = null;

      if (!hasConfig) {
        status = 'MISSING';
        issue = 'No canonical URL configured. Auto-generated canonical shown.';
      } else {
        // Validate the configured canonical
        try {
          const parsed = new URL(configCanonical!);
          if (siteDomain && parsed.hostname !== siteDomain) {
            status = 'EXTERNAL';
            issue = `Canonical points to external domain: ${parsed.hostname}`;
          } else if (canonicalUrl && canonicalUsage.get(canonicalUrl) && canonicalUsage.get(canonicalUrl)!.length > 1) {
            status = 'DUPLICATE';
            issue = `Canonical URL is used by ${canonicalUsage.get(canonicalUrl)!.length} pages`;
          }
        } catch {
          status = 'INVALID';
          issue = 'Canonical URL is not a valid URL';
        }
      }

      items.push({
        contentId: item.id,
        title: item.title,
        slug: item.slug,
        canonicalUrl,
        status,
        issue,
      });
    }

    // Summary
    const summary = {
      total: items.length,
      ok: items.filter((i) => i.status === 'OK').length,
      missing: items.filter((i) => i.status === 'MISSING').length,
      duplicate: items.filter((i) => i.status === 'DUPLICATE').length,
      external: items.filter((i) => i.status === 'EXTERNAL').length,
      invalid: items.filter((i) => i.status === 'INVALID').length,
    };

    return NextResponse.json({
      data: { items, summary },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:CANONICALS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze canonical URLs' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
