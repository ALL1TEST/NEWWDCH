'use client';

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { MODULE_FEATURE_MAP } from '@/lib/platform/feature-config';

// ============================================================
// PLAN ENTITLEMENTS — the Admin User dashboard feature state.
// ============================================================
// Server-side source of truth: /api/entitlements, which resolves the
// user's ACTIVE plan (DB Subscription → per-customer override → plan
// config, with owner/staff bypass) and returns the actual Feature
// Access configuration saved by Platform Admin → Plans & Pricing.
//
// The plan's Feature Access checkboxes are the SINGLE source of truth
// for what appears in the Admin User dashboard (sidebar, command
// palette, hash routes) — never the plan name. All three layers key
// off MODULE_FEATURE_MAP + this hook. The AUTHORITATIVE enforcement
// stays server-side (requireFeature → 403 FEATURE_NOT_AVAILABLE).
//
// While the query is loading, `data` is undefined — callers should
// treat that as "unknown yet" (fail-open for cosmetics only; the
// server enforces the real permissions on every endpoint).

export interface PlanEntitlementsState {
  /** All granted entitlement keys (normalized, incl. legacy aliases). */
  entitlements: string[];
  /** The 9 plan-editor Feature Access keys resolved to booleans. */
  features: Record<string, boolean>;
  plan: { id: string; name: string };
  billingMode: string;
}

export const ENTITLEMENTS_QUERY_KEY = ['plan-entitlements'] as const;

/** The client's plan Feature Access state (dashboard visibility). */
export function usePlanEntitlements() {
  return useQuery({
    queryKey: ENTITLEMENTS_QUERY_KEY,
    queryFn: () => getApi<PlanEntitlementsState>('/api/entitlements'),
    staleTime: 30_000,
  });
}

/**
 * True when the given dashboard module (page key, e.g. 'seo' from
 * '#seo') is available to the current user: non-feature modules are
 * always available; feature modules require the plan feature from
 * MODULE_FEATURE_MAP. Returns true while entitlements are still
 * loading (cosmetic fail-open — server routes enforce 403s).
 */
export function isModuleAllowedByPlan(
  moduleKey: string,
  entitlements: PlanEntitlementsState | undefined,
): boolean {
  const required = MODULE_FEATURE_MAP[moduleKey];
  if (!required) return true;
  if (!entitlements) return true; // loading → fail-open (cosmetic only)
  return entitlements.entitlements.includes(required);
}

/** Invalidate the entitlements state (e.g. after a plan change). */
export function invalidateEntitlementsKey(): readonly unknown[] {
  return ENTITLEMENTS_QUERY_KEY;
}
