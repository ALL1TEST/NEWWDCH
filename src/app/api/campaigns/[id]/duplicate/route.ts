// ============================================================
// POST /api/campaigns/[id]/duplicate — Duplicate a campaign
// ============================================================
//
// Creates a NEW campaign as DRAFT based on the source campaign's
// configuration. Copies templateId, contentOverride, subject, name
// (with " (Copy)" suffix). Does NOT copy: status (always DRAFT),
// scheduledAt, sentAt, recipientCount (recalculated), openCount,
// clickCount, errorMessage.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { countEligibleSubscribers } from '@/lib/campaign-service';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: campaignId } = await context.params;

    const campaign = await db.newsletterCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Campaign not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Recalculate recipient count for the duplicate (based on current
    // eligible subscribers, not the original's count).
    const recipientCount = await countEligibleSubscribers();

    const duplicate = await db.newsletterCampaign.create({
      data: {
        name: `${campaign.name} (Copy)`,
        subject: campaign.subject,
        contentOverride: campaign.contentOverride,
        templateId: campaign.templateId,
        status: 'DRAFT',
        recipientCount,
        createdById: campaign.createdById,
      },
    });

    return NextResponse.json({ data: duplicate, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[CAMPAIGNS:DUPLICATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to duplicate campaign' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
