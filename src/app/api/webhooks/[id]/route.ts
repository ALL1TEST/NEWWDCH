// ============================================================
// GET    /api/webhooks/[id] — Get single webhook
// PATCH  /api/webhooks/[id] — Update webhook
// DELETE /api/webhooks/[id] — Delete webhook
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

const fullIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  _count: { select: { deliveries: true } },
} as const;

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  url: z
    .string()
    .min(1)
    .max(2048)
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
    )
    .optional(),
  secret: z.string().max(500).optional().or(z.literal('')),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// ---------- transform helpers ----------------------------------------

function maskWebhook(item: Record<string, unknown>) {
  const result = { ...item };
  delete (result as Record<string, unknown>).secret;
  (result as Record<string, unknown>).hasSecret = !!(item as Record<string, unknown>).secret;
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
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: webhookId } = await context.params;

    const item = await db.webhook.findUnique({
      where: { id: webhookId },
      include: fullIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Webhook not found' }, meta: { requestId: '' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: maskWebhook(item as unknown as Record<string, unknown>), meta: { requestId: '' } });
  } catch (error) {
    console.error('[WEBHOOKS:GET] —', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhook' }, meta: { requestId: '' } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: webhookId } = await context.params;

    const existing = await db.webhook.findUnique({ where: { id: webhookId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Webhook not found' }, meta: { requestId: '' } },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: '' } },
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
          meta: { requestId: '' },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (d.name !== undefined) updateData.name = d.name;
    if (d.url !== undefined) updateData.url = d.url;
    if (d.secret !== undefined) updateData.secret = d.secret === '' ? null : d.secret;
    if (d.events !== undefined) updateData.events = JSON.stringify(d.events);
    if (d.isActive !== undefined) updateData.isActive = d.isActive;

    const item = await db.webhook.update({
      where: { id: webhookId },
      data: updateData,
      include: fullIncludes,
    });

    return NextResponse.json({ data: maskWebhook(item as unknown as Record<string, unknown>), meta: { requestId: '' } });
  } catch (error) {
    console.error('[WEBHOOKS:UPDATE] —', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update webhook' }, meta: { requestId: '' } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — hard delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id: webhookId } = await context.params;

    const existing = await db.webhook.findUnique({ where: { id: webhookId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Webhook not found' }, meta: { requestId: '' } },
        { status: 404 },
      );
    }

    await db.webhook.delete({ where: { id: webhookId } });

    return NextResponse.json({ data: { id: webhookId, deleted: true }, meta: { requestId: '' } });
  } catch (error) {
    console.error('[WEBHOOKS:DELETE] —', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete webhook' }, meta: { requestId: '' } },
      { status: 500 },
    );
  }
}
