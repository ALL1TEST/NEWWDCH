// ============================================================
// GET    /api/campaigns            — List campaigns (with template info)
// POST   /api/campaigns            — Create campaign (with templateId + audience)
// ============================================================
//
// Campaign = connects an Email Template + audience (subscribers) +
// subject + scheduling + sending + tracking.
//
// A campaign references a template (does NOT copy it). One campaign
// sends to many subscribers via CampaignDelivery records.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { sendCampaign, countEligibleSubscribers } from '@/lib/campaign-service';
import { requireFeature } from '@/lib/platform/platform-auth';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const listIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  template: { select: { id: true, name: true, subject: true, category: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200).trim(),
  subject: z.string().min(1, 'Subject line is required').max(500).trim(),
  templateId: z.string().min(1, 'An email template must be selected'),
  contentOverride: z.string().optional().or(z.literal('')),
  scheduledAt: z.string().optional().or(z.literal('')),
  createdById: z.string().min(1).optional(),
  // Audience: 'all' = all SUBSCRIBED subscribers, or an array of subscriber IDs
  audience: z.union([
    z.literal('all'),
    z.array(z.string()).min(1, 'At least one recipient is required'),
  ]).default('all'),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'status', 'scheduledAt']);

// =====================================================================
// GET — list (with template + computed openRate/clickRate)
// =====================================================================

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'newsletter');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const status = sp.get('status') || undefined;

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (status) where.status = status;

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.newsletterCampaign.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.newsletterCampaign.count({ where }),
    ]);

    // Transform: compute openRate/clickRate only for SENT campaigns.
    // Draft/Scheduled/Sending/Failed/Cancelled show undefined (—) because
    // no emails have been delivered yet.
    const transformed = items.map((item) => {
      const isSent = item.status === 'SENT';
      const recipientCount = item.recipientCount || 0;
      const openRate = isSent && recipientCount > 0
        ? Math.round((item.openCount / recipientCount) * 1000) / 10
        : undefined;
      const clickRate = isSent && recipientCount > 0
        ? Math.round((item.clickCount / recipientCount) * 1000) / 10
        : undefined;
      return {
        id: item.id,
        name: item.name,
        subject: item.subject,
        content: item.content,
        contentOverride: item.contentOverride,
        templateId: item.templateId,
        template: item.template,
        status: item.status,
        scheduledAt: item.scheduledAt?.toISOString() ?? null,
        sentAt: item.sentAt?.toISOString() ?? null,
        recipientCount: item.recipientCount,
        openCount: item.openCount,
        clickCount: item.clickCount,
        openRate,
        clickRate,
        errorMessage: item.errorMessage,
        createdById: item.createdById,
        createdBy: item.createdBy,
        siteId: item.siteId,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      data: transformed,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[CAMPAIGNS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch campaigns' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create campaign (with templateId + audience)
// =====================================================================

export async function POST(request: NextRequest) {
  const auth = await requireFeature(request, 'newsletter');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = createSchema.safeParse(body);
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
    const siteId = request.nextUrl.searchParams.get('siteId');

    // Validate that the template exists
    const template = await db.emailTemplate.findUnique({
      where: { id: d.templateId },
      select: { id: true, name: true, htmlBody: true },
    });
    if (!template) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Selected email template was not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Resolve createdById
    let createdById = d.createdById;
    if (!createdById) {
      const firstUser = await db.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
      createdById = firstUser?.id;
      if (!createdById) {
        return NextResponse.json(
          { error: { code: 'NO_USER', message: 'No user found to assign as campaign creator' }, meta: { requestId: id } },
          { status: 400 },
        );
      }
    }

    // Resolve audience + recipientCount
    let recipientCount = 0;
    if (d.audience === 'all') {
      recipientCount = await countEligibleSubscribers();
    } else {
      // Count only the selected subscribers that are SUBSCRIBED
      recipientCount = await db.newsletterSubscriber.count({
        where: { id: { in: d.audience }, status: 'SUBSCRIBED' },
      });
    }

    if (recipientCount === 0) {
      return NextResponse.json(
        { error: { code: 'NO_RECIPIENTS', message: 'No eligible subscribers (status=SUBSCRIBED) found for this audience' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Parse scheduledAt — must be in the future if provided
    let parsedScheduledAt: Date | null = null;
    if (d.scheduledAt && d.scheduledAt !== '') {
      try {
        parsedScheduledAt = new Date(d.scheduledAt);
        if (parsedScheduledAt.getTime() < Date.now()) {
          return NextResponse.json(
            { error: { code: 'INVALID_SCHEDULE', message: 'Scheduled date/time must be in the future' }, meta: { requestId: id } },
            { status: 400 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: { code: 'INVALID_SCHEDULE', message: 'Invalid scheduled date/time format' }, meta: { requestId: id } },
          { status: 400 },
        );
      }
    }

    // Determine initial status: SCHEDULED if scheduledAt is set, DRAFT otherwise
    const initialStatus = parsedScheduledAt ? 'SCHEDULED' : 'DRAFT';

    const item = await db.newsletterCampaign.create({
      data: {
        siteId: siteId || undefined,
        name: d.name,
        subject: d.subject,
        contentOverride: d.contentOverride === '' ? null : d.contentOverride ?? null,
        templateId: d.templateId,
        status: initialStatus,
        scheduledAt: parsedScheduledAt,
        recipientCount,
        createdById,
      },
      include: listIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[CAMPAIGNS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create campaign' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
