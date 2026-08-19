// ============================================================
// GET  /api/email-templates/[id]/versions      — List template versions
// POST /api/email-templates/[id]/versions      — Create a version snapshot
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- validation ------------------------------------------------

const createVersionSchema = z.object({
  changeNote: z.string().max(500).trim().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — list versions
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
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

    const versions = await db.emailTemplateVersion.findMany({
      where: { templateId },
      orderBy: { version: 'desc' },
    });

    return NextResponse.json({ data: versions, meta: { requestId: id } });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:VERSIONS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch template versions' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create version snapshot
// =====================================================================

export async function POST(request: NextRequest, context: RouteContext) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = createVersionSchema.safeParse(body);
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

    const maxVersion = await db.emailTemplateVersion.aggregate({
      where: { templateId },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    const version = await db.emailTemplateVersion.create({
      data: {
        templateId,
        version: nextVersion,
        subject: template.subject,
        previewText: template.previewText,
        htmlBody: template.htmlBody,
        fromName: template.fromName,
        fromEmail: template.fromEmail,
        replyTo: template.replyTo,
        changeNote: parsed.data.changeNote,
      },
    });

    return NextResponse.json({ data: version, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:VERSIONS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create template version' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
