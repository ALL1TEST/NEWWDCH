// ============================================================
// POST /api/campaigns/[id]/retry — Retry a failed campaign
// ============================================================
//
// Only FAILED campaigns can be retried. Resets the campaign to
// DRAFT so the admin can fix any issues, then triggers sendCampaign.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { sendCampaign } from '@/lib/campaign-service';

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

    if (existing.status !== 'FAILED') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATUS', message: `Cannot retry a campaign with status "${existing.status}". Only Failed campaigns can be retried.` }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Reset error state + retry the send
    await db.newsletterCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'DRAFT',
        errorMessage: null,
      },
    });

    const result = await sendCampaign(campaignId);

    return NextResponse.json({
      data: result,
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[CAMPAIGNS:RETRY] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to retry campaign' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
