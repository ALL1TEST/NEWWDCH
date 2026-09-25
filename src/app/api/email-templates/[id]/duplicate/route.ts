// ============================================================
// POST /api/email-templates/[id]/duplicate — Duplicate an email template
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteFromRequest } from '@/lib/site-context';
import { getAuthUser } from '@/lib/platform/platform-auth';

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

type RouteContext = { params: Promise<{ id: string }> };

// ---------- validation ------------------------------------------------

const duplicateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  createdById: z.string().optional(),
});

// =====================================================================
// POST — duplicate
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

    let body: Record<string, unknown> = {};
    try {
      const parsedBody = await request.json();
      if (typeof parsedBody === 'object' && parsedBody !== null) {
        body = parsedBody as Record<string, unknown>;
      }
    } catch {
      // Empty or non-JSON body is valid
      body = {};
    }

    const parsed = duplicateSchema.safeParse(body);
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
    const name = d.name || `${template.name} (Copy)`;
    const slug = kebabCase(name);

    // Ensure unique slug
    let finalSlug = slug;
    let counter = 1;
    while (await db.emailTemplate.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter++}`;
    }

    const requestSiteId = await getSiteFromRequest(request);
    const targetSiteId = template.siteId ?? requestSiteId ?? null;

    const authUser = await getAuthUser(request);
    let createdById = d.createdById || authUser?.id || template.createdById;
    if (!createdById) {
      const firstUser = await db.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
      createdById = firstUser?.id;
    }
    if (!createdById) {
      return NextResponse.json(
        { error: { code: 'NO_USER', message: 'No user found to assign as creator' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const duplicate = await db.emailTemplate.create({
      data: {
        siteId: targetSiteId,
        name,
        slug: finalSlug,
        subject: template.subject,
        previewText: template.previewText,
        htmlBody: template.htmlBody,
        fromName: template.fromName,
        fromEmail: template.fromEmail,
        replyTo: template.replyTo,
        language: template.language,
        category: template.category,
        status: 'DRAFT',
        provider: template.provider,
        trackOpens: template.trackOpens,
        trackClicks: template.trackClicks,
        enableAttachments: template.enableAttachments,
        isSystem: false,
        defaultBody: template.defaultBody,
        createdById,
      },
    });

    return NextResponse.json({ data: duplicate, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[EMAIL_TEMPLATES:DUPLICATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to duplicate email template' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
