// ============================================================
// GET /api/auth/2fa/status — current user's 2FA status
// ============================================================
// Returns { mfaEnabled: boolean, hasSecret: boolean }. The actual
// secret is NEVER returned by this endpoint (or any endpoint after
// setup is completed).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';

const SESSION_COOKIE_NAME = 'cms_session_token';

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
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

    return NextResponse.json(
      {
        data: {
          mfaEnabled: user.mfaEnabled,
          hasSecret: !!user.mfaSecret,
        },
        meta: { requestId, timestamp },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(`[AUTH:2FA:STATUS] ${requestId} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch 2FA status.' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
