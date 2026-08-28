// ============================================================
// PLATFORM AUTH — Server-side authorization for platform admin
// ============================================================
// Validates the session cookie (cms_session_token) against the
// Session/User tables and enforces that the caller has the
// PLATFORM_ADMIN role for /api/platform/admin/* routes. Client
// billing routes (/api/platform/billing/*) only require a valid
// authenticated session (any role) since clients manage their own
// subscription.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const SESSION_COOKIE_NAME = 'cms_session_token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

/** Resolve the authenticated user from the request's session cookie. */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) return null;

  const u = session.user;
  if (u.status === 'SUSPENDED' || u.status === 'DEACTIVATED') return null;

  return {
    id: u.id,
    email: u.email,
    name: u.name ?? u.email,
    role: u.role,
    status: u.status,
  };
}

/** Require an authenticated user (any role). Returns the user or a 401 response. */
export async function requireAuth(request: NextRequest): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const user = await getAuthUser(request);
  if (!user) {
    return {
      response: NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } },
        { status: 401 },
      ),
    };
  }
  return { user };
}

/** Require a PLATFORM_ADMIN user. Returns the user or a 401/403 response. */
export async function requirePlatformAdmin(request: NextRequest): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth;
  if (auth.user.role !== 'PLATFORM_ADMIN') {
    return {
      response: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Platform admin access required.' } },
        { status: 403 },
      ),
    };
  }
  return { user: auth.user };
}

/** Standard success envelope. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data, meta: { timestamp: new Date().toISOString() } }, init);
}

/** Standard error envelope. */
export function fail(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message }, meta: { timestamp: new Date().toISOString() } },
    { status },
  );
}
