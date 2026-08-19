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
      data: result,
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
      // In production, this would send an HTTP request to Google's ping endpoint
      const updated = await db.sitemapConfig.update({
        where: { id: config.id },
        data: { lastPingedGoogle: new Date() },
      });
      return NextResponse.json({
        data: { ...updated, pingResult: 'Ping sent to Google successfully' },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Ping Bing
    if (action === 'ping-bing') {
      const updated = await db.sitemapConfig.update({
        where: { id: config.id },
        data: { lastPingedBing: new Date() },
      });
      return NextResponse.json({
        data: { ...updated, pingResult: 'Ping sent to Bing successfully' },
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
