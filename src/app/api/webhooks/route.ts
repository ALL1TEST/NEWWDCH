// ============================================================
// GET  /api/webhooks      — List webhooks (paginated, filterable)
// POST /api/webhooks      — Create a webhook
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import { getSiteWhere, getSiteFromRequest } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

const listIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  _count: { select: { deliveries: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim(),
  url: z
    .string()
    .min(1, 'URL is required')
    .max(2048, 'URL must be 2048 characters or less')
    .trim()
    .refine(
      (v) => {
        try {
          const u = new URL(v);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'URL must be a valid HTTP or HTTPS URL' },
    ),
  secret: z.string().max(500).optional().or(z.literal('')),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  isActive: z.boolean().default(true),
  createdById: z.string().min(1).optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'isActive']);

// ---------- transform helpers ----------------------------------------

/** Strip secret from webhook objects returned to the client */
function maskWebhook(item: Record<string, unknown>) {
  const result = { ...item };
  delete (result as Record<string, unknown>).secret;
  (result as Record<string, unknown>).hasSecret = !!(item as Record<string, unknown>).secret;
  // Parse events from JSON string to array
  if (typeof (result as Record<string, unknown>).events === 'string') {
    try {
      (result as Record<string, unknown>).events = JSON.parse((result as Record<string, unknown>).events as string);
    } catch {
      (result as Record<string, unknown>).events = [];
    }
  }
  return result;
}

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const isActive = sp.get('isActive');
    const search = sp.get('search') || undefined;

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { url: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.webhook.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.webhook.count({ where }),
    ]);

    const masked = items.map(maskWebhook);

    return NextResponse.json({
      data: masked,
      meta: {
        requestId: '',
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error('[WEBHOOKS:LIST] —', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhooks' }, meta: { requestId: '' } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create
// =====================================================================

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: '' } },
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
          meta: { requestId: '' },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;

    // Resolve siteId from request (never trust client-provided)
    const siteId = await getSiteFromRequest(request);

    // Fallback createdById to first user if not provided
    let createdById = d.createdById;
    if (!createdById) {
      const firstUser = await db.user.findFirst({ select: { id: true } });
      if (!firstUser) {
        return NextResponse.json(
          { error: { code: 'NO_USER', message: 'No user found to assign as creator' }, meta: { requestId: '' } },
          { status: 400 },
        );
      }
      createdById = firstUser.id;
    }

    const item = await db.webhook.create({
      data: {
        siteId: siteId || undefined,
        name: d.name,
        url: d.url,
        secret: d.secret === '' ? null : d.secret ?? null,
        events: JSON.stringify(d.events),
        isActive: d.isActive,
        createdById,
      },
      include: listIncludes,
    });

    return NextResponse.json({ data: maskWebhook(item as unknown as Record<string, unknown>), meta: { requestId: '' } }, { status: 201 });
  } catch (error) {
    console.error('[WEBHOOKS:CREATE] —', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create webhook' }, meta: { requestId: '' } },
      { status: 500 },
    );
  }
}
