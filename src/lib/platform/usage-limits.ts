// ============================================================
// USAGE LIMITS — server-side plan-limit enforcement.
// ============================================================
// Every resource that is plan-limited (sites, storage, AI words,
// AI articles, automation runs) is checked here before a new
// resource is created. Owner / billing-bypass users are unlimited.
//
// The plan is resolved via:
//   1. Owner bypass → unlimited
//   2. DB Subscription row → its planId
//   3. Legacy in-memory customer → its planId (fallback for demo data)
//   4. 'free' default
//
// Example: a Free customer (max 3 sites) who already owns 3 sites
// is blocked from creating another, with an actionable upgrade
// message — enforced on POST /api/sites, NOT in the UI only.
// ============================================================

import { db } from '@/lib/db';
import { getPlanConfigSync, type PlanLimits } from './plan-config';
import { getCustomerByEmailSync, getCustomerUsageSync } from './platform-data';
import { hasBillingBypass, getEffectivePlanIdAsync, type EntitlementUser } from './entitlements';
import { getUserSubscription } from './subscription-data';

export type LimitResource = 'sites' | 'storageBytes' | 'aiWords' | 'aiArticles' | 'automationRuns';

export interface LimitCheck {
  ok: boolean;
  /** -1 means unlimited */
  limit: number;
  current: number;
  requested: number;
  resource: LimitResource;
  message: string;
}

/**
 * Resolve the effective plan limits for a user. INTERNAL/EXEMPT → unlimited.
 * Otherwise prefer DB Subscription's planId, then legacy customer, then 'free'.
 */
export async function getEffectiveLimitsAsync(user: EntitlementUser): Promise<PlanLimits> {
  if (hasBillingBypass(user)) {
    return { maxSites: -1, storageBytes: -1, aiWords: -1, aiArticles: -1, automationRuns: -1 };
  }
  const { planId } = await getEffectivePlanIdAsync(user);
  return getPlanConfigSync(planId).limits;
}

/** Sync variant — used only in code paths where the async DB lookup is
 *  impractical (e.g. initial render). The async version is authoritative. */
export function getEffectiveLimits(user: EntitlementUser): PlanLimits {
  if (hasBillingBypass(user)) {
    return { maxSites: -1, storageBytes: -1, aiWords: -1, aiArticles: -1, automationRuns: -1 };
  }
  const customer = getCustomerByEmailSync(user.email);
  const planId = customer?.planId ?? 'free';
  return getPlanConfigSync(planId).limits;
}

/** Check whether `requested` new units of `resource` are within the plan limit.
 *  Returns a structured result; never throws. */
export async function checkLimit(
  user: EntitlementUser,
  resource: LimitResource,
  requested = 1,
): Promise<LimitCheck> {
  if (hasBillingBypass(user)) {
    return { ok: true, limit: -1, current: 0, requested, resource, message: 'Unlimited (internal account).' };
  }
  const limits = await getEffectiveLimitsAsync(user);
  const limit = limits[resource];
  const usage = getCustomerUsageSync(user.email);
  const current = usage[resource];

  if (limit === -1) {
    return { ok: true, limit: -1, current, requested, resource, message: 'Unlimited on this plan.' };
  }
  if (current + requested <= limit) {
    return { ok: true, limit, current, requested, resource, message: 'Within limit.' };
  }
  return {
    ok: false,
    limit,
    current,
    requested,
    resource,
    message: `Plan limit reached: ${current}/${limit} ${limitLabel(resource)}. Upgrade your plan to add more.`,
  };
}

/** Sync variant — kept for compatibility with call sites that haven't been
 *  migrated to the async API. Returns the same structure but uses the sync
 *  fallback plan resolution (no DB lookup). */
export function checkLimitSync(user: EntitlementUser, resource: LimitResource, requested = 1): LimitCheck {
  if (hasBillingBypass(user)) {
    return { ok: true, limit: -1, current: 0, requested, resource, message: 'Unlimited (internal account).' };
  }
  const limits = getEffectiveLimits(user);
  const limit = limits[resource];
  const usage = getCustomerUsageSync(user.email);
  const current = usage[resource];

  if (limit === -1) {
    return { ok: true, limit: -1, current, requested, resource, message: 'Unlimited on this plan.' };
  }
  if (current + requested <= limit) {
    return { ok: true, limit, current, requested, resource, message: 'Within limit.' };
  }
  return {
    ok: false,
    limit,
    current,
    requested,
    resource,
    message: `Plan limit reached: ${current}/${limit} ${limitLabel(resource)}. Upgrade your plan to add more.`,
  };
}

export function limitLabel(resource: LimitResource): string {
  switch (resource) {
    case 'sites':
      return 'sites';
    case 'storageBytes':
      return 'storage';
    case 'aiWords':
      return 'AI words';
    case 'aiArticles':
      return 'AI articles';
    case 'automationRuns':
      return 'automation runs';
  }
}

/** 403-shaped response carrying the upgrade message. */
export function limitExceededResponse(check: LimitCheck) {
  return Response.json(
    {
      error: {
        code: 'PLAN_LIMIT_EXCEEDED',
        message: check.message,
        resource: check.resource,
        limit: check.limit,
        current: check.current,
      },
    },
    { status: 403 },
  );
}

// -------------------- Per-customer override admin helpers --------------------

export interface CustomerEntitlementOverrideRow {
  customerEmail: string;
  feature: string;
  granted: boolean;
  grantedUntil: Date | null;
  reason: string | null;
  createdBy: string | null;
}

export async function listOverrides(customerEmail: string): Promise<CustomerEntitlementOverrideRow[]> {
  // SQLite doesn't support `mode: 'insensitive'`; we filter in JS
  // (the table is small — per-customer overrides are rare).
  const rows = await db.customerEntitlementOverride.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return rows
    .filter((r) => r.customerEmail.toLowerCase() === customerEmail.toLowerCase())
    .map((r) => ({
      customerEmail: r.customerEmail,
      feature: r.feature,
      granted: r.granted,
      grantedUntil: r.grantedUntil,
      reason: r.reason,
      createdBy: r.createdBy,
    }));
}

export async function upsertOverride(input: CustomerEntitlementOverrideRow & { createdBy?: string }): Promise<void> {
  await db.customerEntitlementOverride.upsert({
    where: { customerEmail_feature: { customerEmail: input.customerEmail, feature: input.feature } },
    create: {
      customerEmail: input.customerEmail,
      feature: input.feature,
      granted: input.granted,
      grantedUntil: input.grantedUntil,
      reason: input.reason,
      createdBy: input.createdBy,
    },
    update: {
      granted: input.granted,
      grantedUntil: input.grantedUntil,
      reason: input.reason,
      createdBy: input.createdBy,
    },
  });
}

export async function deleteOverride(customerEmail: string, feature: string): Promise<void> {
  try {
    await db.customerEntitlementOverride.delete({
      where: { customerEmail_feature: { customerEmail, feature } },
    });
  } catch {
    // not found — idempotent
  }
}

// Re-export the DB Subscription helper for callers that want to inspect
// the user's subscription directly (e.g. billing dashboard).
export { getUserSubscription };
