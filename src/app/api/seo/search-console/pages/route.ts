// ============================================================
// GET /api/seo/search-console/pages — Top pages (paginated)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';

const SORTABLE = new Set(['clicks', 'impressions', 'ctr', 'position', 'pageUrl']);

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'clicks';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const search = sp.get('search') || '';

    const siteFilter = await getSiteWhere(request);

    const connection = await db.searchConsoleConnection.findFirst({ where: siteFilter });
    if (!connection) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No Search Console connection found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    const where: Record<string, unknown> = { connectionId: connection.id };
    if (search) {
      where.pageUrl = { contains: search };
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.searchConsolePage.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.searchConsolePage.count({ where }),
    ]);

    // Resolve each page URL to a CMS ContentItem so the UI can render a real
    // INTERNAL link that navigates to the article (via the #content/:id hash
    // route). We extract the last path segment as the candidate slug and batch
    // a single ContentItem lookup. Pages with no match get contentId=null and
    // fall back to a plain anchor using the exact path from the data.
    const candidateSlugs = Array.from(
      new Set(
        items
          .map((p) => {
            try {
              // Treat relative paths (and absolute URLs) uniformly by parsing
              // against a dummy origin; only the pathname interests us.
              const u = new URL(p.pageUrl, 'http://example.com');
              const parts = u.pathname.split('/').filter(Boolean);
              return parts[parts.length - 1] ?? null;
            } catch {
              return null;
            }
          })
          .filter((s): s is string => !!s && s.length > 0),
      ),
    );

    const contentItems =
      candidateSlugs.length > 0
        ? await db.contentItem.findMany({
            where: { slug: { in: candidateSlugs } },
            select: { id: true, slug: true },
          })
        : [];
    const slugToContentId = new Map(contentItems.map((c) => [c.slug, c.id]));

    // Normalize CTR to a fraction (0-1) so the frontend's formatPercent(n*100) works consistently.
    const normalized = items.map((p) => {
      let slug: string | null = null;
      try {
        const u = new URL(p.pageUrl, 'http://example.com');
        const parts = u.pathname.split('/').filter(Boolean);
        slug = parts[parts.length - 1] ?? null;
      } catch {
        slug = null;
      }
      return {
        ...p,
        ctr: p.ctr > 1 ? p.ctr / 100 : p.ctr,
        contentId: (slug && slugToContentId.get(slug)) || null,
      };
    });

    return NextResponse.json({
      data: { data: normalized, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error) {
    console.error(`[SEO:SC:PAGES] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch top pages' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
