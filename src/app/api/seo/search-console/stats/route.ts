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
    const days = Math.min(90, Math.max(1, Number(sp.get('days')) || 30));

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

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await db.searchConsoleStat.findMany({
      where: {
        connectionId: connection.id,
        date: { gte: startDate.toISOString().split('T')[0] },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      data: stats,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
        range: { from: startDate.toISOString().split('T')[0], to: endDate.toISOString().split('T')[0], days },
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
