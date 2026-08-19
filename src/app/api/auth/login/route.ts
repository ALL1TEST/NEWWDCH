// ============================================================
// POST /api/auth/login — Login endpoint
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loginSchema } from '@/lib/validators';
import { generateRequestId } from '@/lib/utils';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
import type { UserRole } from '@/shared/types';

const SESSION_COOKIE_NAME = 'cms_session_token';
const SESSION_EXPIRY_DAYS = 30;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    // 1. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
          meta: { requestId, timestamp },
        },
        { status: 400 },
      );
    }

    const result = loginSchema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError?.message ?? 'Invalid input data',
            details: result.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
          meta: { requestId, timestamp },
        },
        { status: 400 },
      );
    }

    const { email, password } = result.data;

    // 2. Find user by email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        authorProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
          meta: { requestId, timestamp },
        },
        { status: 401 },
      );
    }

    // 3. Check account status
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

    // 4. Compare plain-text password (demo purposes only)
    if (user.password !== password) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
          meta: { requestId, timestamp },
        },
        { status: 401 },
      );
    }

    // 5. Generate session token
    const token = generateRequestId() + '-' + generateRequestId();

    // 6. Create session record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    await db.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        ipAddress,
        userAgent,
        lastActiveAt: new Date(),
      },
    });

    // 7. Update last login info
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress ?? undefined,
      },
    });

    // 8. Build user response with permissions
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
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };

    const duration = Date.now() - startTime;

    // 9. Set session cookie and return response
    const response = NextResponse.json(
      {
        data: {
          user: userData,
          token,
        },
        meta: {
          requestId,
          timestamp,
          duration,
        },
      },
      { status: 200 },
    );

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60, // seconds
    });

    return response;
  } catch (error) {
    console.error(`[AUTH:LOGIN] ${requestId} - Unexpected error:`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during login',
        },
        meta: { requestId, timestamp },
      },
      { status: 500 },
    );
  }
}
