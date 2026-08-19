// ============================================================
// GET    /api/subscribers/[id] — Get single subscriber
// PATCH  /api/subscribers/[id] — Update subscriber (status, name)
// DELETE /api/subscribers/[id] — Delete subscriber
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

const updateSchema = z.object({
  name: z.string().max(200).trim().optional().or(z.literal('')),
  status: z.enum(['SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED']).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: subscriberId } = await context.params;

    const item = await db.newsletterSubscriber.findUnique({ where: { id: subscriberId } });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Subscriber not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SUBSCRIBERS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch subscriber' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update (status, name)
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: subscriberId } = await context.params;

    const existing = await db.newsletterSubscriber.findUnique({ where: { id: subscriberId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Subscriber not found' }, meta: { requestId: id } },
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
    if (d.name !== undefined) updateData.name = d.name === '' ? null : d.name;
    if (d.status !== undefined) {
      updateData.status = d.status;
      if (d.status === 'UNSUBSCRIBED') {
        updateData.unsubscribedAt = new Date();
      }
    }

    const item = await db.newsletterSubscriber.update({
      where: { id: subscriberId },
      data: updateData,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SUBSCRIBERS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update subscriber' }, meta: { requestId: id } },
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
    const { id: subscriberId } = await context.params;

    const existing = await db.newsletterSubscriber.findUnique({ where: { id: subscriberId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Subscriber not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.newsletterSubscriber.delete({ where: { id: subscriberId } });

    return NextResponse.json({ data: { id: subscriberId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SUBSCRIBERS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete subscriber' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
