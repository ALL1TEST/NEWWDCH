import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';

function reqId() {
  return 'req_' + nanoid(8);
}

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_analytics');
  if ('response' in auth) return auth.response;
  const id = reqId();
  try {
    const sp = new URL(request.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 10));

    const siteFilter = await getSiteWhere(request);

    const items = await db.contentItem.findMany({
      where: { ...siteFilter, deletedAt: null },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        viewCount: true,
        status: true,
      },
    });

    const data = items.map((item) => ({
      id: item.id,
      title: item.title,
      views: item.viewCount,
      status: item.status,
    }));

    return NextResponse.json({
      data,
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[ANALYTICS:TOP_CONTENT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch top content' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
