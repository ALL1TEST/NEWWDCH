// ============================================================
// PLAN CONFIG — DB-backed, cached single source of truth for plans,
// pricing, entitlements and usage limits.
// ============================================================
// The Client Billing API and the Platform Admin both read from (and
// the admin mutates) this same service. `platform-data.ts` delegates
// its `PLANS` / `getPlan` / `monthlyPrice` to the synchronous cache
// exposed here, so an owner edit (savePlanConfig) propagates to the
// client billing experience and to MRR on the next read.
//
// The cache is hydrated from the PlanConfig table on startup and after
// every mutation. If the table is empty on first hydrate, the DEFAULT
// configs are seeded so the platform is never without plans.
// ============================================================

import { db } from '@/lib/db';
// Re-export the shared client-safe vocabulary so existing imports keep working.
export { ENTITLEMENT_KEYS, ENTITLEMENT_LABELS } from './feature-config';
export type { EntitlementKey } from './feature-config';

export interface PlanLimits {
  /** -1 = unlimited */
  maxSites: number;
  storageBytes: number;
  aiWords: number;
  aiArticles: number;
  automationRuns: number;
}

export interface PlanConfigData {
  planId: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  isFree: boolean;
  active: boolean;
  features: string[];
  entitlements: string[];
  limits: PlanLimits;
  badgeVariant: string;
  sortOrder: number;
}

// -------------------- Defaults (also the seed) --------------------

const GB = 1024 * 1024 * 1024;

export const DEFAULT_PLAN_CONFIGS: PlanConfigData[] = [
  {
    planId: 'beta',
    name: 'Beta',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'CHF',
    interval: 'monthly',
    isFree: true,
    active: true,
    features: ['Up to 3 sites', 'Basic analytics', 'Email support', '1 GB storage'],
    entitlements: [],
    limits: { maxSites: 3, storageBytes: 1 * GB, aiWords: 0, aiArticles: 0, automationRuns: 0 },
    badgeVariant: 'beta',
    sortOrder: 0,
  },
  {
    planId: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    priceYearly: 490,
    currency: 'CHF',
    interval: 'monthly',
    isFree: false,
    active: true,
    features: [
      'Up to 10 sites',
      'Advanced analytics',
      'Priority support',
      '10 GB storage',
      'AI content tools',
      'Custom domains',
    ],
    entitlements: ['ai_content', 'advanced_analytics', 'custom_domains', 'automation', 'newsletter'],
    limits: { maxSites: 10, storageBytes: 10 * GB, aiWords: 50_000, aiArticles: 50, automationRuns: 1000 },
    badgeVariant: 'pro',
    sortOrder: 1,
  },
  {
    planId: 'max',
    name: 'Max',
    priceMonthly: 99,
    priceYearly: 990,
    currency: 'CHF',
    interval: 'monthly',
    isFree: false,
    active: true,
    features: [
      'Unlimited sites',
      'Full analytics suite',
      '24/7 dedicated support',
      '100 GB storage',
      'AI content tools',
      'Custom domains',
      'API access',
      'White-label',
      'Audit log',
    ],
    entitlements: [
      'ai_content',
      'advanced_analytics',
      'custom_domains',
      'automation',
      'api_access',
      'white_label',
      'audit_log',
      'advanced_seo',
      'newsletter',
    ],
    limits: { maxSites: -1, storageBytes: 100 * GB, aiWords: 500_000, aiArticles: -1, automationRuns: 10_000 },
    badgeVariant: 'max',
    sortOrder: 2,
  },
];

// -------------------- Cache --------------------

let _cache: PlanConfigData[] = DEFAULT_PLAN_CONFIGS.map((p) => ({ ...p, features: [...p.features], entitlements: [...p.entitlements], limits: { ...p.limits } }));
let _hydrated = false;
let _hydrating: Promise<void> | null = null;
const _subscribers = new Set<() => void>();

function notify() {
  for (const cb of _subscribers) {
    try {
      cb();
    } catch {
      // ignore subscriber errors
    }
  }
}

/** Register a callback fired after every cache refresh (hydrate / mutation). */
export function subscribe(cb: () => void): () => void {
  _subscribers.add(cb);
  return () => _subscribers.delete(cb);
}

/** Synchronous access to the cached plan configs. Returns defaults before
 *  the first hydrate completes (the defaults match the seeded DB rows, so
 *  numbers are correct from the very first render). */
export function getPlanConfigsSync(): PlanConfigData[] {
  if (!_hydrated && !_hydrating) {
    void hydrate();
  }
  return _cache;
}

export function getPlanConfigSync(planId: string): PlanConfigData {
  return getPlanConfigsSync().find((p) => p.planId === planId) ?? getPlanConfigsSync()[0];
}

export function getActivePlanConfigsSync(): PlanConfigData[] {
  return getPlanConfigsSync().filter((p) => p.active);
}

/** Entitlement keys granted by a plan. */
export function getPlanEntitlements(planId: string): string[] {
  return getPlanConfigSync(planId).entitlements;
}

/** Usage limits for a plan. */
export function getPlanLimits(planId: string): PlanLimits {
  return getPlanConfigSync(planId).limits;
}

// -------------------- DB hydration + self-seed --------------------

