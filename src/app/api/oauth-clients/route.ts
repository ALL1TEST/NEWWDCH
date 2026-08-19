// ============================================================
// GET  /api/oauth-clients      — List OAuth clients (admin)
// POST /api/oauth-clients      — Create OAuth client (admin)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { generateOAuthCredentials } from '@/lib/api/api-service';

function reqId() { return 'req_' + nanoid(8); }

const listIncludes = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
} as const;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  description: z.string().max(500).trim().optional(),
  grantTypes: z.array(z.enum(['AUTHORIZATION_CODE', 'CLIENT_CREDENTIALS', 'PKCE'])).min(1, 'At least one grant type is required'),
  redirectUris: z.array(z.string().url('Must be a valid URL')).optional(),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  userId: z.string().min(1, 'User ID is required'),
  siteId: z.string().optional(),
});

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'status']);

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

    const where: Record<string, unknown> = {};
    if (status && ['ACTIVE', 'INACTIVE', 'REVOKED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }

    const [items, total] = await Promise.all([
      db.oAuthClient.findMany({
        where,
        include: listIncludes,
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.oAuthClient.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: { requestId: id, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
    });
  } catch (error) {
    console.error(`[OAUTH:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch OAuth clients' }, meta: { requestId: id } },
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
    try { body = await request.json(); } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid input data',
          details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        meta: { requestId: id },
      }, { status: 400 });
    }

    const d = parsed.data;
    const { clientId, clientSecret, secretHash } = generateOAuthCredentials();

    const item = await db.oAuthClient.create({
      data: {
        name: d.name,
        description: d.description ?? null,
        clientId,
        clientSecret: secretHash,
        grantTypes: JSON.stringify(d.grantTypes),
        redirectUris: JSON.stringify(d.redirectUris ?? []),
        scopes: JSON.stringify(d.scopes),
        status: 'ACTIVE',
        userId: d.userId,
        siteId: d.siteId ?? null,
      },
      include: listIncludes,
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'OAUTH_CLIENT_CREATED',
          resourceType: 'OAUTH_CLIENT',
          resourceId: item.id,
          userId: d.userId,
          details: JSON.stringify({ name: item.name, clientId }),
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      { data: { ...item, clientSecret }, meta: { requestId: id } },
      { status: 201 },
    );
  } catch (error) {
    console.error(`[OAUTH:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create OAuth client' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
