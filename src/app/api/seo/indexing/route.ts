// ============================================================
// GET  /api/seo/indexing      — List indexing records (paginated, filterable)
// POST /api/seo/indexing      — Create indexing record / scan content
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  pageUrl: z.string().min(1, 'Page URL is required').max(2048),
  status: z.enum(['INDEXED', 'PENDING', 'EXCLUDED', 'DISCOVERED', 'ERROR']).default('PENDING'),
  lastCrawl: z.string().datetime({ offset: true }).optional(),
  lastIndexed: z.string().datetime({ offset: true }).optional(),
  coverageError: z.string().optional(),
});

const SORTABLE = new Set(['createdAt', 'updatedAt', 'title', 'pageUrl', 'status', 'lastCrawl']);

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
    const status = sp.get('status') || undefined;
    const search = sp.get('search') || '';

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { pageUrl: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.indexingRecord.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.indexingRecord.count({ where }),
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
    console.error(`[SEO:INDEXING:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch indexing records' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
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

    // Scan action: create indexing records for published content items
    if (action === 'scan') {
      const siteFilter = await getSiteWhere(request);
      const siteId = siteFilter.siteId;

      const publishedItems = await db.contentItem.findMany({
        where: { ...siteFilter, status: 'PUBLISHED', deletedAt: null },
        select: { id: true, title: true, slug: true, publishedAt: true },
      });

      if (publishedItems.length === 0) {
        return NextResponse.json({
          data: { scanned: 0, created: 0, message: 'No published content items found to scan' },
          meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
        });
      }

      let created = 0;
      for (const item of publishedItems) {
        // Check if record already exists for this content item
        const existing = await db.indexingRecord.findFirst({
          where: { siteId: siteId || undefined, pageUrl: { contains: item.slug } },
        });
        if (!existing) {
          await db.indexingRecord.create({
            data: {
              title: item.title,
              pageUrl: `/${item.slug}`,
              status: 'PENDING',
              lastCrawl: item.publishedAt,
              siteId: siteId || undefined,
            },
          });
          created++;
        }
      }

      return NextResponse.json({
        data: { scanned: publishedItems.length, created, message: `Scanned ${publishedItems.length} items, created ${created} indexing records` },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Default: create single indexing record
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

    const item = await db.indexingRecord.create({
      data: {
        title: d.title,
        pageUrl: d.pageUrl,
        status: d.status,
        lastCrawl: d.lastCrawl ? new Date(d.lastCrawl) : null,
        lastIndexed: d.lastIndexed ? new Date(d.lastIndexed) : null,
        coverageError: d.coverageError,
        siteId: siteFilter.siteId || undefined,
      },
    });

    return NextResponse.json({ data: item, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } }, { status: 201 });
  } catch (error) {
    console.error(`[SEO:INDEXING:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create indexing record' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
