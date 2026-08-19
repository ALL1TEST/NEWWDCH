// ============================================================
// GET    /api/api-keys/[id] — Get single API key
// PATCH  /api/api-keys/[id] — Update API key
// DELETE /api/api-keys/[id] — Delete API key
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getExpirationDate } from '@/lib/api/api-service';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const fullIncludes = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
  _count: { select: { apiLogs: true } },
} as const;

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'REVOKED']).optional(),
  environment: z.enum(['DEVELOPMENT', 'TESTING', 'PRODUCTION']).optional(),
  scopes: z.array(z.string()).min(1).optional(),
  siteAccess: z.enum(['CURRENT', 'SELECTED', 'ALL']).optional(),
  allowedSiteIds: z.array(z.string()).nullable().optional(),
  allowedIps: z.array(z.string()).nullable().optional(),
  allowedDomains: z.array(z.string()).nullable().optional(),
  allowedOrigins: z.array(z.string()).nullable().optional(),
  rateLimitPerMin: z.number().int().min(1).max(10000).optional(),
  rateLimitPerHour: z.number().int().min(1).max(100000).optional(),
  rateLimitPerDay: z.number().int().min(1).max(1000000).optional(),
  isActive: z.boolean().optional(),
  expiration: z.enum(['1d', '7d', '30d', '90d', 'never']).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: keyId } = await context.params;

    const item = await db.apiKey.findUnique({
      where: { id: keyId },
      include: fullIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[API_KEYS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch API key' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: keyId } = await context.params;

    const existing = await db.apiKey.findUnique({ where: { id: keyId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
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
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (d.name !== undefined) updateData.name = d.name;
    if (d.description !== undefined) updateData.description = d.description;
    if (d.status !== undefined) {
      updateData.status = d.status;
      updateData.isActive = d.status === 'ACTIVE';
    }
    if (d.isActive !== undefined && d.status === undefined) updateData.isActive = d.isActive;
    if (d.environment !== undefined) updateData.environment = d.environment;
    if (d.scopes !== undefined) updateData.scopes = JSON.stringify(d.scopes);
    if (d.siteAccess !== undefined) updateData.siteAccess = d.siteAccess;
    if (d.allowedSiteIds !== undefined) updateData.allowedSiteIds = d.allowedSiteIds ? JSON.stringify(d.allowedSiteIds) : null;
    if (d.allowedIps !== undefined) updateData.allowedIps = d.allowedIps ? JSON.stringify(d.allowedIps) : null;
    if (d.allowedDomains !== undefined) updateData.allowedDomains = d.allowedDomains ? JSON.stringify(d.allowedDomains) : null;
    if (d.allowedOrigins !== undefined) updateData.allowedOrigins = d.allowedOrigins ? JSON.stringify(d.allowedOrigins) : null;
    if (d.rateLimitPerMin !== undefined) updateData.rateLimitPerMin = d.rateLimitPerMin;
    if (d.rateLimitPerHour !== undefined) updateData.rateLimitPerHour = d.rateLimitPerHour;
    if (d.rateLimitPerDay !== undefined) updateData.rateLimitPerDay = d.rateLimitPerDay;
    if (d.expiration !== undefined) updateData.expiresAt = getExpirationDate(d.expiration);

    const item = await db.apiKey.update({
      where: { id: keyId },
      data: updateData,
      include: fullIncludes,
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'API_KEY_UPDATED',
          resourceType: 'API_KEY',
          resourceId: item.id,
          details: JSON.stringify({ changes: Object.keys(updateData) }),
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[API_KEYS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update API key' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — hard delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: keyId } = await context.params;

    const existing = await db.apiKey.findUnique({ where: { id: keyId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.apiKey.delete({ where: { id: keyId } });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'API_KEY_DELETED',
          resourceType: 'API_KEY',
          resourceId: keyId,
          details: JSON.stringify({ name: existing.name }),
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ data: { id: keyId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[API_KEYS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete API key' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
