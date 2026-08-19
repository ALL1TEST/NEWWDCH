// ============================================================
// GET /api/auth/me — Get current authenticated user
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
import type { UserRole } from '@/shared/types';

const SESSION_COOKIE_NAME = 'cms_session_token';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    // 1. Read session token from cookie
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'No session token found. Please log in.',
          },
          meta: { requestId, timestamp },
        },
        { status: 401 },
      );
    }

    // 2. Look up session and validate it
    const session = await db.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            authorProfile: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SESSION',
            message: 'Session not found or has been invalidated. Please log in again.',
          },
          meta: { requestId, timestamp },
        },
        { status: 401 },
      );
    }

    // 3. Check session expiry
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await db.session.delete({ where: { id: session.id } });

      return NextResponse.json(
        {
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Your session has expired. Please log in again.',
          },
          meta: { requestId, timestamp },
        },
        { status: 401 },
      );
    }

    // 4. Check user status
    const user = session.user;

    if (user.status === 'SUSPENDED') {
      return NextResponse.json(
        {
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'This account has been suspended. Please contact an administrator.',
          },
          meta: { requestId, timestamp },
        },
        { status: 403 },
      );
    }

    if (user.status === 'DEACTIVATED') {
      return NextResponse.json(
        {
          error: {
            code: 'ACCOUNT_DEACTIVATED',
            message: 'This account has been deactivated. Please contact an administrator.',
          },
          meta: { requestId, timestamp },
        },
        { status: 403 },
      );
    }

    // 5. Update session last active timestamp
    await db.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    // 6. Build user response with permissions
    const permissions = ROLE_PERMISSIONS[user.role as UserRole] ?? [];

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      authorProfile: user.authorProfile
        ? {
            id: user.authorProfile.id,
            displayName: user.authorProfile.displayName,
            slug: user.authorProfile.slug,
            bio: user.authorProfile.bio,
            website: user.authorProfile.website,
            avatar: user.authorProfile.avatar,
          }
        : null,
      permissions,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        lastActiveAt: session.lastActiveAt,
        createdAt: session.createdAt,
      },
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };

    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        data: {
          user: userData,
        },
        meta: {
          requestId,
          timestamp,
          duration,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(`[AUTH:ME] ${requestId} - Unexpected error:`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while fetching user session',
        },
        meta: { requestId, timestamp },
      },
      { status: 500 },
    );
  }
}