function rowToData(row: {
  planId: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  interval: string;
  isFree: boolean;
  active: boolean;
  features: string;
  entitlements: string;
  limits: string;
  badgeVariant: string;
  sortOrder: number;
}): PlanConfigData {
  let features: string[] = [];
  let entitlements: string[] = [];
  let limits: PlanLimits = { maxSites: 0, storageBytes: 0, aiWords: 0, aiArticles: 0, automationRuns: 0 };
  try {
    features = JSON.parse(row.features || '[]');
  } catch {
    features = [];
  }
  try {
    entitlements = JSON.parse(row.entitlements || '[]');
  } catch {
    entitlements = [];
  }
  try {
    limits = { ...limits, ...(JSON.parse(row.limits || '{}') as Partial<PlanLimits>) };
  } catch {
    // keep defaults
  }
  return {
    planId: row.planId,
    name: row.name,
    priceMonthly: row.priceMonthly,
    priceYearly: row.priceYearly,
    currency: row.currency,
    interval: (row.interval === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly',
    isFree: row.isFree,
    active: row.active,
    features,
    entitlements,
    limits,
    badgeVariant: row.badgeVariant,
    sortOrder: row.sortOrder,
  };
}

function dataToRow(d: PlanConfigData) {
  return {
    planId: d.planId,
    name: d.name,
    priceMonthly: d.priceMonthly,
    priceYearly: d.priceYearly,
    currency: d.currency,
    interval: d.interval,
    isFree: d.isFree,
    active: d.active,
    features: JSON.stringify(d.features),
    entitlements: JSON.stringify(d.entitlements),
    limits: JSON.stringify(d.limits),
    badgeVariant: d.badgeVariant,
    sortOrder: d.sortOrder,
  };
}

/** Load all plan configs from the DB into the cache. Self-seeds the
 *  DEFAULT_PLAN_CONFIGS when the table is empty. Safe to call repeatedly. */
export async function hydrate(): Promise<void> {
  if (_hydrating) return _hydrating;
  _hydrating = (async () => {
    try {
      const rows = await db.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
      if (rows.length === 0) {
        // Self-seed so the platform is never without plans.
        await db.planConfig.createMany({ data: DEFAULT_PLAN_CONFIGS.map(dataToRow) });
        _cache = DEFAULT_PLAN_CONFIGS.map((p) => ({ ...p, features: [...p.features], entitlements: [...p.entitlements], limits: { ...p.limits } }));
      } else {
        _cache = rows.map(rowToData);
      }
      _hydrated = true;
      notify();
    } catch (err) {
      // DB unavailable — keep defaults (still functional, just not persisted).
      _hydrated = true;
      notify();
    } finally {
      _hydrating = null;
    }
  })();
  return _hydrating;
}

// -------------------- Mutations (admin) --------------------

export interface PlanConfigInput {
  name?: string;
  priceMonthly?: number;
  priceYearly?: number;
  currency?: string;
  interval?: 'monthly' | 'yearly';
  isFree?: boolean;
  active?: boolean;
  features?: string[];
  entitlements?: string[];
  limits?: Partial<PlanLimits>;
  badgeVariant?: string;
  sortOrder?: number;
}

/** Update an existing plan config. Writes DB, refreshes cache. */
export async function savePlanConfig(planId: string, patch: PlanConfigInput): Promise<PlanConfigData | null> {
  const existing = await db.planConfig.findUnique({ where: { planId } });
  if (!existing) return null;
  const current = rowToData(existing);
  const next: PlanConfigData = {
    planId: current.planId,
    name: patch.name ?? current.name,
    priceMonthly: patch.priceMonthly ?? current.priceMonthly,
    priceYearly: patch.priceYearly ?? current.priceYearly,
    currency: patch.currency ?? current.currency,
    interval: patch.interval ?? current.interval,
    isFree: patch.isFree ?? current.isFree,
    active: patch.active ?? current.active,
    features: patch.features ?? current.features,
    entitlements: patch.entitlements ?? current.entitlements,
    limits: { ...current.limits, ...(patch.limits ?? {}) },
    badgeVariant: patch.badgeVariant ?? current.badgeVariant,
    sortOrder: patch.sortOrder ?? current.sortOrder,
  };
  await db.planConfig.update({ where: { planId }, data: dataToRow(next) });
  await hydrate();
  return getPlanConfigSync(planId);
}

/** Create a new plan config. */
export async function createPlanConfig(input: PlanConfigInput & { planId: string; name: string }): Promise<PlanConfigData> {
  const maxOrder = await db.planConfig.count();
  const data: PlanConfigData = {
    planId: input.planId,
    name: input.name,
    priceMonthly: input.priceMonthly ?? 0,
    priceYearly: input.priceYearly ?? 0,
    currency: input.currency ?? 'CHF',
    interval: input.interval ?? 'monthly',
    isFree: input.isFree ?? false,
    active: input.active ?? true,
    features: input.features ?? [],
    entitlements: input.entitlements ?? [],
    limits: { maxSites: 0, storageBytes: 0, aiWords: 0, aiArticles: 0, automationRuns: 0, ...(input.limits ?? {}) },
    badgeVariant: input.badgeVariant ?? input.planId,
    sortOrder: input.sortOrder ?? maxOrder,
  };
  await db.planConfig.create({ data: dataToRow(data) });
  await hydrate();
  return data;
}

/** Delete a plan config (cannot delete the last plan). */
export async function deletePlanConfig(planId: string): Promise<boolean> {
  const count = await db.planConfig.count();
  if (count <= 1) return false;
  try {
    await db.planConfig.delete({ where: { planId } });
    await hydrate();
    return true;
  } catch {
    return false;
  }
}

/** Ensure the cache is hydrated. Called by the platform bootstrap. */
export async function ensureHydrated(): Promise<void> {
  if (!_hydrated) await hydrate();
}
