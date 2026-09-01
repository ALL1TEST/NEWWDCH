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

/** Require an authenticated user WITH a specific feature entitlement.
 *  This is the SINGLE helper every feature API route should call — it
 *  enforces server-side that the user's plan (or owner bypass / override)
 *  grants the requested feature. A Free user hitting a gated endpoint
 *  directly is denied with 403 FEATURE_NOT_AVAILABLE.
 *
 *  Usage:
 *    const auth = await requireFeature(request, 'advanced_analytics');
 *    if ('response' in auth) return auth.response;
 *    // auth.user has the feature granted (or is platform staff).
 *
 *  The owner bypass (OWNER role / INTERNAL billing mode) is enforced
 *  inside hasFeature() — Platform Admin always has full access
 *  regardless of which plan they happen to be on. */
export async function requireFeature(
  request: NextRequest,
  feature: string,
): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth;
  const { hasFeature, forbiddenResponse, trialExpiredResponse } = await import('./entitlements');
  // 1. Owner / billing bypass → grant (hasFeature returns true here).
  // 2. Per-customer override (grant/revoke + expiry).
  // 3. DB Subscription → planId → PlanConfig.entitlements.
  // 4. Otherwise deny.
  const allowed = await hasFeature(auth.user, feature);
  if (!allowed) {
    // Distinguish "feature not in plan" from "free trial expired".
    const { getEffectivePlanIdAsync } = await import('./entitlements');
    const { freeTrialExpired } = await getEffectivePlanIdAsync(auth.user);
    if (freeTrialExpired) {
      return { response: trialExpiredResponse() };
    }
    return { response: forbiddenResponse(feature) };
  }
  return { user: auth.user };
}

/** Require an authenticated user WITH a specific feature entitlement,
 *  but ALSO allow any platform staff member (PLATFORM_ADMIN included).
 *  Used by routes that manage shared platform infrastructure which
 *  clients reach only through the gated feature — e.g. the AI provider
 *  connection routes ('ai_client'): clients need the plan entitlement
 *  to connect their own AI API, while platform staff configure the
 *  platform's own providers regardless of which plan they are on.
 *  (OWNER / INTERNAL / EXEMPT already bypass inside hasFeature.) */
export async function requireFeatureAllowStaff(
  request: NextRequest,
  feature: string,
): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth;
  if (isPlatformStaff(auth.user)) return { user: auth.user };
  // Not platform staff → the standard plan-entitlement gate (single
  // shared implementation for the grant/override/trial logic).
  return requireFeature(request, feature);
}

/** Require an authenticated user with ANY ONE of the given feature
 *  entitlements (OR semantics), also allowing platform staff. Used for
 *  DERIVED capabilities that are NOT plan checkboxes themselves but
 *  supporting configuration for one or more plan features — e.g. SMTP
 *  Settings, which supports Email Templates and Newsletter: a client
 *  needs 'email_templates' OR 'newsletter' (the plan's Feature Access
 *  is the single source of truth — SMTP Settings is never a separate
 *  checkbox); platform staff pass unconditionally because the platform
 *  SMTP page (#platform-smtp) manages the platform's own SMTP through
 *  the same endpoints. Denies with 403 FEATURE_NOT_AVAILABLE when the
 *  plan includes NONE of the features. */
export async function requireAnyFeatureAllowStaff(
  request: NextRequest,
  features: string[],
): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth;
  if (isPlatformStaff(auth.user)) return { user: auth.user };

  const { hasFeature, getEffectivePlanIdAsync, trialExpiredResponse, forbiddenAnyResponse } =
    await import('./entitlements');
  // ANY of the features grants access (per-customer override + plan +
  // trial rules are all enforced inside hasFeature for each feature).
  for (const feature of features) {
    if (await hasFeature(auth.user, feature)) return { user: auth.user };
  }
  // Distinguish "none of the features in plan" from "free trial expired".
  const { freeTrialExpired } = await getEffectivePlanIdAsync(auth.user);
  if (freeTrialExpired) {
    return { response: trialExpiredResponse() };
  }
  return { response: forbiddenAnyResponse(features, 'SMTP Settings') };
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
