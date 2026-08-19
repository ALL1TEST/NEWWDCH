// ============================================================
// PATCH  /api/seo/issues/[id] — Update issue (resolve/unresolve)
// DELETE /api/seo/issues/[id] — Remove issue
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  severity: z.enum(['CRITICAL', 'WARNING', 'INFO']).optional(),
  resourceType: z.string().min(1).optional(),
  resourceId: z.string().optional(),
  pageUrl: z.string().min(1).max(2048).optional(),
  problem: z.string().min(1).optional(),
  recommendation: z.string().min(1).optional(),
  isResolved: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// PATCH — update (resolve/unresolve)
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: issueId } = await context.params;

    const existing = await db.seoIssue.findUnique({ where: { id: issueId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'SEO issue not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
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
    const updateData: Record<string, unknown> = {};
    if (d.severity !== undefined) updateData.severity = d.severity;
    if (d.resourceType !== undefined) updateData.resourceType = d.resourceType;
    if (d.resourceId !== undefined) updateData.resourceId = d.resourceId;
    if (d.pageUrl !== undefined) updateData.pageUrl = d.pageUrl;
    if (d.problem !== undefined) updateData.problem = d.problem;
    if (d.recommendation !== undefined) updateData.recommendation = d.recommendation;
    if (d.isResolved !== undefined) updateData.isResolved = d.isResolved;

    const item = await db.seoIssue.update({
      where: { id: issueId },
      data: updateData,
    });

    return NextResponse.json({ data: item, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[SEO:ISSUES:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update SEO issue' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — remove
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: issueId } = await context.params;

    const existing = await db.seoIssue.findUnique({ where: { id: issueId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'SEO issue not found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    await db.seoIssue.delete({ where: { id: issueId } });

    return NextResponse.json({ data: { id: issueId, deleted: true }, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[SEO:ISSUES:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete SEO issue' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
