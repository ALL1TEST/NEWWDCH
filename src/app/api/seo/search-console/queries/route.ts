// ============================================================
// GET /api/seo/search-console/queries — Top search queries (paginated)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';

const SORTABLE = new Set(['clicks', 'impressions', 'ctr', 'position', 'query']);

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
      where.query = { contains: search };
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.searchConsoleQuery.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.searchConsoleQuery.count({ where }),
    ]);

    return NextResponse.json({
      data: { data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error) {
    console.error(`[SEO:SC:QUERIES] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch top queries' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
