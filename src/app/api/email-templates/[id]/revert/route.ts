// ============================================================
// POST /api/email-templates/[id]/revert — Revert template to default
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// POST — revert
// =====================================================================

export async function POST(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: templateId } = await context.params;

    const template = await db.emailTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Email template not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    if (!template.defaultBody) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'This template has no default body to revert to' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Create a version snapshot before reverting
    const maxVersion = await db.emailTemplateVersion.aggregate({
      where: { templateId },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    await db.emailTemplateVersion.create({
      data: {
        templateId,
        version: nextVersion,
        subject: template.subject,
        previewText: template.previewText,
        htmlBody: template.htmlBody,
        fromName: template.fromName,
        fromEmail: template.fromEmail,
        replyTo: template.replyTo,
        changeNote: 'Snapshot before revert to default',
      },
    });

    // Revert to default
    const updated = await db.emailTemplate.update({
      where: { id: templateId },
      data: {
        htmlBody: template.defaultBody,
      },
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:REVERT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to revert email template' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
