// ============================================================
// GET  /api/comments      — List comments (paginated, filterable)
// POST /api/comments      — Create a comment
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { getSettingValue } from '@/lib/settings-service';
import { requireFeature } from '@/lib/platform/platform-auth';
import { syncVerdantComments } from '@/lib/services/production-comment-service';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const commentIncludes = {
  author: { select: { id: true, name: true, email: true, avatar: true, website: true } },
  contentItem: { select: { id: true, title: true, slug: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
  authorId: z.string().min(1, 'Author ID is required'),
  contentItemId: z.string().min(1, 'Content item ID is required'),
  parentId: z.string().optional().or(z.literal('')),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  // Comments is a plan feature entitlement — gated server-side
  // (403 FEATURE_NOT_AVAILABLE when the plan does not include it;
  // owner bypass passes).
  const featureAuth = await requireFeature(request, 'comments');
  if ('response' in featureAuth) return featureAuth.response;

  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const contentItemId = sp.get('contentItemId') || undefined;
    const status = sp.get('status') || undefined;

    const siteParam = request.nextUrl.searchParams.get('siteId');
    await syncVerdantComments(siteParam ?? undefined).catch((err) => {
      console.warn('[COMMENTS:GET] Production sync warning:', err);
    });

    const siteFilter = await getSiteWhere(request);
    const baseWhere: Record<string, unknown> = { ...siteFilter };
    if (contentItemId) baseWhere.contentItemId = contentItemId;

    let items: any[] = [];
    let total = 0;

    let filterClause = '';
    const filterParams: any[] = [];

    if (typeof siteFilter.siteId === 'string') {
      filterClause += ' AND c.siteId = ?';
      filterParams.push(siteFilter.siteId);
    } else if (siteFilter.siteId && typeof siteFilter.siteId === 'object' && Array.isArray((siteFilter.siteId as any).in)) {
      const inIds = (siteFilter.siteId as any).in;
      if (inIds.length === 0) {
        filterClause += ' AND 1 = 0';
      } else {
        filterClause += ` AND c.siteId IN (${inIds.map(() => '?').join(', ')})`;
        filterParams.push(...inIds);
      }
    } else if (siteFilter.siteId === null) {
      filterClause += ' AND c.siteId IS NULL';
    }

    if (contentItemId) {
      filterClause += ' AND c.contentItemId = ?';
      filterParams.push(contentItemId);
    }

    const safeSort = sort === 'content' ? 'content' : sort === 'updatedAt' ? 'updatedAt' : 'createdAt';
    const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

    if (status === 'TRASH') {
      const countSql = `SELECT COUNT(*) as count FROM Comment c WHERE c.status = 'TRASH'${filterClause}`;
      const countRes: Array<{ count: number | bigint }> = await (db as any).$queryRawUnsafe(
        countSql,
        ...filterParams,
      ).catch(() => [{ count: 0 }]);
      total = Number(countRes[0]?.count ?? 0);

      const itemsSql = `
        SELECT 
          c.id, c.content, c.status, c.createdAt, c.updatedAt, c.parentId,
          u.id as author_id, u.name as author_name, u.email as author_email, u.avatar as author_avatar, u.website as author_website,
          ci.id as contentItem_id, ci.title as contentItem_title, ci.slug as contentItem_slug
        FROM Comment c
        LEFT JOIN User u ON c.authorId = u.id
        LEFT JOIN ContentItem ci ON c.contentItemId = ci.id
        WHERE c.status = 'TRASH'${filterClause}
        ORDER BY c.${safeSort} ${safeOrder}
        LIMIT ? OFFSET ?
      `;
      const rows: any[] = await (db as any).$queryRawUnsafe(
        itemsSql,
        ...filterParams,
        pageSize,
        (page - 1) * pageSize,
      ).catch(() => []);

      items = rows.map((r) => ({
        id: r.id,
        content: r.content,
        status: 'TRASH',
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
      }));
    } else {
      const where: Record<string, unknown> = { ...baseWhere };
      if (status && status !== 'all') {
        where.status = status;
      } else {
        where.status = { in: ['APPROVED', 'REJECTED', 'FLAGGED', 'SPAM'] };
      }

      const orderBy: Record<string, string> = { [sort]: order };
      const [fetchedItems, count] = await Promise.all([
        db.comment.findMany({
          where,
          include: commentIncludes,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.comment.count({ where }),
      ]);
      items = fetchedItems;
      total = count;
    }

    const [approvedCount, rejectedCount, spamCount, trashCountRes] = await Promise.all([
      db.comment.count({ where: { ...baseWhere, status: 'APPROVED' } }).catch(() => 0),
      db.comment.count({ where: { ...baseWhere, status: 'REJECTED' } }).catch(() => 0),
      db.comment.count({ where: { ...baseWhere, status: 'SPAM' } }).catch(() => 0),
      (db as any).$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM Comment c WHERE c.status = 'TRASH'${filterClause}`,
        ...filterParams,
      ).catch(() => [{ count: 0 }]),
    ]);

    const trashCount = Number((trashCountRes as Array<{ count: number | bigint }>)[0]?.count ?? 0);

    const statusCounts = {
      all: approvedCount + rejectedCount + spamCount,
      APPROVED: approvedCount,
      REJECTED: rejectedCount,
      SPAM: spamCount,
      TRASH: trashCount,
    };

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        statusCounts,
      },
    });
  } catch (error) {
    console.error(`[COMMENTS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch comments' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create a new comment
// =====================================================================

export async function POST(request: NextRequest) {
  // Comments is a plan feature entitlement — gated server-side.
  const featureAuth = await requireFeature(request, 'comments');
  if ('response' in featureAuth) return featureAuth.response;

  const id = reqId();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = createSchema.safeParse(body);
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
    const siteId = request.nextUrl.searchParams.get('siteId');

    // 1. Allow Comments setting
    // When enable_comments === 'false', new comment submissions are rejected.
    const enableComments = await getSettingValue('enable_comments');
    if (enableComments === 'false') {
      return NextResponse.json(
        {
          error: {
            code: 'COMMENTS_DISABLED',
            message: 'Comments are currently closed on this site.',
          },
          meta: { requestId: id },
        },
        { status: 403 },
      );
    }

    const item = await db.comment.create({
      data: {
        content: d.content,
        authorId: d.authorId,
        contentItemId: d.contentItemId,
        parentId: d.parentId === '' ? null : d.parentId ?? null,
        siteId: siteId || undefined,
        status: 'APPROVED',
      },
      include: commentIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[COMMENTS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create comment' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
