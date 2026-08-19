// ============================================================
// GET  /api/tags      — List tags (paginated, filterable)
// POST /api/tags      — Create a tag
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { slugify } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhereIncludeGlobal } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const tagIncludes = {
  _count: { select: { content: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').trim(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .trim()
    .optional(),
  color: z.string().trim().optional().or(z.literal('')),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'slug']);

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
    const search = sp.get('search') || '';

    const siteFilter = await getSiteWhereIncludeGlobal(request);

    // Build where clause — use AND to avoid OR-overwrite conflicts
    const conditions: Record<string, unknown>[] = [];
    if (Object.keys(siteFilter).length > 0) conditions.push(siteFilter);
    if (search) {
      conditions.push({
        OR: [
          { name: { contains: search } },
          { slug: { contains: search } },
        ],
      });
    }
    const where = conditions.length > 1 ? { AND: conditions } : conditions[0] || {};

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.tag.findMany({
        where,
        include: tagIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.tag.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[TAGS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tags' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create
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
    const slug = d.slug || slugify(d.name);

    // Ensure slug uniqueness
    const existing = await db.tag.findFirst({ where: { slug } });
    const finalSlug = existing ? `${slug}-${nanoid(4)}` : slug;

    const siteId = request.nextUrl.searchParams.get('siteId');

    const item = await db.tag.create({
      data: {
        name: d.name,
        slug: finalSlug,
        color: d.color === '' ? null : d.color ?? null,
        siteId: siteId || undefined,
      },
      include: tagIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[TAGS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create tag' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
