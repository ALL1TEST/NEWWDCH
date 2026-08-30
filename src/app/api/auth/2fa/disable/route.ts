// ============================================================
// POST /api/auth/2fa/disable — disable the authenticator app
// ============================================================
// Body: { currentPassword: string, code?: string (6 digits) }
//
// Requires:
//   - valid session cookie + ACTIVE account
//   - current password (always required)
//   - if User.mfaEnabled is true: a valid 6-digit TOTP code from the
//     current secret (re-verification of possession of the
//     authenticator)
//
// Side effects:
//   - sets User.mfaEnabled = false
//   - clears User.mfaSecret = null (the secret is destroyed — a fresh
//     one is generated on next /setup)
//
// Security: the secret is decrypted in-memory only for the duration
// of the verification; it is never returned to the client.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { decryptSecret, verifyToken } from '@/lib/auth/totp';
// (verifyToken is async — must be awaited at call sites.)

const SESSION_COOKIE_NAME = 'cms_session_token';

const disableSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  code: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{6}$/.test(v.replace(/\s+/g, '')), 'Code must be exactly 6 digits'),
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

    const parsed = disableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { currentPassword, code } = parsed.data;

    // 3. Verify password
    if (user.password !== currentPassword) {
      return NextResponse.json(
        { error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect.' } },
        { status: 400 },
      );
    }

    // 4. If 2FA enabled, require + verify the TOTP code
    if (user.mfaEnabled) {
      if (!code) {
        return NextResponse.json(
          { error: { code: 'CODE_REQUIRED', message: 'Please enter the 6-digit code from your authenticator app.' } },
          { status: 400 },
        );
      }
      const plaintextSecret = await decryptSecret(user.mfaSecret);
      if (!plaintextSecret || !(await verifyToken(plaintextSecret, code.replace(/\s+/g, '')))) {
        return NextResponse.json(
          { error: { code: 'INVALID_CODE', message: 'Invalid verification code. Please try again.' } },
          { status: 400 },
        );
      }
    }

    // 5. Disable + clear secret
    await db.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    return NextResponse.json(
      { data: { mfaEnabled: false }, meta: { requestId, timestamp } },
      { status: 200 },
    );
  } catch (error) {
    console.error(`[AUTH:2FA:DISABLE] ${requestId} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to disable authenticator.' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
