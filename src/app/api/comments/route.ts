// ============================================================
// GET  /api/comments      — List comments (paginated, filterable)
// POST /api/comments      — Create a comment (with auto spam detection)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { getSettingValue } from '@/lib/settings-service';
import { checkCommentSpam } from '@/lib/akismet';

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
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const contentItemId = sp.get('contentItemId') || undefined;
    const status = sp.get('status') || undefined;

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (contentItemId) where.contentItemId = contentItemId;
    if (status) where.status = status;

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.comment.findMany({
        where,
        include: commentIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.comment.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
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
// POST — create (with auto spam detection via Akismet when configured)
// =====================================================================

export async function POST(request: NextRequest) {
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

    // ---------- Auto spam detection (Akismet) ----------
    // When the admin has configured Akismet (API key + blog URL saved in
    // settings) AND auto spam detection is enabled, we check the comment
    // against Akismet BEFORE creating the record. If Akismet says it's
    // spam, the comment is created with status=SPAM instead of PENDING
    // so it never appears on the public site without moderator approval.
    let initialStatus: 'PENDING' | 'SPAM' = 'PENDING';

    try {
      const autoSpamEnabled = await getSettingValue('comment_auto_spam_detection');
      const spamProvider = await getSettingValue('comment_spam_provider');

      if (autoSpamEnabled === 'true' && spamProvider === 'akismet') {
        // Fetch the author + content item so we can pass full context to Akismet.
        const [author, contentItem] = await Promise.all([
          db.user.findUnique({
            where: { id: d.authorId },
            select: { name: true, email: true, website: true },
          }),
          db.contentItem.findUnique({
            where: { id: d.contentItemId },
            select: { id: true, title: true, slug: true },
          }),
        ]);

        if (author && contentItem) {
          const result = await checkCommentSpam({
            commentContent: d.content,
            commentAuthor: author.name ?? 'Anonymous',
            commentAuthorEmail: author.email ?? undefined,
            commentAuthorUrl: author.website ?? undefined,
            permalink: contentItem.slug
              ? `${request.nextUrl.origin}/blog/${contentItem.slug}`
              : request.nextUrl.origin,
            userAgentIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
            userAgent: request.headers.get('user-agent') || undefined,
            referrer: request.headers.get('referer') || undefined,
          });

          if (result.isSpam) {
            initialStatus = 'SPAM';
          }
        }
      }
    } catch (spamErr) {
      // If the spam check throws, we FAIL OPEN — create the comment as
      // PENDING rather than blocking legitimate comments when the spam
      // service is temporarily unreachable.
      console.warn(`[COMMENTS:CREATE] ${id} — spam check failed, failing open:`, spamErr);
    }

    const item = await db.comment.create({
      data: {
        content: d.content,
        authorId: d.authorId,
        contentItemId: d.contentItemId,
        parentId: d.parentId === '' ? null : d.parentId ?? null,
        siteId: siteId || undefined,
        status: initialStatus,
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
