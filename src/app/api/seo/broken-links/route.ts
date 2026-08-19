// ============================================================
// GET  /api/seo/broken-links      — List broken links (paginated, filterable)
// POST /api/seo/broken-links      — Create broken link / trigger scan
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  brokenUrl: z.string().min(1, 'Broken URL is required').max(2048),
  sourcePage: z.string().min(1, 'Source page is required').max(2048),
  statusCode: z.number().int().optional(),
  linkType: z.enum(['INTERNAL', 'EXTERNAL', 'IMAGE', 'PDF', 'ANCHOR']).default('INTERNAL'),
  status: z.enum(['BROKEN', 'IGNORED', 'FIXED']).default('BROKEN'),
  anchorText: z.string().optional(),
});

const SORTABLE = new Set(['createdAt', 'updatedAt', 'detectedAt', 'brokenUrl', 'sourcePage', 'linkType', 'status', 'statusCode']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const linkType = sp.get('linkType') || undefined;
    const status = sp.get('status') || undefined;
    const search = sp.get('search') || '';

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (linkType) where.linkType = linkType;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { brokenUrl: { contains: search } },
        { sourcePage: { contains: search } },
        { anchorText: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.brokenLink.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.brokenLink.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[SEO:BROKEN_LINKS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch broken links' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create or scan
// =====================================================================

export async function POST(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const action = sp.get('action') || '';

    // Scan action: scan published content for broken links
    if (action === 'scan') {
      const siteFilter = await getSiteWhere(request);
      const siteId = siteFilter.siteId;

      const publishedItems = await db.contentItem.findMany({
        where: { ...siteFilter, status: 'PUBLISHED', deletedAt: null, content: { not: null } },
        select: { id: true, title: true, slug: true, content: true },
      });

      // Basic scan: extract links from content and check for common broken patterns
      // In production, this would make actual HTTP requests
      const linkRegex = /href=["']([^"']+)["']/g;
      let scanned = 0;
      let found = 0;

      for (const item of publishedItems) {
        scanned++;
        const content = item.content || '';
        const matches = [...content.matchAll(linkRegex)];

        for (const match of matches) {
          const url = match[1];
          // Check for common broken link patterns
          if (url.startsWith('http://') || url.startsWith('https://')) {
            // Check if it's an obvious broken link (contains '404', 'error', etc.)
            const isBroken = /404|not-found|undefined|null$/i.test(url);
            if (isBroken) {
              // Avoid duplicates
              const existing = await db.brokenLink.findFirst({
                where: { siteId: siteId || undefined, brokenUrl: url, sourcePage: `/${item.slug}` },
              });
              if (!existing) {
                await db.brokenLink.create({
                  data: {
                    brokenUrl: url,
                    sourcePage: `/${item.slug}`,
                    linkType: url.startsWith('https://example.com') || url.startsWith('/') ? 'INTERNAL' : 'EXTERNAL',
                    status: 'BROKEN',
                    siteId: siteId || undefined,
                  },
                });
                found++;
              }
            }
          }
        }
      }

      return NextResponse.json({
        data: { scanned, found, message: `Scanned ${scanned} pages, found ${found} new broken links` },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Default: create single broken link record
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const parsed = createSchema.safeParse(body);
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

    const d = parsed.data;
    const siteFilter = await getSiteWhere(request);

    const item = await db.brokenLink.create({
      data: {
        brokenUrl: d.brokenUrl,
        sourcePage: d.sourcePage,
        statusCode: d.statusCode,
        linkType: d.linkType,
        status: d.status,
        anchorText: d.anchorText,
        siteId: siteFilter.siteId || undefined,
      },
    });

    return NextResponse.json({ data: item, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } }, { status: 201 });
  } catch (error) {
    console.error(`[SEO:BROKEN_LINKS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create broken link' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
