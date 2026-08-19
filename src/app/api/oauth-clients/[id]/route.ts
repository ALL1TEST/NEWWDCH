// ============================================================
// GET    /api/oauth-clients/[id] — Get single OAuth client
// PATCH  /api/oauth-clients/[id] — Update OAuth client
// DELETE /api/oauth-clients/[id] — Delete OAuth client
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

function reqId() { return 'req_' + nanoid(8); }

const fullIncludes = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
} as const;

const updateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'REVOKED']).optional(),
  grantTypes: z.array(z.enum(['AUTHORIZATION_CODE', 'CLIENT_CREDENTIALS', 'PKCE'])).min(1).optional(),
  redirectUris: z.array(z.string()).nullable().optional(),
  scopes: z.array(z.string()).min(1).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();
  try {
    const { id: clientId } = await context.params;
    const item = await db.oAuthClient.findUnique({ where: { id: clientId }, include: fullIncludes });
    if (!item) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'OAuth client not found' }, meta: { requestId: id } }, { status: 404 });
    }
    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[OAUTH:GET] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch OAuth client' }, meta: { requestId: id } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();
  try {
    const { id: clientId } = await context.params;
    const existing = await db.oAuthClient.findUnique({ where: { id: clientId } });
    if (!existing) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'OAuth client not found' }, meta: { requestId: id } }, { status: 404 });
    }
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } }, { status: 400 });
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input data', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
        meta: { requestId: id },
      }, { status: 400 });
    }
    const d = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (d.name !== undefined) updateData.name = d.name;
    if (d.description !== undefined) updateData.description = d.description;
    if (d.status !== undefined) updateData.status = d.status;
    if (d.grantTypes !== undefined) updateData.grantTypes = JSON.stringify(d.grantTypes);
    if (d.redirectUris !== undefined) updateData.redirectUris = JSON.stringify(d.redirectUris ?? []);
    if (d.scopes !== undefined) updateData.scopes = JSON.stringify(d.scopes);

    const item = await db.oAuthClient.update({ where: { id: clientId }, data: updateData, include: fullIncludes });
    try {
      await db.auditLog.create({ data: { action: 'OAUTH_CLIENT_UPDATED', resourceType: 'OAUTH_CLIENT', resourceId: clientId, details: JSON.stringify({ changes: Object.keys(updateData) }) } });
    } catch { /* non-critical */ }
    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[OAUTH:UPDATE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update OAuth client' }, meta: { requestId: id } }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();
  try {
    const { id: clientId } = await context.params;
    const existing = await db.oAuthClient.findUnique({ where: { id: clientId } });
    if (!existing) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'OAuth client not found' }, meta: { requestId: id } }, { status: 404 });
    }
    await db.oAuthClient.delete({ where: { id: clientId } });
    try {
      await db.auditLog.create({ data: { action: 'OAUTH_CLIENT_DELETED', resourceType: 'OAUTH_CLIENT', resourceId: clientId, details: JSON.stringify({ name: existing.name }) } });
    } catch { /* non-critical */ }
    return NextResponse.json({ data: { id: clientId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[OAUTH:DELETE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete OAuth client' }, meta: { requestId: id } }, { status: 500 });
  }
}
