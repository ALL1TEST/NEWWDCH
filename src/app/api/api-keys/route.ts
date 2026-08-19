// ============================================================
// GET  /api/api-keys      — List API keys (admin)
// POST /api/api-keys      — Create an API key (admin)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { generateApiKey, getExpirationDate } from '@/lib/api/api-service';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const listIncludes = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
  _count: { select: { apiLogs: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim(),
  description: z.string().max(500).trim().optional(),
  type: z.enum(['LIVE', 'TEST']).default('LIVE'),
  environment: z.enum(['DEVELOPMENT', 'TESTING', 'PRODUCTION']).default('PRODUCTION'),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  userId: z.string().min(1, 'User ID is required'),
  siteId: z.string().optional(),
  siteAccess: z.enum(['CURRENT', 'SELECTED', 'ALL']).default('CURRENT'),
  allowedSiteIds: z.array(z.string()).optional(),
  allowedIps: z.array(z.string()).optional(),
  allowedDomains: z.array(z.string()).optional(),
  allowedOrigins: z.array(z.string()).optional(),
  rateLimitPerMin: z.number().int().min(1).max(10000).default(100),
  rateLimitPerHour: z.number().int().min(1).max(100000).default(1000),
  rateLimitPerDay: z.number().int().min(1).max(1000000).default(10000),
  expiration: z.enum(['1d', '7d', '30d', '90d', 'never']).default('never'),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'status', 'type', 'environment', 'lastUsedAt', 'totalRequests']);

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
    const status = sp.get('status');
    const type = sp.get('type');
    const environment = sp.get('environment');
    const search = sp.get('search')?.trim();

    const where: Record<string, unknown> = {};

    if (status && ['ACTIVE', 'INACTIVE', 'REVOKED', 'EXPIRED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }
    if (type && ['LIVE', 'TEST'].includes(type.toUpperCase())) {
      where.type = type.toUpperCase();
    }
    if (environment && ['DEVELOPMENT', 'TESTING', 'PRODUCTION'].includes(environment.toUpperCase())) {
      where.environment = environment.toUpperCase();
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { keyPrefix: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.apiKey.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.apiKey.count({ where }),
    ]);

    // Status check — auto-expire
    const now = new Date();
    for (const item of items) {
      if (item.expiresAt && item.expiresAt < now && item.status === 'ACTIVE') {
        await db.apiKey.update({ where: { id: item.id }, data: { status: 'EXPIRED', isActive: false } });
        item.status = 'EXPIRED';
        item.isActive = false;
      }
    }

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[API_KEYS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch API keys' }, meta: { requestId: id } },
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
    const { raw, hash, prefix } = generateApiKey(d.type);
    const expiresAt = getExpirationDate(d.expiration);

    const item = await db.apiKey.create({
      data: {
        name: d.name,
        description: d.description ?? null,
        keyHash: hash,
        keyPrefix: prefix,
        type: d.type,
        status: 'ACTIVE',
        environment: d.environment,
        scopes: JSON.stringify(d.scopes),
        userId: d.userId,
        siteId: d.siteId ?? null,
        siteAccess: d.siteAccess,
        allowedSiteIds: d.allowedSiteIds ? JSON.stringify(d.allowedSiteIds) : null,
        allowedIps: d.allowedIps && d.allowedIps.length > 0 ? JSON.stringify(d.allowedIps) : null,
        allowedDomains: d.allowedDomains && d.allowedDomains.length > 0 ? JSON.stringify(d.allowedDomains) : null,
        allowedOrigins: d.allowedOrigins && d.allowedOrigins.length > 0 ? JSON.stringify(d.allowedOrigins) : null,
        rateLimitPerMin: d.rateLimitPerMin,
        rateLimitPerHour: d.rateLimitPerHour,
        rateLimitPerDay: d.rateLimitPerDay,
        expiresAt,
      },
      include: listIncludes,
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'API_KEY_CREATED',
          resourceType: 'API_KEY',
          resourceId: item.id,
          userId: d.userId,
          details: JSON.stringify({ name: item.name, type: item.type, environment: item.environment }),
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ data: { ...item, rawKey: raw }, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[API_KEYS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create API key' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
