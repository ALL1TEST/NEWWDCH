// ============================================================
// GET    /api/custom-permissions       — List all custom permissions
// POST   /api/custom-permissions       — Create a new custom permission
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { customPermissionKeyFromName } from '@/lib/permissions';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const select = {
  id: true,
  name: true,
  description: true,
  route: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string().max(500).trim().optional(),
  route: z.string().max(200).trim().optional(),
  createdBy: z.string().max(200).optional(),
});

// =====================================================================
// GET — list
// =====================================================================

export async function GET() {
  const id = reqId();
  try {
    const items = await db.customPermission.findMany({
      select,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: items.map((p) => ({
        ...p,
        key: customPermissionKeyFromName(p.name),
      })),
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[CUSTOM-PERMISSIONS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch custom permissions' }, meta: { requestId: id } },
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

    // Enforce uniqueness on the derived key (case-insensitive name normalization)
    const key = customPermissionKeyFromName(d.name);
    if (!key) {
      return NextResponse.json(
        { error: { code: 'INVALID_NAME', message: 'Permission name must contain at least one letter or number' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Look for an existing custom permission with the same key.
    // SQLite doesn't support case-insensitive unique constraints on a derived
    // value, so we do an explicit check.
    const allPerms = await db.customPermission.findMany({ select: { id: true, name: true } });
    const conflict = allPerms.find((p) => customPermissionKeyFromName(p.name) === key);
    if (conflict) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: `A custom permission with the key "${key}" already exists` }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    const item = await db.customPermission.create({
      data: {
        name: d.name,
        description: d.description ?? null,
        route: d.route ?? null,
        createdBy: d.createdBy ?? null,
      },
      select,
    });

    return NextResponse.json(
      { data: { ...item, key }, meta: { requestId: id } },
      { status: 201 },
    );
  } catch (error) {
    console.error(`[CUSTOM-PERMISSIONS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create custom permission' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
