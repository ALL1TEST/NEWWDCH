// ============================================================
// GET  /api/personal-access-tokens      — List PATs (admin)
// POST /api/personal-access-tokens      — Create PAT (admin)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { generatePat, getExpirationDate } from '@/lib/api/api-service';

function reqId() { return 'req_' + nanoid(8); }

const listIncludes = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  _count: { select: { apiLogs: true } },
} as const;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  userId: z.string().min(1, 'User ID is required'),
  expiration: z.enum(['1d', '7d', '30d', '90d', 'never']).default('never'),
});

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'lastUsedAt']);

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

    const [items, total] = await Promise.all([
      db.personalAccessToken.findMany({
        orderBy: { [sort]: order },
        include: listIncludes,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.personalAccessToken.count(),
    ]);

    return NextResponse.json({
      data: items,
      meta: { requestId: id, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
    });
  } catch (error) {
    console.error(`[PAT:LIST] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch tokens' }, meta: { requestId: id } }, { status: 500 });
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
      return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } }, { status: 400 });
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input data', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
        meta: { requestId: id },
      }, { status: 400 });
    }
    const d = parsed.data;
    const { raw, hash, prefix } = generatePat();
    const expiresAt = getExpirationDate(d.expiration);

    const item = await db.personalAccessToken.create({
      data: {
        name: d.name,
        tokenHash: hash,
        tokenPrefix: prefix,
        scopes: JSON.stringify(d.scopes),
        userId: d.userId,
        expiresAt,
      },
      include: listIncludes,
    });

    try {
      await db.auditLog.create({ data: { action: 'PAT_CREATED', resourceType: 'PERSONAL_ACCESS_TOKEN', resourceId: item.id, userId: d.userId, details: JSON.stringify({ name: item.name }) } });
    } catch { /* non-critical */ }

    return NextResponse.json({ data: { ...item, rawToken: raw }, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[PAT:CREATE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create token' }, meta: { requestId: id } }, { status: 500 });
  }
}
