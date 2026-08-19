import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';

function reqId() {
  return 'req_' + nanoid(8);
}

export async function GET(request: NextRequest) {
  const id = reqId();
  try {
    const sp = new URL(request.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 20));
    const eventType = sp.get('eventType') || undefined;

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (eventType) where.eventType = eventType;

    const items = await db.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const data = items.map((item) => ({
      id: item.id,
      eventType: item.eventType,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      sessionId: item.sessionId,
      data: item.data,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      createdAt: item.createdAt.toISOString(),
    }));

    return NextResponse.json({
      data,
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[ANALYTICS:EVENTS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics events' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
