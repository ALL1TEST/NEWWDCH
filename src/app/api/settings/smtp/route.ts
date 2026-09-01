// ============================================================
// GET  /api/settings/smtp   — Fetch the default SMTP settings
// PUT  /api/settings/smtp   — Upsert the default SMTP settings
// ============================================================
// ENTITLEMENT GATE — SMTP Settings is NOT an independent plan feature
// but supporting configuration for the email-sending features: it is
// reachable only while the plan's Feature Access enables Email
// Templates OR Newsletter (requireAnyFeatureAllowStaff reads the
// active plan's saved Feature Access — never the plan name). With
// both dependents disabled every method denies 403
// FEATURE_NOT_AVAILABLE. Platform staff pass unconditionally — the
// platform SMTP page (#platform-smtp) manages the platform's own SMTP
// through these same endpoints.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { getSiteWhere } from '@/lib/site-context';
import { requireAnyFeatureAllowStaff } from '@/lib/platform/platform-auth';
import { SMTP_DEPENDENT_FEATURES } from '@/lib/platform/feature-config';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// -------------------- helpers --------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const PASSWORD_MASK = '••••••••';

// -------------------- validation --------------------

const upsertSchema = z.object({
  provider: z.string().trim().default('SMTP'),
  host: z.string().trim().max(300).default(''),
  port: z.number().int().min(1).max(65535).default(587),
  encryption: z.enum(['none', 'SSL', 'STARTTLS']).default('STARTTLS'),
  username: z.string().trim().max(200).default(''),
  password: z.string().max(2000).default(''),
  fromName: z.string().trim().max(200).default(''),
  fromEmail: z.string().trim().max(200).default(''),
  replyTo: z.string().trim().max(200).default(''),
  timeout: z.number().int().min(1).max(120).default(10),
  isActive: z.boolean().default(true),
});

// -------------------- GET --------------------

export async function GET(request: NextRequest) {
  const id = reqId();

  // SMTP Settings derived-entitlement gate (Email Templates OR Newsletter).
  const featureAuth = await requireAnyFeatureAllowStaff(request, [...SMTP_DEPENDENT_FEATURES]);
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { isDefault: true, ...siteFilter };

    const record = await db.smtpSetting.findFirst({ where });

    if (!record) {
      // Return a default config (no saved record yet)
      return NextResponse.json({
        data: {
          id: null,
          provider: 'SMTP',
          host: '',
          port: 587,
          encryption: 'STARTTLS',
          username: '',
          password: '',
          fromName: '',
          fromEmail: '',
          replyTo: '',
          timeout: 10,
          isActive: true,
          isDefault: true,
        },
        meta: { requestId: id, timestamp: new Date().toISOString() },
      });
    }

    return NextResponse.json({
      data: {
        id: record.id,
        provider: record.provider,
        host: record.host,
        port: record.port,
        encryption: record.encryption,
        username: record.username,
        // Mask the saved password for display
        password: record.password ? PASSWORD_MASK : '',
        fromName: record.fromName,
        fromEmail: record.fromEmail,
        replyTo: record.replyTo,
        timeout: record.timeout,
        isActive: record.isActive,
        isDefault: record.isDefault,
      },
      meta: { requestId: id, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error(`[SMTP_SETTINGS:GET] ${id} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch SMTP settings',
        },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }
}

// -------------------- PUT --------------------

export async function PUT(request: NextRequest) {
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
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { isDefault: true, ...siteFilter };

    // Find existing record to decide whether to update the password.
    const existing = await db.smtpSetting.findFirst({ where });

    // Password handling: if the user submitted the masked placeholder (or empty),
    // keep the existing saved password. Otherwise encrypt and store the new one.
    let passwordToStore = existing?.password ?? '';
    const isMaskedPlaceholder = !d.password || d.password.includes('•');
    if (!isMaskedPlaceholder) {
      passwordToStore = await encrypt(d.password);
    }

    // Build the upsert payload.
    const data = {
      name: 'default',
      provider: d.provider as 'SMTP',
      host: d.host,
      port: d.port,
      encryption: d.encryption,
      timeout: d.timeout,
      username: d.username,
      password: passwordToStore,
      fromName: d.fromName,
      fromEmail: d.fromEmail,
      replyTo: d.replyTo,
      isActive: d.isActive,
      isDefault: true,
      ...(siteFilter.siteId ? { siteId: siteFilter.siteId as string } : {}),
    };

    let record;
    if (existing) {
      record = await db.smtpSetting.update({
        where: { id: existing.id },
        data,
      });
    } else {
      record = await db.smtpSetting.create({ data });
    }

    return NextResponse.json({
      data: {
        id: record.id,
        provider: record.provider,
        host: record.host,
        port: record.port,
        encryption: record.encryption,
        username: record.username,
        password: record.password ? PASSWORD_MASK : '',
        fromName: record.fromName,
        fromEmail: record.fromEmail,
        replyTo: record.replyTo,
        timeout: record.timeout,
        isActive: record.isActive,
        isDefault: record.isDefault,
      },
      meta: { requestId: id, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error(`[SMTP_SETTINGS:PUT] ${id} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to save SMTP settings',
        },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }
}
