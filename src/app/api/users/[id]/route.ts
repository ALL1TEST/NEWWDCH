// ============================================================
// GET    /api/users/[id] — Get single user
// PATCH  /api/users/[id] — Update user
// DELETE /api/users/[id] — Soft-delete user
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

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

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim().optional(),
  email: z.email('Please enter a valid email address').optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'AUTHOR', 'CONTRIBUTOR']).optional(),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  bio: z.string().max(2000).optional(),
  avatar: z.string().trim().optional().or(z.literal('')),
});

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: userId } = await context.params;

    const item = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: userSelect,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[USERS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' }, meta: { requestId: id } },
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
    const { id: userId } = await context.params;

    const existing = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found' }, meta: { requestId: id } },
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
    if (d.email !== undefined) updateData.email = d.email;
    if (d.role !== undefined) updateData.role = d.role;
    if (d.status !== undefined) updateData.status = d.status;
    if (d.bio !== undefined) updateData.bio = d.bio;
    if (d.avatar !== undefined) updateData.avatar = d.avatar === '' ? null : d.avatar;

    const item = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: userSelect,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[USERS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — soft delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: userId } = await context.params;

    const existing = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: { id: userId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[USERS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
