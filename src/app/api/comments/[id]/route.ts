// ============================================================
// GET    /api/comments/[id] — Get single comment
// PATCH  /api/comments/[id] — Update comment (status, content)
// DELETE /api/comments/[id] — Delete comment
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { requireFeature } from '@/lib/platform/platform-auth';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const commentIncludes = {
  author: { select: { id: true, name: true, email: true, avatar: true, website: true } },
  contentItem: { select: { id: true, title: true, slug: true } },
  parent: { select: { id: true, content: true } },
  children: true,
} as const;

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED', 'SPAM']).optional(),
  content: z.string().min(1, 'Comment content is required').trim().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  // Comments is a plan feature entitlement — gated server-side.
  const featureAuth = await requireFeature(_request, 'comments');
  if ('response' in featureAuth) return featureAuth.response;

  const id = reqId();

  try {
    const { id: commentId } = await context.params;

    const item = await db.comment.findUnique({
      where: { id: commentId },
      include: commentIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Comment not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[COMMENTS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch comment' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  // Comments is a plan feature entitlement — gated server-side.
  const featureAuth = await requireFeature(request, 'comments');
  if ('response' in featureAuth) return featureAuth.response;

  const id = reqId();

  try {
    const { id: commentId } = await context.params;

    const existing = await db.comment.findUnique({ where: { id: commentId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Comment not found' }, meta: { requestId: id } },
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
    if (d.status !== undefined) updateData.status = d.status;
    if (d.content !== undefined) updateData.content = d.content;

    const item = await db.comment.update({
      where: { id: commentId },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true } },
        contentItem: { select: { id: true, title: true, slug: true } },
      },
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[COMMENTS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update comment' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — hard delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  // Comments is a plan feature entitlement — gated server-side.
  const featureAuth = await requireFeature(_request, 'comments');
  if ('response' in featureAuth) return featureAuth.response;

  const id = reqId();

  try {
    const { id: commentId } = await context.params;

    const existing = await db.comment.findUnique({ where: { id: commentId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Comment not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.comment.delete({ where: { id: commentId } });

    return NextResponse.json({ data: { id: commentId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[COMMENTS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete comment' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
