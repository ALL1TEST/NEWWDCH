// ============================================================
// GET  /api/email-templates/[id]/versions/[versionId] — Get a version
// POST /api/email-templates/[id]/versions/[versionId] — Restore a version
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string; versionId: string }> };

// =====================================================================
// GET — single version
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: templateId, versionId } = await context.params;

    const version = await db.emailTemplateVersion.findFirst({
      where: { id: versionId, templateId },
    });

    if (!version) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Template version not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: version, meta: { requestId: id } });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:VERSION:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch template version' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — restore version
// =====================================================================

export async function POST(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: templateId, versionId } = await context.params;

    const template = await db.emailTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Email template not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    const version = await db.emailTemplateVersion.findFirst({
      where: { id: versionId, templateId },
    });

    if (!version) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Template version not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Create a snapshot of current state before restoring
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
        changeNote: `Snapshot before restoring to version ${version.version}`,
      },
    });

    // Restore the version data to the template
    const updated = await db.emailTemplate.update({
      where: { id: templateId },
      data: {
        subject: version.subject,
        previewText: version.previewText,
        htmlBody: version.htmlBody,
        fromName: version.fromName,
        fromEmail: version.fromEmail,
        replyTo: version.replyTo,
      },
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:VERSION:RESTORE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to restore template version' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
