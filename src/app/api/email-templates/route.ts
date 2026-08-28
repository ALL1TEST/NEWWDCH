// ============================================================
// GET  /api/email-templates      — List email templates (paginated, filterable)
// POST /api/email-templates      — Create an email template
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

function kebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const listIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  _count: { select: { versions: true } },
} as const;

// ---------- validation ------------------------------------------------

const CATEGORIES = ['CUSTOMER_EMAILS', 'AUTHENTICATION', 'NEWSLETTER', 'MARKETING', 'TRANSACTIONAL', 'NOTIFICATIONS', 'BILLING', 'SYSTEM'] as const;
const STATUSES = ['ENABLED', 'DISABLED', 'DRAFT'] as const;
const PROVIDERS = ['SMTP', 'SES', 'RESEND', 'MAILGUN', 'SENDGRID', 'POSTMARK', 'BREVO', 'ELASTIC_EMAIL'] as const;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim(),
  subject: z.string().max(500, 'Subject must be 500 characters or less').trim().default(''),
  previewText: z.string().max(500).trim().default(''),
  htmlBody: z.string().default(''),
  fromName: z.string().max(200).trim().default(''),
  fromEmail: z.string().email().max(200).trim().default('').or(z.literal('')),
  replyTo: z.string().email().max(200).trim().default('').or(z.literal('')),
  language: z.string().max(10).default('en'),
  category: z.enum(CATEGORIES).default('SYSTEM'),
  status: z.enum(STATUSES).default('DRAFT'),
  provider: z.enum(PROVIDERS).default('SMTP'),
  trackOpens: z.boolean().default(true),
  trackClicks: z.boolean().default(true),
  enableAttachments: z.boolean().default(false),
  createdById: z.string().min(1).optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'category', 'status']);

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
    const category = sp.get('category') || undefined;
    const status = sp.get('status') || undefined;
    const search = sp.get('search') || undefined;
    const scope = sp.get('scope');

    // -------- scope=platform: platform-admin-only view of system templates
    // (siteId IS NULL). Falls through to the default client behavior when
    // the param is absent so existing callers keep working as before.
    let siteFilter: Record<string, unknown> = {};
    if (scope === 'platform') {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      siteFilter = { siteId: null };
    } else {
      siteFilter = await getSiteWhere(request);
    }

    const where: Record<string, unknown> = { ...siteFilter };
    if (category && CATEGORIES.includes(category as typeof CATEGORIES[number])) where.category = category;
    if (status && STATUSES.includes(status as typeof STATUSES[number])) where.status = status;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.emailTemplate.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.emailTemplate.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch email templates' }, meta: { requestId: id } },
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

    // -------- scope=platform: platform admin can create system templates
    // (siteId = null). When scope is absent, behave exactly as before —
    // client-side templates pick up siteId from the query string / context.
    const isPlatformScope =
      typeof body === 'object' && body !== null && (body as { scope?: unknown }).scope === 'platform';

    let platformUser: { id: string } | null = null;
    if (isPlatformScope) {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      platformUser = { id: auth.user.id };
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
    let slug = kebabCase(d.name);

    // Resolve createdById — platform scope uses the authenticated admin;
    // client scope falls back to ?siteId / first user as before.
    let createdById = d.createdById;
    if (isPlatformScope && platformUser) {
      createdById = platformUser.id;
    }
    if (!createdById) {
      const firstUser = await db.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
      createdById = firstUser?.id;
      if (!createdById) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'No user found to assign as creator. Please ensure you are logged in.' }, meta: { requestId: id } },
          { status: 400 },
        );
      }
    }

    // Ensure slug uniqueness — append suffix if collision
    let slugCandidate = slug;
    let counter = 1;
    while (await db.emailTemplate.findUnique({ where: { slug: slugCandidate } })) {
      slugCandidate = `${slug}-${counter++}`;
    }
    slug = slugCandidate;

    // Platform-scope templates are always system-level (siteId = null).
    // Client-scope templates use ?siteId from the query (existing behavior).
    const siteId = isPlatformScope ? null : request.nextUrl.searchParams.get('siteId');

    const item = await db.emailTemplate.create({
      data: {
        siteId: siteId || undefined,
        name: d.name,
        slug,
        subject: d.subject,
        previewText: d.previewText,
        htmlBody: d.htmlBody,
        fromName: d.fromName,
        fromEmail: d.fromEmail === '' ? '' : d.fromEmail,
        replyTo: d.replyTo === '' ? '' : d.replyTo,
        language: d.language,
        category: d.category,
        status: d.status,
        provider: d.provider,
        trackOpens: d.trackOpens,
        trackClicks: d.trackClicks,
        enableAttachments: d.enableAttachments,
        defaultBody: d.htmlBody,
        createdById,
      },
      include: listIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create email template' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
