// ============================================================
// POST /api/auth/logout — Logout endpoint
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';

const SESSION_COOKIE_NAME = 'cms_session_token';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    // 1. Read session token from cookie
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    // 2. Delete session from database if token exists
    if (token) {
      try {
        await db.session.deleteMany({
          where: { token },
        });
      } catch {
        // Session may not exist or may already be deleted — that's fine
      }
    }

    const duration = Date.now() - startTime;

    // 3. Clear the session cookie and return success
    const response = NextResponse.json(
      {
        data: {
          message: 'Successfully logged out',
        },
        meta: {
          requestId,
          timestamp,
          duration,
        },
      },
      { status: 200 },
    );

    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0), // Immediately expire
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error(`[AUTH:LOGOUT] ${requestId} - Unexpected error:`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during logout',
        },
        meta: { requestId, timestamp },
      },
      { status: 500 },
    );
  }
}
