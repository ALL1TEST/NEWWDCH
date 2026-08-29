// ============================================================
// POST /api/auth/change-email — Change the current user's email
// ============================================================
// Requires:
//   - valid session cookie
//   - account is ACTIVE
//   - current password (verified against user.password)
//   - new email (validated as email + globally unique)
//
// On success: updates User.email + User.emailVerified=false, returns
// the new email. The auth store should refresh /api/auth/me to pick
// up the new email.
//
// Security: this route is for SELF-service email change only. It does
// NOT touch Platform Admin / Owner provisioning — that lives at
// /api/platform/admin/admin-users/* and is unaffected.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';

const SESSION_COOKIE_NAME = 'cms_session_token';

const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newEmail: z
    .string()
    .min(1, 'New email is required')
    .email('Please enter a valid email address')
    .transform((v) => v.toLowerCase().trim()),
});

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    // 1. Resolve session + user
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'No session token found.' }, meta: { requestId, timestamp } },
        { status: 401 },
      );
    }

    const session = await db.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Session not found or expired.' }, meta: { requestId, timestamp } },
        { status: 401 },
      );
    }

    const user = session.user;
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Account is not active.' }, meta: { requestId, timestamp } },
        { status: 403 },
      );
    }

    // 2. Parse + validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId, timestamp } },
        { status: 400 },
      );
    }

    const parsed = changeEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { currentPassword, newEmail } = parsed.data;

    // 3. Verify current password (plain-text comparison — demo only)
    if (user.password !== currentPassword) {
      return NextResponse.json(
        { error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect.' } },
        { status: 400 },
      );
    }

    // 4. Reject no-op change
    if (newEmail === user.email) {
      return NextResponse.json(
        { error: { code: 'SAME_EMAIL', message: 'New email must be different from your current email.' } },
        { status: 400 },
      );
    }

    // 5. Uniqueness check — reject if email already used by another account
    const existing = await db.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== user.id) {
      return NextResponse.json(
        { error: { code: 'EMAIL_IN_USE', message: 'This email is already used by another account.' } },
        { status: 409 },
      );
    }

    // 6. Apply the change. emailVerified is reset — the new email must be
    // re-verified by the user (out-of-band flow, not built here).
    await db.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        emailVerified: false,
      },
    });

    return NextResponse.json(
      { data: { email: newEmail, emailVerified: false }, meta: { requestId, timestamp } },
      { status: 200 },
    );
  } catch (error) {
    console.error(`[AUTH:CHANGE_EMAIL] ${requestId} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to change email.' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
