// ============================================================
// POST /api/auth/2fa/setup — start the authenticator-app setup flow
// ============================================================
// Body: { currentPassword: string }
//
// Requires:
//   - valid session cookie + ACTIVE account
//   - current password verified
//   - 2FA NOT already enabled (use /regenerate to roll a new secret
//     when already enabled)
//
// Side effects:
//   - generates a new TOTP secret (base32)
//   - persists the secret ENCRYPTED to User.mfaSecret
//   - keeps User.mfaEnabled = false (pending activation)
//
// Returns { secret, otpauthUri, qrDataUrl } so the UI can show the QR
// + the manual "2FA Key". The plaintext secret is exposed only during
// the SETUP flow; once the user activates (POST /activate) it is no
// longer returned by any endpoint.
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
} from '@/lib/auth/totp';

const SESSION_COOKIE_NAME = 'cms_session_token';

const setupSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
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

    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { currentPassword } = parsed.data;

    // 3. Verify current password
    if (user.password !== currentPassword) {
      return NextResponse.json(
        { error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect.' } },
        { status: 400 },
      );
    }

    // 4. Reject if 2FA already enabled — use /regenerate instead
    if (user.mfaEnabled) {
      return NextResponse.json(
        {
          error: {
            code: 'ALREADY_ENABLED',
            message: 'Authenticator app is already enabled. Use Regenerate to roll a new secret.',
          },
        },
        { status: 409 },
      );
    }

    // 5. Generate fresh secret + persist ENCRYPTED
    const secret = generateNewSecret();
    const encryptedSecret = await encryptSecret(secret);
    await db.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: encryptedSecret,
        mfaEnabled: false,
      },
    });

    // 6. Build the otpauth URI + QR data URL
    const otpauthUri = generateOtpauthUri(user.email, secret);
    const qrDataUrl = await generateQrDataUrl(otpauthUri);

    return NextResponse.json(
      {
        data: { secret, otpauthUri, qrDataUrl },
        meta: { requestId, timestamp },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(`[AUTH:2FA:SETUP] ${requestId} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to start 2FA setup.' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
