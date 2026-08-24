// ============================================================
// GET  /api/campaigns      — List campaigns (paginated, filterable)
// POST /api/campaigns      — Create a campaign
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const listIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim(),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be 500 characters or less').trim(),
  content: z.string().optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'FAILED']).default('DRAFT'),
  scheduledAt: z.string().optional().or(z.literal('')),
  createdById: z.string().min(1).optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'status', 'scheduledAt']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
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

    // Transform DB records: compute openRate/clickRate percentages from
    // openCount/clickCount + recipientCount. The frontend's CampaignRow
    // type expects `openRate` and `clickRate` as percentages (numbers),
    // not raw counts.
    const transformed = items.map((item) => {
      const recipientCount = item.recipientCount || 0;
      const openRate = recipientCount > 0 ? (item.openCount / recipientCount) * 100 : undefined;
      const clickRate = recipientCount > 0 ? (item.clickCount / recipientCount) * 100 : undefined;
      return {
        id: item.id,
        name: item.name,
        subject: item.subject,
        content: item.content,
        status: item.status,
        scheduledAt: item.scheduledAt?.toISOString() ?? null,
        sentAt: item.sentAt?.toISOString() ?? null,
        recipientCount: item.recipientCount,
        openCount: item.openCount,
        clickCount: item.clickCount,
        openRate: openRate !== undefined ? Math.round(openRate * 10) / 10 : undefined,
        clickRate: clickRate !== undefined ? Math.round(clickRate * 10) / 10 : undefined,
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
// POST — create
// =====================================================================

export async function POST(request: NextRequest) {
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

    // Resolve createdById: use provided value, or fall back to first user in DB
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

    // Parse scheduledAt: HTML datetime-local gives "2024-01-15T10:00" (no timezone)
    let parsedScheduledAt: Date | null = null;
    if (d.scheduledAt && d.scheduledAt !== '') {
      try {
        parsedScheduledAt = new Date(d.scheduledAt);
      } catch {
        // ignore invalid date
      }
    }

    const item = await db.newsletterCampaign.create({
      data: {
        siteId: siteId || undefined,
        name: d.name,
        subject: d.subject,
        content: d.content === '' ? null : d.content ?? null,
        status: d.status,
        scheduledAt: parsedScheduledAt,
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
