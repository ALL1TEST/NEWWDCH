// ============================================================
// USAGE LIMITS — server-side plan-limit enforcement.
// ============================================================
// Every resource that is plan-limited (sites, storage, AI words,
// AI articles, automation runs) is checked here before a new
// resource is created. Owner / billing-bypass users are unlimited.
//
// Example: a Beta customer (max 3 sites) who already owns 3 sites
// is blocked from creating another, with an actionable upgrade
// message — enforced on POST /api/sites, NOT in the UI only.
// ============================================================

import { db } from '@/lib/db';
import { getPlanConfigSync, type PlanLimits } from './plan-config';
import { getCustomerByEmailSync, getCustomerUsageSync } from './platform-data';
import { hasBillingBypass, type EntitlementUser } from './entitlements';

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

/** Resolve the effective plan limits for a user. INTERNAL/EXEMPT → unlimited. */
export function getEffectiveLimits(user: EntitlementUser): PlanLimits {
  if (hasBillingBypass(user)) {
    return { maxSites: -1, storageBytes: -1, aiWords: -1, aiArticles: -1, automationRuns: -1 };
  }
  const customer = getCustomerByEmailSync(user.email);
  const planId = customer?.planId ?? 'beta';
  return getPlanConfigSync(planId).limits;
}

/** Check whether `requested` new units of `resource` are within the plan limit.
 *  Returns a structured result; never throws. */
export function checkLimit(user: EntitlementUser, resource: LimitResource, requested = 1): LimitCheck {
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
  grantedUntil: string | null;
  reason: string | null;
}

export async function listOverrides(customerEmail: string): Promise<CustomerEntitlementOverrideRow[]> {
  const rows = await db.customerEntitlementOverride.findMany({
    where: { customerEmail: { equals: customerEmail, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    customerEmail: r.customerEmail,
    feature: r.feature,
    granted: r.granted,
    grantedUntil: r.grantedUntil?.toISOString() ?? null,
    reason: r.reason ?? null,
  }));
}

export async function upsertOverride(input: {
  customerEmail: string;
  feature: string;
  granted: boolean;
  grantedUntil: string | null;
  reason?: string | null;
  createdBy?: string;
}): Promise<void> {
  await db.customerEntitlementOverride.upsert({
    where: { customerEmail_feature: { customerEmail: input.customerEmail, feature: input.feature } },
    create: {
      customerEmail: input.customerEmail,
      feature: input.feature,
      granted: input.granted,
      grantedUntil: input.grantedUntil ? new Date(input.grantedUntil) : null,
      reason: input.reason ?? null,
      createdBy: input.createdBy ?? null,
    },
    update: {
      granted: input.granted,
      grantedUntil: input.grantedUntil ? new Date(input.grantedUntil) : null,
      reason: input.reason ?? null,
      createdBy: input.createdBy ?? null,
    },
  });
}

export async function deleteOverride(customerEmail: string, feature: string): Promise<void> {
  await db.customerEntitlementOverride
    .delete({ where: { customerEmail_feature: { customerEmail, feature } } })
    .catch(() => undefined);
}
