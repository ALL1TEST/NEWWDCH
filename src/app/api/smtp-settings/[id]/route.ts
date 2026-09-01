// ============================================================
// GET    /api/smtp-settings/[id] — Get single SMTP setting
// PATCH  /api/smtp-settings/[id] — Update SMTP setting
// DELETE /api/smtp-settings/[id] — Delete SMTP setting
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

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- validation ------------------------------------------------

const PROVIDERS = ['SMTP', 'SES', 'RESEND', 'MAILGUN', 'SENDGRID', 'POSTMARK', 'BREVO', 'ELASTIC_EMAIL'] as const;

const updateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  provider: z.enum(PROVIDERS).optional(),
  host: z.string().max(300).trim().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().max(200).trim().optional(),
  password: z.string().max(500).optional(),
  fromName: z.string().max(200).trim().optional(),
  fromEmail: z.string().email().max(200).trim().optional().or(z.literal('')),
  replyTo: z.string().email().max(200).trim().optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  const id = reqId();

  // SMTP Settings derived-entitlement gate (Email Templates OR Newsletter).
  const featureAuth = await requireAnyFeatureAllowStaff(request, [...SMTP_DEPENDENT_FEATURES]);
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const { id: settingId } = await context.params;

    const item = await db.smtpSetting.findUnique({
      where: { id: settingId },
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'SMTP setting not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SMTP_SETTINGS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SMTP setting' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();

  // SMTP Settings derived-entitlement gate (Email Templates OR Newsletter).
  const featureAuth = await requireAnyFeatureAllowStaff(request, [...SMTP_DEPENDENT_FEATURES]);
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const { id: settingId } = await context.params;

    const existing = await db.smtpSetting.findUnique({ where: { id: settingId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'SMTP setting not found' }, meta: { requestId: id } },
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
    if (d.provider !== undefined) updateData.provider = d.provider;
    if (d.host !== undefined) updateData.host = d.host;
    if (d.port !== undefined) updateData.port = d.port;
    if (d.username !== undefined) updateData.username = d.username;
    if (d.password !== undefined) updateData.password = d.password;
    if (d.fromName !== undefined) updateData.fromName = d.fromName;
    if (d.fromEmail !== undefined) updateData.fromEmail = d.fromEmail;
    if (d.replyTo !== undefined) updateData.replyTo = d.replyTo;
    if (d.isDefault !== undefined) updateData.isDefault = d.isDefault;
    if (d.isActive !== undefined) updateData.isActive = d.isActive;

    const item = await db.smtpSetting.update({
      where: { id: settingId },
      data: updateData,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SMTP_SETTINGS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update SMTP setting' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — hard delete
// =====================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  const id = reqId();

  // SMTP Settings derived-entitlement gate (Email Templates OR Newsletter).
  const featureAuth = await requireAnyFeatureAllowStaff(request, [...SMTP_DEPENDENT_FEATURES]);
  if ('response' in featureAuth) return featureAuth.response;

  try {
    const { id: settingId } = await context.params;

    const existing = await db.smtpSetting.findUnique({ where: { id: settingId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'SMTP setting not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.smtpSetting.delete({ where: { id: settingId } });

    return NextResponse.json({ data: { id: settingId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SMTP_SETTINGS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete SMTP setting' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
