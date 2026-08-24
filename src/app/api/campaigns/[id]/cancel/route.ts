// ============================================================
// POST /api/campaigns/[id]/cancel — Cancel a scheduled campaign
// ============================================================
//
// Only SCHEDULED campaigns can be cancelled. Sets status=CANCELLED
// and clears the scheduledAt date.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: campaignId } = await context.params;

    const existing = await db.newsletterCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Campaign not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    if (existing.status !== 'SCHEDULED') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATUS', message: `Cannot cancel a campaign with status "${existing.status}". Only Scheduled campaigns can be cancelled.` }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const item = await db.newsletterCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'CANCELLED',
        scheduledAt: null,
      },
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CAMPAIGNS:CANCEL] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel campaign' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
