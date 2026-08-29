// ============================================================
// POST /api/auth/2fa/activate — activate the pending 2FA secret
// ============================================================
// Body: { code: string (6 digits) }
//
// Requires:
//   - valid session cookie + ACTIVE account
//   - User.mfaSecret is set (i.e. setup was started)
//   - User.mfaEnabled is false (i.e. not already activated)
//
// Verifies the supplied 6-digit TOTP code against the decrypted
// secret. Only on success sets User.mfaEnabled = true. Returns
// { mfaEnabled: true }.
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

const activateSchema = z.object({
  code: z
    .string()
    .min(1, 'Verification code is required')
    .refine((v) => /^\d{6}$/.test(v.replace(/\s+/g, '')), 'Code must be exactly 6 digits'),
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

    const parsed = activateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const code = parsed.data.code.replace(/\s+/g, '');

    // 3. Need a pending secret to activate
    if (!user.mfaSecret) {
      return NextResponse.json(
        { error: { code: 'NO_PENDING_SECRET', message: 'No setup in progress. Start the authenticator setup first.' } },
        { status: 400 },
      );
    }
    if (user.mfaEnabled) {
      return NextResponse.json(
        { error: { code: 'ALREADY_ENABLED', message: 'Authenticator app is already enabled.' } },
        { status: 409 },
      );
    }

    // 4. Decrypt + verify the TOTP code
    const plaintextSecret = await decryptSecret(user.mfaSecret);
    if (!plaintextSecret) {
      // Secret is corrupted — clear it and ask the user to restart setup
      await db.user.update({ where: { id: user.id }, data: { mfaSecret: null, mfaEnabled: false } });
      return NextResponse.json(
        { error: { code: 'SECRET_CORRUPT', message: 'Stored secret is invalid. Please restart setup.' } },
        { status: 500 },
      );
    }

    if (!(await verifyToken(plaintextSecret, code))) {
      return NextResponse.json(
        { error: { code: 'INVALID_CODE', message: 'Invalid verification code. Please try again.' } },
        { status: 400 },
      );
    }

    // 5. Enable 2FA
    await db.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true },
    });

    return NextResponse.json(
      { data: { mfaEnabled: true }, meta: { requestId, timestamp } },
      { status: 200 },
    );
  } catch (error) {
    console.error(`[AUTH:2FA:ACTIVATE] ${requestId} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to activate authenticator.' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
