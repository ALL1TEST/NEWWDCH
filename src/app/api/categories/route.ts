// ============================================================
// GET  /api/categories      — List categories
// POST /api/categories      — Create a category
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

const categoryIncludes = {
  parent: { select: { id: true, name: true, slug: true } },
  children: true,
  _count: { select: { content: true, children: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .trim()
    .optional(),
  description: z.string().max(1000).optional().or(z.literal('')),
  parentId: z.string().optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'slug', 'sortOrder']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const parentId = sp.get('parentId');
    const search = sp.get('search') || '';
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'sortOrder';
    const order = sp.get('order') === 'desc' ? 'desc' : 'asc';

    const siteFilter = await getSiteWhereIncludeGlobal(request);

    // Build where clause — use AND to avoid OR-overwrite conflicts
    const conditions: Record<string, unknown>[] = [];
    if (Object.keys(siteFilter).length > 0) conditions.push(siteFilter);
    // parentId filter: empty string or missing = roots, specific value = children of that parent
    if (parentId === '') {
      conditions.push({ parentId: null });
    } else if (parentId) {
      conditions.push({ parentId });
    }
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
      db.category.findMany({
        where,
        include: categoryIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.category.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[CATEGORIES:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories' }, meta: { requestId: id } },
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
    const parentId = d.parentId === '' ? null : d.parentId ?? null;

    // Ensure slug uniqueness within the same parent scope
    const existing = await db.category.findFirst({
      where: { slug, parentId },
    });
    const finalSlug = existing ? `${slug}-${nanoid(4)}` : slug;

    const siteId = request.nextUrl.searchParams.get('siteId');

    const item = await db.category.create({
      data: {
        name: d.name,
        slug: finalSlug,
        description: d.description === '' ? null : d.description ?? null,
        parentId,
        sortOrder: d.sortOrder,
        siteId: siteId || undefined,
      },
      include: categoryIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[CATEGORIES:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create category' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
