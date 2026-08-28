// ============================================================
// PLATFORM AUTH — Server-side authorization for platform admin.
// ============================================================
// Validates the session cookie (cms_session_token) against the
// Session/User tables. Roles:
//   OWNER          — full platform control + billing bypass
//   PLATFORM_ADMIN — platform management (per permissions)
//   CLIENT/ADMIN/EDITOR — client-side CMS only
//
// /api/platform/admin/* requires PLATFORM_ADMIN OR OWNER (guarded by
// requirePlatformAdmin). Owner-only mutations (plans, pricing, SMTP,
// feature flags, admin users) use requireOwner. Client billing routes
// (/api/platform/billing/*) only require a valid session (requireAuth).
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
  billingMode: string; // 'EXTERNAL' | 'INTERNAL' | 'EXEMPT'
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
    billingMode: u.billingMode,
  };
}

/** True for the platform owner (full bypass). */
export function isOwner(user: { role?: string; billingMode?: string } | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'OWNER' || user.billingMode === 'INTERNAL';
}

/** True for any platform-level admin (OWNER or PLATFORM_ADMIN). */
export function isPlatformStaff(user: { role?: string; billingMode?: string } | null | undefined): boolean {
  if (!user) return false;
  return isOwner(user) || user.role === 'PLATFORM_ADMIN';
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

/** Require a PLATFORM_ADMIN or OWNER user. Returns the user or a 401/403 response. */
export async function requirePlatformAdmin(request: NextRequest): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth;
  if (!isPlatformStaff(auth.user)) {
    return {
      response: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Platform admin access required.' } },
        { status: 403 },
      ),
    };
  }
  return { user: auth.user };
}

/** Require the platform OWNER. Returns the user or a 401/403 response.
 *  Use for owner-only mutations (plan pricing, SMTP, admin users, etc.). */
export async function requireOwner(request: NextRequest): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth;
  if (!isOwner(auth.user)) {
    return {
      response: NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Platform owner access required.' } },
        { status: 403 },
      ),
    };
  }
  return { user: auth.user };
}

/** Extract client IP for audit logging (never used for auth decisions). */
export function getClientIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
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
