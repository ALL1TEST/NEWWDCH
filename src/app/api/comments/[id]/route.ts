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
import { deleteVerdantComment, updateVerdantCommentStatus } from '@/lib/services/production-comment-service';

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
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED', 'SPAM', 'TRASH']).optional(),
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

    const rows: any[] = await (db as any).$queryRawUnsafe(`
      SELECT 
        c.id, c.content, c.status, c.createdAt, c.updatedAt, c.parentId,
        u.id as author_id, u.name as author_name, u.email as author_email, u.avatar as author_avatar, u.website as author_website,
        ci.id as contentItem_id, ci.title as contentItem_title, ci.slug as contentItem_slug
      FROM Comment c
      LEFT JOIN User u ON c.authorId = u.id
      LEFT JOIN ContentItem ci ON c.contentItemId = ci.id
      WHERE c.id = ?
    `, commentId);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Comment not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    const r = rows[0];
    const item = {
      id: r.id,
      content: r.content,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      parentId: r.parentId,
      author: {
        id: r.author_id,
        name: r.author_name,
        email: r.author_email,
        avatar: r.author_avatar,
        website: r.author_website,
      },
      contentItem: {
        id: r.contentItem_id,
        title: r.contentItem_title,
        slug: r.contentItem_slug,
      },
    };

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

    const existingRows: any[] = await (db as any).$queryRawUnsafe(
      'SELECT id, status, content FROM Comment WHERE id = ?',
      commentId,
    );
    if (!existingRows || existingRows.length === 0) {
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

    if (d.status !== undefined) {
      await (db as any).$executeRawUnsafe(
        'UPDATE Comment SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        d.status,
        commentId,
      );
    }

    if (d.content !== undefined) {
      await (db as any).$executeRawUnsafe(
        'UPDATE Comment SET content = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        d.content,
        commentId,
      );
    }

    if (d.status !== undefined) {
      await updateVerdantCommentStatus(commentId, d.status).catch((err) => {
        console.warn(`[COMMENTS:UPDATE] ${id} — production Postgres status sync warning:`, err);
      });
    }

    // Fetch the updated item
    const rows: any[] = await (db as any).$queryRawUnsafe(`
      SELECT 
        c.id, c.content, c.status, c.createdAt, c.updatedAt, c.parentId,
        u.id as author_id, u.name as author_name, u.email as author_email, u.avatar as author_avatar, u.website as author_website,
        ci.id as contentItem_id, ci.title as contentItem_title, ci.slug as contentItem_slug
      FROM Comment c
      LEFT JOIN User u ON c.authorId = u.id
      LEFT JOIN ContentItem ci ON c.contentItemId = ci.id
      WHERE c.id = ?
    `, commentId);

    const r = rows[0];
    const item = {
      id: r.id,
      content: r.content,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      parentId: r.parentId,
      author: {
        id: r.author_id,
        name: r.author_name,
        email: r.author_email,
        avatar: r.author_avatar,
        website: r.author_website,
      },
      contentItem: {
        id: r.contentItem_id,
        title: r.contentItem_title,
        slug: r.contentItem_slug,
      },
    };

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

    const existingRows: any[] = await (db as any).$queryRawUnsafe(
      'SELECT id FROM Comment WHERE id = ?',
      commentId,
    );
    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Comment not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await (db as any).$executeRawUnsafe('DELETE FROM Comment WHERE id = ?', commentId);
    await deleteVerdantComment(commentId).catch((err) => {
      console.warn('[COMMENTS:DELETE] Production delete warning:', err);
    });

    return NextResponse.json({ data: { id: commentId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[COMMENTS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete comment' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
