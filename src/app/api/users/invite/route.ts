// ============================================================
// POST /api/users/invite — Invite a new user
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
  assignedSites: true,
  sitePermissions: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------- validation ------------------------------------------------

const inviteSchema = z.object({
  email: z.email('Please enter a valid email address'),
  name: z.string().max(200).trim().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'AUTHOR', 'CONTRIBUTOR', 'VIEWER', 'SEO_MANAGER', 'CONTENT_MANAGER', 'MARKETING_MANAGER']).optional(),
  assignedSites: z.array(z.string()).optional(),
  sitePermissions: z.array(z.string()).optional(),
});

// =====================================================================
// POST — invite
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

    const parsed = inviteSchema.safeParse(body);
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
        assignedSites: d.assignedSites && d.assignedSites.length > 0 ? JSON.stringify(d.assignedSites) : null,
        sitePermissions: d.sitePermissions && d.sitePermissions.length > 0 ? JSON.stringify(d.sitePermissions) : null,
      },
      select: userSelect,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[USERS:INVITE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to invite user' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
