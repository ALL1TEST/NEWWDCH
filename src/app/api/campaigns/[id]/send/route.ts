// ============================================================
// POST /api/campaigns/[id]/send — Send a campaign immediately
// ============================================================
//
// Triggers the campaign send: resolves eligible subscribers, creates
// CampaignDelivery records per subscriber, sends emails via SMTP,
// updates campaign status to SENDING → SENT/FAILED.
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

    // Only Draft, Failed, or Cancelled campaigns can be sent
    if (!['DRAFT', 'FAILED', 'CANCELLED'].includes(existing.status)) {
      return NextResponse.json(
        { error: { code: 'INVALID_STATUS', message: `Cannot send a campaign with status "${existing.status}". Only Draft, Failed, or Cancelled campaigns can be sent.` }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Send the campaign (async — the function handles the full flow)
    const result = await sendCampaign(campaignId);

    return NextResponse.json({
      data: result,
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[CAMPAIGNS:SEND] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to send campaign' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
