// ============================================================
// GET    /api/redirects/[id] — Get single redirect
// PATCH  /api/redirects/[id] — Update redirect
// DELETE /api/redirects/[id] — Delete redirect
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  fromPath: z.string().min(1).max(2048).trim().optional(),
  toPath: z.string().min(1).max(2048).trim().optional(),
  type: z.enum(['PERMANENT_301', 'TEMPORARY_302', 'TEMPORARY_307', 'PERMANENT_308']).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// ---------- loop detection helper -------------------------------------

async function wouldCreateLoop(fromPath: string, toPath: string, siteFilter: Record<string, string>, excludeId?: string): Promise<boolean> {
  // Check for direct loop: B -> A already exists (excluding current redirect)
  const directLoop = await db.redirect.findFirst({
    where: { ...siteFilter, fromPath: toPath, toPath: fromPath, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (directLoop) return true;

  // Follow the chain
  let current = toPath;
  const visited = new Set<string>();
  visited.add(fromPath);

  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);

    const next = await db.redirect.findFirst({
      where: { ...siteFilter, fromPath: current, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { toPath: true },
    });

    if (!next) break;
    current = next.toPath;
  }

  return false;
}

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: redirectId } = await context.params;

    const item = await db.redirect.findUnique({ where: { id: redirectId } });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Redirect not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[REDIRECTS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch redirect' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: redirectId } = await context.params;

    const existing = await db.redirect.findUnique({ where: { id: redirectId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Redirect not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
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
          meta: { requestId: id, timestamp: new Date().toISOString() },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const effectiveFromPath = d.fromPath ?? existing.fromPath;
    const effectiveToPath = d.toPath ?? existing.toPath;
    const siteFilter: Record<string, string> = existing.siteId ? { siteId: existing.siteId } : {};

    // Self-redirect check
    if (effectiveFromPath === effectiveToPath) {
      return NextResponse.json(
        { error: { code: 'SELF_REDIRECT', message: 'From path and to path cannot be the same' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    // Duplicate check: if fromPath changed, check for duplicates
    if (d.fromPath && d.fromPath !== existing.fromPath) {
      const dup = await db.redirect.findFirst({
        where: { ...siteFilter, fromPath: d.fromPath, isActive: true, id: { not: redirectId } },
      });
      if (dup) {
        return NextResponse.json(
          { error: { code: 'DUPLICATE_REDIRECT', message: 'An active redirect with this from path already exists' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
          { status: 409 },
        );
      }
    }

    // Loop detection (when fromPath or toPath changed)
    if (d.fromPath || d.toPath) {
      const loop = await wouldCreateLoop(effectiveFromPath, effectiveToPath, siteFilter, redirectId);
      if (loop) {
        return NextResponse.json(
          { error: { code: 'REDIRECT_LOOP', message: 'This redirect would create an infinite loop' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
          { status: 400 },
        );
      }
    }

    // Reactivation loop check: turning an inactive redirect back on must not create a loop.
    // Uses the existing (stored) paths — path changes are handled by the block above.
    if (d.isActive === true && existing.isActive === false) {
      const loop = await wouldCreateLoop(existing.fromPath, existing.toPath, siteFilter, redirectId);
      if (loop) {
        return NextResponse.json(
          { error: { code: 'REDIRECT_LOOP', message: 'Reactivating this redirect would create a redirect loop' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
          { status: 400 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (d.fromPath !== undefined) updateData.fromPath = d.fromPath;
    if (d.toPath !== undefined) updateData.toPath = d.toPath;
    if (d.type !== undefined) updateData.type = d.type;
    if (d.isActive !== undefined) updateData.isActive = d.isActive;

    const item = await db.redirect.update({
      where: { id: redirectId },
      data: updateData,
    });

    return NextResponse.json({ data: item, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[REDIRECTS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update redirect' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — hard delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: redirectId } = await context.params;

    const existing = await db.redirect.findUnique({ where: { id: redirectId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Redirect not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    await db.redirect.delete({ where: { id: redirectId } });

    return NextResponse.json({ data: { id: redirectId, deleted: true }, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[REDIRECTS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete redirect' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
