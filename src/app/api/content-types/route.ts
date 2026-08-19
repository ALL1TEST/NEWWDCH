// ============================================================
// GET  /api/content-types      — List content types
// POST /api/content-types      — Create content type
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhereIncludeGlobal } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  slug: z.string().min(1, 'Slug is required').max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format').trim(),
  description: z.string().max(1000).trim().optional().or(z.literal('')),
  icon: z.string().trim().optional().or(z.literal('')),
  fields: z.string().min(1, 'Fields JSON is required'),
  allowedStatuses: z.string().min(1, 'Allowed statuses JSON is required'),
});

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim().optional(),
  slug: z.string().min(1, 'Slug is required').max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format').trim().optional(),
  description: z.string().max(1000).trim().optional().or(z.literal('')),
  icon: z.string().trim().optional().or(z.literal('')),
  fields: z.string().min(1).optional(),
  allowedStatuses: z.string().min(1).optional(),
  isBuiltIn: z.boolean().optional(),
});

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
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

    const items = await db.contentType.findMany({
      where,
      include: { _count: { select: { contentItems: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: items, meta: { requestId: id } });
  } catch (error) {
    console.error(`[CONTENT_TYPES:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content types' }, meta: { requestId: id } },
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

    const item = await db.contentType.create({
      data: {
        name: d.name,
        slug: d.slug,
        siteId: request.nextUrl.searchParams.get('siteId') || undefined,
        description: d.description === '' ? null : d.description ?? null,
        icon: d.icon === '' ? null : d.icon ?? null,
        fields: d.fields,
        allowedStatuses: d.allowedStatuses,
      },
      include: { _count: { select: { contentItems: true } } },
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[CONTENT_TYPES:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create content type' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
