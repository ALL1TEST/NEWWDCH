// ============================================================
// GET    /api/users      — List users (paginated, filterable)
// POST   /api/users      — Create/invite a user
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import crypto from 'crypto';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  bio: true,
  role: true,
  status: true,
  emailVerified: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  authorProfile: {
    select: {
      id: true,
      displayName: true,
      slug: true,
      bio: true,
      website: true,
      twitter: true,
      github: true,
      linkedin: true,
      avatar: true,
    },
  },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  email: z.email('Please enter a valid email address'),
  name: z.string().max(200).trim().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'AUTHOR', 'CONTRIBUTOR']).optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'updatedAt', 'name', 'email', 'role', 'status']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));;
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const search = sp.get('search') || '';
    const role = sp.get('role') || undefined;
    const status = sp.get('status') || undefined;

    const where: Record<string, unknown> = { deletedAt: null };
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        select: userSelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[USERS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch users' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create / invite
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

    // Check if user with email already exists
    const existing = await db.user.findFirst({
      where: { email: d.email, deletedAt: null },
    });

    if (existing) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'A user with this email already exists' }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    // Generate a random password placeholder (user will set via invite flow)
    const randomPassword = crypto.randomBytes(32).toString('hex');

    const item = await db.user.create({
      data: {
        email: d.email,
        name: d.name || null,
        role: d.role || 'AUTHOR',
        status: 'INVITED',
        password: randomPassword,
      },
      select: userSelect,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[USERS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create user' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
