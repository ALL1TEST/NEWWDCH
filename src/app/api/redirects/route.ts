// ============================================================
// GET  /api/redirects      — List redirects (filterable)
// POST /api/redirects      — Create a redirect
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  fromPath: z.string().min(1, 'From path is required').max(2048, 'From path must be 2048 characters or less').trim(),
  toPath: z.string().min(1, 'To path is required').max(2048, 'To path must be 2048 characters or less').trim(),
  type: z.enum(['PERMANENT_301', 'TEMPORARY_302', 'TEMPORARY_307', 'PERMANENT_308']).default('PERMANENT_301'),
  isActive: z.boolean().default(true),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'fromPath', 'type', 'hitCount']);

// ---------- loop detection helper -------------------------------------

async function wouldCreateLoop(fromPath: string, toPath: string, siteFilter: Record<string, string>): Promise<boolean> {
  // Check for direct loop: B -> A already exists when creating A -> B
  const directLoop = await db.redirect.findFirst({
    where: { ...siteFilter, fromPath: toPath, toPath: fromPath, isActive: true },
  });
  if (directLoop) return true;

  // Follow the chain: fromPath -> toPath -> check if chain leads back to fromPath
  let current = toPath;
  const visited = new Set<string>();
  visited.add(fromPath);

  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);

    const next = await db.redirect.findFirst({
      where: { ...siteFilter, fromPath: current, isActive: true },
      select: { toPath: true },
    });

    if (!next) break;
    current = next.toPath;
  }

  return false;
}

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const type = sp.get('type') || undefined;
    const isActive = sp.get('isActive');
    const search = sp.get('search') || '';

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (type) where.type = type;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { fromPath: { contains: search } },
        { toPath: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.redirect.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.redirect.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[REDIRECTS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch redirects' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create
// =====================================================================

export async function POST(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
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
          meta: { requestId: id, timestamp: new Date().toISOString() },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const siteId = request.nextUrl.searchParams.get('siteId');
    const siteFilter = await getSiteWhere(request);

    // Self-redirect check
    if (d.fromPath === d.toPath) {
      return NextResponse.json(
        { error: { code: 'SELF_REDIRECT', message: 'From path and to path cannot be the same' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    // Duplicate check: prevent same fromPath for active redirect in same site
    const existing = await db.redirect.findFirst({
      where: { ...siteFilter, fromPath: d.fromPath, isActive: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: { code: 'DUPLICATE_REDIRECT', message: 'An active redirect with this from path already exists' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 409 },
      );
    }

    // Loop detection
    const loop = await wouldCreateLoop(d.fromPath, d.toPath, siteFilter);
    if (loop) {
      return NextResponse.json(
        { error: { code: 'REDIRECT_LOOP', message: 'This redirect would create an infinite loop' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const item = await db.redirect.create({
      data: {
        siteId: siteId || undefined,
        fromPath: d.fromPath,
        toPath: d.toPath,
        type: d.type,
        isActive: d.isActive,
      },
    });

    return NextResponse.json({ data: item, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } }, { status: 201 });
  } catch (error) {
    console.error(`[REDIRECTS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create redirect' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
