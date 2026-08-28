// ============================================================
// ENTITLEMENTS — centralized feature-access control.
// ============================================================
// hasFeature(user, feature) is the SINGLE function every page and
// API checks. It enforces, in priority order:
//   1. OWNER role or billingMode INTERNAL/EXEMPT  → grant all (owner bypass)
//   2. Per-customer override (CustomerEntitlementOverride) → honor grant/revoke + expiry
//   3. Plan entitlements (PlanConfig.entitlements) → grant if the customer's plan includes the feature
//   4. Otherwise deny
//
// This is enforced SERVER-SIDE on every feature route (/api/automations,
// /api/ai, …). Hiding the sidebar item is cosmetic only; a Beta user
// hitting /automation or the API directly is still denied.
// ============================================================

import { db } from '@/lib/db';
import { getPlanConfigSync, getPlanEntitlements, ENTITLEMENT_KEYS, type EntitlementKey } from './plan-config';
import { getCustomerByEmailSync } from './platform-data';

export interface EntitlementUser {
  id: string;
  email: string;
  role: string;
  billingMode?: string; // 'EXTERNAL' | 'INTERNAL' | 'EXEMPT'
}

/** True if the user has the platform billing bypass (owner / staff / complimentary). */
export function hasBillingBypass(user: { role?: string; billingMode?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'OWNER') return true;
  return user.billingMode === 'INTERNAL' || user.billingMode === 'EXEMPT';
}

/** Resolve the effective plan id for a user. INTERNAL/EXEMPT users get a
 *  synthetic 'internal' plan with every entitlement. */
export function getEffectivePlanId(user: EntitlementUser): string {
  if (hasBillingBypass(user)) return 'internal';
  const customer = getCustomerByEmailSync(user.email);
  return customer?.planId ?? 'beta';
}

/** The full set of entitlement keys the user currently has access to.
 *  Used by the client nav API (cosmetic) — server enforces via hasFeature. */
export async function listEntitlementsForUser(user: EntitlementUser): Promise<string[]> {
  if (hasBillingBypass(user)) return [...ENTITLEMENT_KEYS];

  const planId = getEffectivePlanId(user);
  const granted = new Set<string>(planId === 'internal' ? ENTITLEMENT_KEYS : getPlanEntitlements(planId));

  // Apply per-customer overrides (grant or revoke).
  const overrides = await db.customerEntitlementOverride.findMany({
    where: { customerEmail: { equals: user.email, mode: 'insensitive' } },
  });
  const now = new Date();
  for (const o of overrides) {
    const expired = o.grantedUntil ? o.grantedUntil < now : false;
    if (o.granted && !expired) granted.add(o.feature);
    if (!o.granted || expired) granted.delete(o.feature);
  }
  return [...granted];
}

/** The core server-side check. Async because of override DB lookup. */
export async function hasFeature(user: EntitlementUser, feature: string): Promise<boolean> {
  // 1. Owner / billing bypass → all features.
  if (hasBillingBypass(user)) return true;

  // 2. Per-customer override (explicit grant/revoke, possibly time-limited).
  const override = await db.customerEntitlementOverride.findUnique({
    where: { customerEmail_feature: { customerEmail: user.email, feature } },
  });
  if (override) {
    const now = new Date();
    const expired = override.grantedUntil ? override.grantedUntil < now : false;
    if (!expired) return override.granted;
  }

  // 3. Plan entitlements.
  const planId = getEffectivePlanId(user);
  if (planId === 'internal') return true;
  const planEntitlements = getPlanEntitlements(planId);
  return planEntitlements.includes(feature);
}

/** Sync variant: only checks owner bypass + plan entitlements (NOT overrides).
 *  Use only for cosmetic UI gating where an async call is impractical; the
 *  authoritative check is the async hasFeature() on the server. */
export function hasFeatureSyncQuick(user: EntitlementUser, feature: string): boolean {
  if (hasBillingBypass(user)) return true;
  const planId = getEffectivePlanId(user);
  if (planId === 'internal') return true;
  return getPlanEntitlements(planId).includes(feature);
}

/** Throw a 403-shaped error for use in API route guards. */
export function forbiddenResponse(feature: string) {
  return Response.json(
    {
      error: {
        code: 'FEATURE_NOT_AVAILABLE',
        message: `Your plan does not include "${feature}". Upgrade to access this feature.`,
        feature,
      },
    },
    { status: 403 },
  );
}

export type { EntitlementKey };
