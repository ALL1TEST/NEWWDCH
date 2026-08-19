// ============================================================
// GET  /api/navigation      — List navigation menus
// POST /api/navigation      — Create a navigation menu
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .trim(),
  description: z.string().max(500).optional().or(z.literal('')),
  items: z.string().optional().or(z.literal('')),
  location: z.enum(['HEADER', 'SECONDARY', 'FOOTER', 'MOBILE']).optional().nullable(),
  status: z.enum(['ACTIVE', 'DRAFT', 'DISABLED']).default('DRAFT'),
  isActive: z.boolean().default(true),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'slug', 'status', 'location']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(sp.get('pageSize')) || 100));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const search = sp.get('search')?.trim() || '';
    const status = sp.get('status')?.trim() || '';
    const location = sp.get('location')?.trim() || '';
    const allSites = sp.get('allSites') === 'true';

    const siteFilter = await getSiteWhere(request);

    // Build where clause
    const where: Record<string, unknown> = { ...siteFilter };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (location) {
      where.location = location;
    }

    const orderBy: Record<string, string> = { [sort]: order };

    // For All Sites view, include site info
    const include = allSites ? { site: { select: { id: true, name: true, slug: true } } } : undefined;

    const [items, total] = await Promise.all([
      db.navigation.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        ...(include ? { include } : {}),
      }),
      db.navigation.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[NAVIGATION:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch navigation menus' }, meta: { requestId: id } },
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

    // Validate that items is valid JSON if provided
    let itemsJson = '[]';
    if (d.items && d.items !== '') {
      try {
        const parsed = JSON.parse(d.items);
        if (!Array.isArray(parsed)) throw new Error();
        itemsJson = d.items;
      } catch {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Items must be a valid JSON array' }, meta: { requestId: id } },
          { status: 400 },
        );
      }
    }

    // Ensure slug uniqueness per site
    const siteId = request.nextUrl.searchParams.get('siteId');
    const siteFilter = await getSiteWhere(request);
    const existing = await db.navigation.findFirst({ where: { ...siteFilter, slug: d.slug } });
    if (existing) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'A navigation menu with this slug already exists' }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    // Location uniqueness is enforced on update, not create

    const item = await db.navigation.create({
      data: {
        siteId: siteId || undefined,
        name: d.name,
        slug: d.slug,
        description: d.description === '' ? null : d.description ?? null,
        items: itemsJson,
        location: d.location ?? null,
        status: d.status,
        isActive: d.isActive,
      },
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[NAVIGATION:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create navigation menu' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
