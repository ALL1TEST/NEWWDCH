// ============================================================
// GET /api/seo/search-console/stats — Daily stats for charting (last 30 days)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const days = Math.min(180, Math.max(1, Number(sp.get('days')) || 30));

    // The chart supports both a "last N days" preset and a custom date range.
    // `from`/`to` (YYYY-MM-DD) take precedence when both are supplied; otherwise
    // we fall back to the `days` preset so the endpoint stays backward-compatible.
    const fromParam = sp.get('from');
    const toParam = sp.get('to');

    let fromDate: string;
    let toDate: string;
    if (fromParam && toParam) {
      fromDate = fromParam;
      toDate = toParam;
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      fromDate = start.toISOString().split('T')[0];
      toDate = end.toISOString().split('T')[0];
    }

    const siteFilter = await getSiteWhere(request);

    const connection = await db.searchConsoleConnection.findFirst({
      where: siteFilter,
    });

    if (!connection) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No Search Console connection found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    // Date strings are ISO (YYYY-MM-DD), so lexical comparison == chronological
    // comparison. Bounds are inclusive on both ends.
    const stats = await db.searchConsoleStat.findMany({
      where: {
        connectionId: connection.id,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      data: stats,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
        range: { from: fromDate, to: toDate, days: fromParam && toParam ? 0 : days },
      },
    });
  } catch (error) {
    console.error(`[SEO:SC:STATS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch Search Console stats' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
