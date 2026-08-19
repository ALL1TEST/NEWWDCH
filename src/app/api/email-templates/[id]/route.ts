// ============================================================
// GET    /api/email-templates/[id] — Get single email template
// PATCH  /api/email-templates/[id] — Update email template
// DELETE /api/email-templates/[id] — Delete email template
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
  _count: { select: { versions: true } },
} as const;

// ---------- validation ------------------------------------------------

const CATEGORIES = ['CUSTOMER_EMAILS', 'AUTHENTICATION', 'NEWSLETTER', 'MARKETING', 'TRANSACTIONAL', 'NOTIFICATIONS', 'BILLING', 'SYSTEM'] as const;
const STATUSES = ['ENABLED', 'DISABLED', 'DRAFT'] as const;
const PROVIDERS = ['SMTP', 'SES', 'RESEND', 'MAILGUN', 'SENDGRID', 'POSTMARK', 'BREVO', 'ELASTIC_EMAIL'] as const;

const updateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  subject: z.string().max(500).trim().optional(),
  previewText: z.string().max(500).trim().optional(),
  htmlBody: z.string().optional(),
  fromName: z.string().max(200).trim().optional(),
  fromEmail: z.string().email().max(200).trim().optional().or(z.literal('')),
  replyTo: z.string().email().max(200).trim().optional().or(z.literal('')),
  language: z.string().max(10).optional(),
  category: z.enum(CATEGORIES).optional(),
  status: z.enum(STATUSES).optional(),
  provider: z.enum(PROVIDERS).optional(),
  trackOpens: z.boolean().optional(),
  trackClicks: z.boolean().optional(),
  enableAttachments: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: templateId } = await context.params;

    const item = await db.emailTemplate.findUnique({
      where: { id: templateId },
      include: fullIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Email template not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch email template' }, meta: { requestId: id } },
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
    const { id: templateId } = await context.params;

    const existing = await db.emailTemplate.findUnique({ where: { id: templateId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Email template not found' }, meta: { requestId: id } },
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
    if (d.previewText !== undefined) updateData.previewText = d.previewText;
    if (d.htmlBody !== undefined) updateData.htmlBody = d.htmlBody;
    if (d.fromName !== undefined) updateData.fromName = d.fromName;
    if (d.fromEmail !== undefined) updateData.fromEmail = d.fromEmail;
    if (d.replyTo !== undefined) updateData.replyTo = d.replyTo;
    if (d.language !== undefined) updateData.language = d.language;
    if (d.category !== undefined) updateData.category = d.category;
    if (d.status !== undefined) updateData.status = d.status;
    if (d.provider !== undefined) updateData.provider = d.provider;
    if (d.trackOpens !== undefined) updateData.trackOpens = d.trackOpens;
    if (d.trackClicks !== undefined) updateData.trackClicks = d.trackClicks;
    if (d.enableAttachments !== undefined) updateData.enableAttachments = d.enableAttachments;

    // Auto-create version snapshot when htmlBody or subject changes
    const bodyChanged = d.htmlBody !== undefined && d.htmlBody !== existing.htmlBody;
    const subjectChanged = d.subject !== undefined && d.subject !== existing.subject;

    if (bodyChanged || subjectChanged) {
      const maxVersion = await db.emailTemplateVersion.aggregate({
        where: { templateId },
        _max: { version: true },
      });
      const nextVersion = (maxVersion._max.version ?? 0) + 1;

      await db.emailTemplateVersion.create({
        data: {
          templateId,
          version: nextVersion,
          subject: existing.subject,
          previewText: existing.previewText,
          htmlBody: existing.htmlBody,
          fromName: existing.fromName,
          fromEmail: existing.fromEmail,
          replyTo: existing.replyTo,
          changeNote: 'Auto-snapshot before update',
        },
      });
    }

    const item = await db.emailTemplate.update({
      where: { id: templateId },
      data: updateData,
      include: fullIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update email template' }, meta: { requestId: id } },
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
    const { id: templateId } = await context.params;

    const existing = await db.emailTemplate.findUnique({ where: { id: templateId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Email template not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Cannot delete system templates' }, meta: { requestId: id } },
        { status: 403 },
      );
    }

    await db.emailTemplate.delete({ where: { id: templateId } });

    return NextResponse.json({ data: { id: templateId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete email template' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
