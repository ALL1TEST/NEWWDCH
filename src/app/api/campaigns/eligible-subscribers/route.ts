// ============================================================
// GET /api/campaigns/eligible-subscribers — List subscribers
// eligible to receive campaigns (status=SUBSCRIBED only).
// ============================================================
//
// Used by the Create Campaign dialog's audience selector to show
// the live recipient count and allow selecting specific subscribers.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';

function reqId() {
  return 'req_' + nanoid(8);
}

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'newsletter');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter, status: 'SUBSCRIBED' };

    const [subscribers, total] = await Promise.all([
      db.newsletterSubscriber.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          source: true,
          subscribedAt: true,
        },
        orderBy: { subscribedAt: 'desc' },
      }),
      db.newsletterSubscriber.count({ where }),
    ]);

    return NextResponse.json({
      data: subscribers,
      meta: {
        requestId: id,
        total,
      },
    });
  } catch (error) {
    console.error(`[CAMPAIGNS:ELIGIBLE_SUBSCRIBERS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch eligible subscribers' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
