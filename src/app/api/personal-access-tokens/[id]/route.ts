// ============================================================
// GET    /api/personal-access-tokens/[id] — Get single PAT
// PATCH  /api/personal-access-tokens/[id] — Update PAT
// DELETE /api/personal-access-tokens/[id] — Delete PAT
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

function reqId() { return 'req_' + nanoid(8); }

const fullIncludes = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  _count: { select: { apiLogs: true } },
} as const;

const updateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  isActive: z.boolean().optional(),
  scopes: z.array(z.string()).min(1).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();
  try {
    const { id: tokenId } = await context.params;
    const item = await db.personalAccessToken.findUnique({ where: { id: tokenId }, include: fullIncludes });
    if (!item) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Token not found' }, meta: { requestId: id } }, { status: 404 });
    }
    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[PAT:GET] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch token' }, meta: { requestId: id } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();
  try {
    const { id: tokenId } = await context.params;
    const existing = await db.personalAccessToken.findUnique({ where: { id: tokenId } });
    if (!existing) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Token not found' }, meta: { requestId: id } }, { status: 404 });
    }
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } }, { status: 400 });
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input data' }, meta: { requestId: id } }, { status: 400 });
    }
    const d = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (d.name !== undefined) updateData.name = d.name;
    if (d.isActive !== undefined) updateData.isActive = d.isActive;
    if (d.scopes !== undefined) updateData.scopes = JSON.stringify(d.scopes);

    const item = await db.personalAccessToken.update({ where: { id: tokenId }, data: updateData, include: fullIncludes });
    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[PAT:UPDATE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update token' }, meta: { requestId: id } }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();
  try {
    const { id: tokenId } = await context.params;
    const existing = await db.personalAccessToken.findUnique({ where: { id: tokenId } });
    if (!existing) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Token not found' }, meta: { requestId: id } }, { status: 404 });
    }
    await db.personalAccessToken.delete({ where: { id: tokenId } });
    try {
      await db.auditLog.create({ data: { action: 'PAT_DELETED', resourceType: 'PERSONAL_ACCESS_TOKEN', resourceId: tokenId, details: JSON.stringify({ name: existing.name }) } });
    } catch { /* non-critical */ }
    return NextResponse.json({ data: { id: tokenId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[PAT:DELETE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete token' }, meta: { requestId: id } }, { status: 500 });
  }
}
