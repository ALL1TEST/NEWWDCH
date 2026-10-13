// ============================================================
// GET /api/auth/2fa/qr — generate a fresh TOTP secret + QR code
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import {
  generateNewSecret,
  generateOtpauthUri,
  generateQrDataUrl,
  encryptSecret,
} from '@/lib/auth/totp';

const SESSION_COOKIE_NAME = 'cms_session_token';

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'No session token found.' } },
        { status: 401 },
      );
    }

    const session = await db.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Session expired.' } },
        { status: 401 },
      );
    }

    const user = session.user;
    const secret = generateNewSecret();
    const encryptedSecret = await encryptSecret(secret);
    await db.user.update({
      where: { id: user.id },
      data: { mfaSecret: encryptedSecret },
    });
    const otpauthUri = generateOtpauthUri(user.email, secret);
    const qrDataUrl = await generateQrDataUrl(otpauthUri);

    return NextResponse.json({
      data: {
        secret,
        otpauthUri,
        qrDataUrl,
      },
      meta: { requestId, timestamp },
    });
  } catch (error) {
    console.error(`[AUTH:2FA:QR] ${requestId} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate QR code.' } },
      { status: 500 },
    );
  }
}
