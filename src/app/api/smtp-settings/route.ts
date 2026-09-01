// ============================================================
// GET  /api/smtp-settings      — List SMTP settings (paginated, filterable)
// POST /api/smtp-settings      — Create SMTP settings
// ============================================================
// ENTITLEMENT GATE — the SMTP settings management API. SMTP Settings
// is NOT an independent plan feature but supporting configuration
// for Email Templates + Newsletter: reachable only while the plan's
// Feature Access enables at least ONE of them (both disabled → 403
// FEATURE_NOT_AVAILABLE on every method). Platform staff pass.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAnyFeatureAllowStaff } from '@/lib/platform/platform-auth';
import { SMTP_DEPENDENT_FEATURES } from '@/lib/platform/feature-config';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- validation ------------------------------------------------

const PROVIDERS = ['SMTP', 'SES', 'RESEND', 'MAILGUN', 'SENDGRID', 'POSTMARK', 'BREVO', 'ELASTIC_EMAIL'] as const;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim(),
  provider: z.enum(PROVIDERS).default('SMTP'),
  host: z.string().max(300).trim().default(''),
  port: z.number().int().min(1).max(65535).default(587),
  username: z.string().max(200).trim().default(''),
  password: z.string().max(500).default(''),
  fromName: z.string().max(200).trim().default(''),
  fromEmail: z.string().email().max(200).trim().default('').or(z.literal('')),
  replyTo: z.string().email().max(200).trim().default('').or(z.literal('')),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'provider', 'isActive']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  // SMTP Settings derived-entitlement gate (Email Templates OR Newsletter).
  const featureAuth = await requireAnyFeatureAllowStaff(request, [...SMTP_DEPENDENT_FEATURES]);
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const provider = sp.get('provider') || undefined;
    const isActive = sp.get('isActive');

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (provider && PROVIDERS.includes(provider as typeof PROVIDERS[number])) where.provider = provider;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.smtpSetting.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.smtpSetting.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[SMTP_SETTINGS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SMTP settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  // SMTP Settings derived-entitlement gate (Email Templates OR Newsletter).
  const featureAuth = await requireAnyFeatureAllowStaff(request, [...SMTP_DEPENDENT_FEATURES]);
  if ('response' in featureAuth) return featureAuth.response;

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

    const item = await db.smtpSetting.create({
      data: {
        siteId: siteId || undefined,
        name: d.name,
        provider: d.provider,
        host: d.host,
        port: d.port,
        username: d.username,
        password: d.password,
        fromName: d.fromName,
        fromEmail: d.fromEmail === '' ? '' : d.fromEmail,
        replyTo: d.replyTo === '' ? '' : d.replyTo,
        isDefault: d.isDefault,
        isActive: d.isActive,
      },
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[SMTP_SETTINGS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create SMTP settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
