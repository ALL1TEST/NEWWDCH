// ============================================================
// GET    /api/campaigns/[id] — Get single campaign
// PATCH  /api/campaigns/[id] — Update campaign
// DELETE /api/campaigns/[id] — Delete campaign
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const fullIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  template: { select: { id: true, name: true, subject: true, htmlBody: true, category: true, fromName: true, fromEmail: true, replyTo: true } },
} as const;

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  subject: z.string().min(1).max(500).trim().optional(),
  content: z.string().optional().or(z.literal('')),
  contentOverride: z.string().optional().or(z.literal('')),
  templateId: z.string().optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED']).optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional().or(z.literal('')),
  recipientCount: z.number().int().min(0).optional(),
  openCount: z.number().int().min(0).optional(),
  clickCount: z.number().int().min(0).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: campaignId } = await context.params;

    const item = await db.newsletterCampaign.findUnique({
      where: { id: campaignId },
      include: fullIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Campaign not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CAMPAIGNS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch campaign' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: campaignId } = await context.params;

    const existing = await db.newsletterCampaign.findUnique({ where: { id: campaignId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Campaign not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (d.name !== undefined) updateData.name = d.name;
    if (d.subject !== undefined) updateData.subject = d.subject;
    if (d.content !== undefined) updateData.content = d.content === '' ? null : d.content;
    if (d.contentOverride !== undefined) updateData.contentOverride = d.contentOverride === '' ? null : d.contentOverride;
    if (d.templateId !== undefined) updateData.templateId = d.templateId === '' ? null : d.templateId;
    if (d.status !== undefined) {
      updateData.status = d.status;
      if (d.status === 'SENT' && !existing.sentAt) {
        updateData.sentAt = new Date();
      }
    }
    if (d.scheduledAt !== undefined) updateData.scheduledAt = d.scheduledAt === '' ? null : d.scheduledAt ? new Date(d.scheduledAt) : null;
    if (d.recipientCount !== undefined) updateData.recipientCount = d.recipientCount;
    if (d.openCount !== undefined) updateData.openCount = d.openCount;
    if (d.clickCount !== undefined) updateData.clickCount = d.clickCount;

    const item = await db.newsletterCampaign.update({
      where: { id: campaignId },
      data: updateData,
      include: fullIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CAMPAIGNS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update campaign' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — hard delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: campaignId } = await context.params;

    const existing = await db.newsletterCampaign.findUnique({ where: { id: campaignId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Campaign not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.newsletterCampaign.delete({ where: { id: campaignId } });

    return NextResponse.json({ data: { id: campaignId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CAMPAIGNS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete campaign' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
