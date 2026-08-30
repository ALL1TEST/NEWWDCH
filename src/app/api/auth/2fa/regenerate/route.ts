// ============================================================
// POST /api/auth/2fa/regenerate — roll a new authenticator secret
// ============================================================
// Body: { currentPassword: string, code: string (6 digits) }
//
// Requires:
//   - valid session cookie + ACTIVE account
//   - current password (always required)
//   - a valid 6-digit TOTP code from the CURRENT secret (re-verifies
//     possession of the authenticator before rolling)
//
// Side effects:
//   - generates a new TOTP secret (base32)
//   - persists the secret ENCRYPTED to User.mfaSecret
//   - sets User.mfaEnabled = false (the user must re-activate with the
//     new secret before 2FA is live again — the UI reuses the same
//     activate step)
//
// Returns { secret, otpauthUri, qrDataUrl } so the UI can show the new
// QR + manual key. The plaintext secret is exposed only during the
// regenerate+reactivate flow; once activated, it is no longer returned
// by any endpoint.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import {
  generateNewSecret,
  generateOtpauthUri,
  generateQrDataUrl,
  encryptSecret,
  decryptSecret,
  verifyToken,
} from '@/lib/auth/totp';
// (verifyToken is async — must be awaited at call sites.)

const SESSION_COOKIE_NAME = 'cms_session_token';

const regenerateSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
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

    const parsed = regenerateSchema.safeParse(body);
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

    // 4. Verify the TOTP code from the current secret
    if (!user.mfaSecret) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_ENABLED',
            message: 'No authenticator secret is configured. Use Enable Authenticator App instead.',
          },
        },
        { status: 400 },
      );
    }

    const plaintextCurrentSecret = await decryptSecret(user.mfaSecret);
    if (!plaintextCurrentSecret || !(await verifyToken(plaintextCurrentSecret, code.replace(/\s+/g, '')))) {
      return NextResponse.json(
        { error: { code: 'INVALID_CODE', message: 'Invalid verification code. Please try again.' } },
        { status: 400 },
      );
    }

    // 5. Roll a fresh secret + persist ENCRYPTED. Disable until re-activated.
    const newSecret = generateNewSecret();
    const encryptedNewSecret = await encryptSecret(newSecret);
    await db.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: encryptedNewSecret,
        mfaEnabled: false,
      },
    });

    // 6. Build the otpauth URI + QR data URL
    const otpauthUri = generateOtpauthUri(user.email, newSecret);
    const qrDataUrl = await generateQrDataUrl(otpauthUri);

    return NextResponse.json(
      {
        data: { secret: newSecret, otpauthUri, qrDataUrl },
        meta: { requestId, timestamp },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(`[AUTH:2FA:REGENERATE] ${requestId} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to regenerate secret.' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
