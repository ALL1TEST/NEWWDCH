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
// configs are seeded so the platform is never without plans. If the
// table contains the LEGACY catalog (Beta/Pro/Max/Enterprise), the
// migration runs automatically: Enterprise is removed (only when no
// active subscription references it), Beta is renamed to Plus, and a
// Free plan is inserted at sortOrder 0.
//
// Final canonical catalog:
//   1. Free  (planId='free',  isFree=true,  priceMonthly=0)
//   2. Plus  (planId='plus',  isFree=false, priceMonthly=0 or 9)
//   3. Pro   (planId='pro',   priceMonthly=49)
//   4. Max   (planId='max',   priceMonthly=99)
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

export type BillingInterval = 'monthly' | 'yearly';

export interface PlanConfigData {
  planId: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  /** Default cadence; the client can pick monthly/yearly per subscription. */
  interval: BillingInterval;
  isFree: boolean;
  /** null = unlimited free access; positive N = trial duration in days for free plans. */
  freePlanDurationDays: number | null;
  /** Stripe Price IDs. null = Stripe not yet wired; checkout will refuse to fake success. */
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
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
    planId: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'CHF',
    interval: 'monthly',
    isFree: true,
    freePlanDurationDays: null, // unlimited
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    active: true,
    features: ['Up to 3 sites', 'Basic analytics', 'Community support', '1 GB storage'],
    entitlements: [],
    limits: { maxSites: 3, storageBytes: 1 * GB, aiWords: 0, aiArticles: 0, automationRuns: 0 },
    badgeVariant: 'free',
    sortOrder: 0,
  },
  {
    planId: 'plus',
    name: 'Plus',
    priceMonthly: 9,
    priceYearly: 90,
    currency: 'CHF',
    interval: 'monthly',
    isFree: false,
    freePlanDurationDays: null,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    active: true,
    features: [
      'Up to 5 sites',
      'Advanced analytics',
      'Email support',
      '5 GB storage',
      'AI content tools',
    ],
    entitlements: ['ai_content', 'advanced_analytics', 'newsletter'],
    limits: { maxSites: 5, storageBytes: 5 * GB, aiWords: 20_000, aiArticles: 20, automationRuns: 200 },
    badgeVariant: 'plus',
    sortOrder: 1,
  },
  {
    planId: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    priceYearly: 490,
    currency: 'CHF',
    interval: 'monthly',
    isFree: false,
    freePlanDurationDays: null,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
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
    sortOrder: 2,
  },
  {
    planId: 'max',
    name: 'Max',
    priceMonthly: 99,
    priceYearly: 990,
    currency: 'CHF',
    interval: 'monthly',
    isFree: false,
    freePlanDurationDays: null,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
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
    sortOrder: 3,
  },
];

// -------------------- Cache --------------------

let _cache: PlanConfigData[] = DEFAULT_PLAN_CONFIGS.map((p) => ({
  ...p,
  features: [...p.features],
  entitlements: [...p.entitlements],
  limits: { ...p.limits },
}));
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
  const list = getPlanConfigsSync();
  return list.find((p) => p.planId === planId) ?? list[0];
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

// -------------------- DB hydration + self-seed + legacy migration --------------------

type PlanConfigRow = {
  id: string;
  planId: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  interval: string;
  isFree: boolean;
  freePlanDurationDays: number | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  active: boolean;
  features: string;
  entitlements: string;
  limits: string;
  badgeVariant: string;
  sortOrder: number;
};

function rowToData(row: PlanConfigRow): PlanConfigData {
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
    interval: (row.interval === 'yearly' ? 'yearly' : 'monthly') as BillingInterval,
    isFree: row.isFree,
    freePlanDurationDays: row.freePlanDurationDays,
    stripePriceIdMonthly: row.stripePriceIdMonthly,
    stripePriceIdYearly: row.stripePriceIdYearly,
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
    freePlanDurationDays: d.freePlanDurationDays,
    stripePriceIdMonthly: d.stripePriceIdMonthly,
    stripePriceIdYearly: d.stripePriceIdYearly,
    active: d.active,
    features: JSON.stringify(d.features),
    entitlements: JSON.stringify(d.entitlements),
    limits: JSON.stringify(d.limits),
    badgeVariant: d.badgeVariant,
    sortOrder: d.sortOrder,
  };
}

/**
 * Migrate the legacy catalog to the new Free/Plus/Pro/Max shape. Idempotent.
 *
 * Legacy catalog (created by older bootstrap):
 *   beta (free, active=false), pro, max, enterprise (stub)
 *
 * Migration steps (each guarded, can be re-run safely):
 *  1. If `enterprise` exists AND no active subscription references it → delete it.
 *     (Active subs that reference enterprise are preserved — the migration will
 *      not break them; the plan row stays if needed. In practice, the demo
 *      dataset has no DB subscriptions yet, so this is a clean delete.)
 *  2. If `beta` exists → rename to `plus` (planId, name, badgeVariant) and
 *     re-enable it (legacy `beta` was active=false in the demo DB). Also
 *     shift sortOrder to 1 (Free takes 0).
 *  3. If `free` does NOT exist → insert the Free plan at sortOrder 0.
 *  4. Renumber sortOrder to match the canonical order: free=0, plus=1, pro=2, max=3.
 *
 * Returns a short report string for the bootstrap log.
 */
export async function migrateLegacyPlans(): Promise<string> {
  const notes: string[] = [];

  try {
    // Step 1: delete Enterprise if safe
    const enterprise = await db.planConfig.findUnique({ where: { planId: 'enterprise' } });
    if (enterprise) {
      const subCount = await db.subscription.count({ where: { planId: 'enterprise' } });
      if (subCount === 0) {
        await db.planConfig.delete({ where: { planId: 'enterprise' } });
        notes.push('deleted enterprise plan (0 active subscriptions)');
      } else {
        notes.push(`kept enterprise plan (${subCount} active subscriptions reference it)`);
      }
    }

    // Step 2: rename beta → plus (and refresh to a real paid tier)
    const beta = await db.planConfig.findUnique({ where: { planId: 'beta' } });
    if (beta) {
      // Don't overwrite an existing plus row — if both exist, prefer the
      // plus row and just delete the beta stub.
      const plus = await db.planConfig.findUnique({ where: { planId: 'plus' } });
      if (!plus) {
        // Rename beta → plus AND refresh the data to the real DEFAULT
        // Plus tier (paid plan with real entitlements + limits, not the
        // legacy free-tier Beta stub). The old Beta was active=false and
        // had no real customers, so this is a safe refresh.
        const plusDefault = DEFAULT_PLAN_CONFIGS.find((p) => p.planId === 'plus')!;
        await db.planConfig.update({
          where: { planId: 'beta' },
          data: {
            ...dataToRow(plusDefault),
            // Keep the original createdAt for continuity.
            // (updatedAt is auto.)
          },
        });
        notes.push('renamed + refreshed beta → plus (real paid tier)');
      } else {
        // Both beta and plus exist — delete the beta stub (migrate any
        // legacy subscriptions on beta to plus first).
        const betaSubs = await db.subscription.count({ where: { planId: 'beta' } });
        if (betaSubs > 0) {
          await db.subscription.updateMany({ where: { planId: 'beta' }, data: { planId: 'plus' } });
          notes.push(`migrated ${betaSubs} beta subscription(s) → plus`);
        }
        await db.planConfig.delete({ where: { planId: 'beta' } });
        notes.push('deleted legacy beta stub (plus already exists)');
      }
    }

    // Step 3: insert Free if missing
    const free = await db.planConfig.findUnique({ where: { planId: 'free' } });
    if (!free) {
      const freeDefault = DEFAULT_PLAN_CONFIGS.find((p) => p.planId === 'free')!;
      await db.planConfig.create({ data: dataToRow(freeDefault) });
      notes.push('inserted free plan');
    } else {
      // Ensure free plan is properly flagged
      if (!free.isFree || free.badgeVariant !== 'free' || free.sortOrder !== 0) {
        await db.planConfig.update({
          where: { planId: 'free' },
          data: { isFree: true, badgeVariant: 'free', sortOrder: 0 },
        });
        notes.push('normalized free plan flags');
      }
    }

    // Step 4: normalize sortOrder for all canonical plans
    const canonicalOrder: Record<string, number> = { free: 0, plus: 1, pro: 2, max: 3 };
    for (const [pid, order] of Object.entries(canonicalOrder)) {
      const row = await db.planConfig.findUnique({ where: { planId: pid } });
      if (row && row.sortOrder !== order) {
        await db.planConfig.update({ where: { planId: pid }, data: { sortOrder: order } });
      }
    }

    // Also migrate legacy subscriptions on 'beta' or 'enterprise' planId
    // to the new ids (beta → plus, enterprise → max) so historical subs
    // don't reference a missing plan.
    const legacyBetaSubs = await db.subscription.count({ where: { planId: 'beta' } });
    if (legacyBetaSubs > 0) {
      await db.subscription.updateMany({ where: { planId: 'beta' }, data: { planId: 'plus' } });
      notes.push(`migrated ${legacyBetaSubs} legacy beta subscription(s) → plus`);
    }
    const legacyEnterpriseSubs = await db.subscription.count({ where: { planId: 'enterprise' } });
    if (legacyEnterpriseSubs > 0) {
      await db.subscription.updateMany({ where: { planId: 'enterprise' }, data: { planId: 'max' } });
      notes.push(`migrated ${legacyEnterpriseSubs} legacy enterprise subscription(s) → max`);
    }
  } catch (err) {
    notes.push(`migration error (non-fatal): ${(err as Error).message}`);
  }

  return notes.length > 0 ? notes.join('; ') : 'no migration needed';
}

/** Load all plan configs from the DB into the cache. Self-seeds the
 *  DEFAULT_PLAN_CONFIGS when the table is empty. Runs the legacy
 *  migration when the catalog still contains 'beta' or 'enterprise'.
 *  Safe to call repeatedly. */
export async function hydrate(): Promise<void> {
  if (_hydrating) return _hydrating;
  _hydrating = (async () => {
    try {
      const rows = await db.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
      if (rows.length === 0) {
        // Self-seed so the platform is never without plans.
        await db.planConfig.createMany({ data: DEFAULT_PLAN_CONFIGS.map(dataToRow) });
        _cache = DEFAULT_PLAN_CONFIGS.map((p) => ({
          ...p,
          features: [...p.features],
          entitlements: [...p.entitlements],
          limits: { ...p.limits },
        }));
      } else {
        // Check for legacy catalog (beta / enterprise) and migrate.
        const hasLegacy =
          rows.some((r) => r.planId === 'beta' || r.planId === 'enterprise') ||
          !rows.some((r) => r.planId === 'free');
        if (hasLegacy) {
          await migrateLegacyPlans();
          const migratedRows = await db.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
          _cache = migratedRows.map(rowToData);
        } else {
          _cache = rows.map(rowToData);
        }
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
  interval?: BillingInterval;
  isFree?: boolean;
  freePlanDurationDays?: number | null;
  stripePriceIdMonthly?: string | null;
  stripePriceIdYearly?: string | null;
  active?: boolean;
  features?: string[];
  entitlements?: string[];
  limits?: Partial<PlanLimits>;
  badgeVariant?: string;
  sortOrder?: number;
}

/** Update an existing plan config. Writes DB, refreshes cache.
 *
 *  AUTO-SYNC TO STRIPE: when Stripe is configured AND the plan is
 *  PAID (priceMonthly > 0 OR priceYearly > 0) AND the admin did NOT
 *  explicitly set the Stripe Price IDs in this patch (i.e. the field
 *  is omitted from `patch`), the backend calls syncPlanToStripe to
 *  ensure a Stripe Product + monthly + yearly Prices exist and writes
 *  the resolved Stripe Price IDs back onto the row. This means the
 *  admin can edit a paid plan's name / features / limits and the
 *  Stripe side stays in sync without manually wiring price IDs.
 *
 *  When the admin explicitly sets `stripePriceIdMonthly` / `stripePriceIdYearly`
 *  (even to null = "clear"), the auto-sync is skipped — the admin is
 *  taking manual control of the Stripe side. They can use the dedicated
 *  "Sync to Stripe" route (/api/platform/admin/plans/[planId]/sync-stripe)
 *  to push the local plan to Stripe at any time. */
export async function savePlanConfig(planId: string, patch: PlanConfigInput): Promise<PlanConfigData | null> {
  const existing = await db.planConfig.findUnique({ where: { planId } });
  if (!existing) return null;
  const current = rowToData(existing);

  // Distinguish "field omitted" from "field set to null". When the
  // admin omits both stripePriceId* fields, they want the backend to
  // keep them in sync with Stripe automatically (see AUTO-SYNC above).
  // When either is explicitly provided (including null to clear),
  // the admin is taking manual control.
  const adminTouchedStripePriceIds =
    'stripePriceIdMonthly' in patch || 'stripePriceIdYearly' in patch;

  const next: PlanConfigData = {
    planId: current.planId,
    name: patch.name ?? current.name,
    priceMonthly: patch.priceMonthly ?? current.priceMonthly,
    priceYearly: patch.priceYearly ?? current.priceYearly,
    currency: patch.currency ?? current.currency,
    interval: patch.interval ?? current.interval,
    isFree: patch.isFree ?? current.isFree,
    freePlanDurationDays: patch.freePlanDurationDays ?? current.freePlanDurationDays,
    stripePriceIdMonthly: patch.stripePriceIdMonthly ?? current.stripePriceIdMonthly,
    stripePriceIdYearly: patch.stripePriceIdYearly ?? current.stripePriceIdYearly,
    active: patch.active ?? current.active,
    features: patch.features ?? current.features,
    entitlements: patch.entitlements ?? current.entitlements,
    limits: { ...current.limits, ...(patch.limits ?? {}) },
    badgeVariant: patch.badgeVariant ?? current.badgeVariant,
    sortOrder: patch.sortOrder ?? current.sortOrder,
  };
  await db.planConfig.update({ where: { planId }, data: dataToRow(next) });
  await hydrate();

  // ---- AUTO-SYNC TO STRIPE ----
  // Best-effort — never throws. Swallows Stripe errors so an admin
  // edit doesn't fail just because Stripe is unreachable. The admin
  // can use the explicit "Sync to Stripe" route to surface errors.
  if (!adminTouchedStripePriceIds && !next.isFree && (next.priceMonthly > 0 || next.priceYearly > 0)) {
    try {
      const { isStripeConfiguredAsync, getStripeClient, syncPlanToStripe } = await import('@/lib/stripe');
      if (await isStripeConfiguredAsync()) {
        const stripe = await getStripeClient();
        const syncResult = await syncPlanToStripe(stripe, {
          planId: next.planId,
          name: next.name,
          priceMonthly: next.priceMonthly,
          priceYearly: next.priceYearly,
          currency: next.currency,
          stripePriceIdMonthly: next.stripePriceIdMonthly,
          stripePriceIdYearly: next.stripePriceIdYearly,
        });
        // Persist the resolved Stripe Price IDs back onto the row
        // (only when they changed — otherwise the update is a no-op).
        if (
          syncResult.stripePriceIdMonthly !== next.stripePriceIdMonthly ||
          syncResult.stripePriceIdYearly !== next.stripePriceIdYearly
        ) {
          await db.planConfig.update({
            where: { planId },
            data: {
              stripePriceIdMonthly: syncResult.stripePriceIdMonthly,
              stripePriceIdYearly: syncResult.stripePriceIdYearly,
            },
          });
          await hydrate();
        }
      }
    } catch {
      // best-effort — never block the save on a Stripe error
    }
  }

  return getPlanConfigSync(planId);
}

/** Create a new plan config.
 *
 *  AUTO-SYNC TO STRIPE: when Stripe is configured AND the new plan
 *  is PAID (priceMonthly > 0 OR priceYearly > 0) AND the admin did
 *  NOT explicitly provide Stripe Price IDs in the input, the backend
 *  calls syncPlanToStripe to create a Stripe Product + monthly +
 *  yearly Prices and writes the resolved Stripe Price IDs back onto
 *  the new plan row. So creating a new paid plan in Platform Admin
 *  automatically creates the corresponding Stripe Product + Prices —
 *  no need to manually wire Stripe Price IDs in the Stripe dashboard.
 *
 *  When the admin explicitly provides Stripe Price IDs (manually
 *  created in the Stripe dashboard), the auto-sync is skipped — the
 *  admin is asserting the Stripe side is already wired. */
export async function createPlanConfig(
  input: PlanConfigInput & { planId: string; name: string },
): Promise<PlanConfigData> {
  const maxOrder = await db.planConfig.count();
  const data: PlanConfigData = {
    planId: input.planId,
    name: input.name,
    priceMonthly: input.priceMonthly ?? 0,
    priceYearly: input.priceYearly ?? 0,
    currency: input.currency ?? 'CHF',
    interval: input.interval ?? 'monthly',
    isFree: input.isFree ?? false,
    freePlanDurationDays: input.freePlanDurationDays ?? null,
    stripePriceIdMonthly: input.stripePriceIdMonthly ?? null,
    stripePriceIdYearly: input.stripePriceIdYearly ?? null,
    active: input.active ?? true,
    features: input.features ?? [],
    entitlements: input.entitlements ?? [],
    limits: {
      maxSites: 0,
      storageBytes: 0,
      aiWords: 0,
      aiArticles: 0,
      automationRuns: 0,
      ...(input.limits ?? {}),
    },
    badgeVariant: input.badgeVariant ?? input.planId,
    sortOrder: input.sortOrder ?? maxOrder,
  };
  await db.planConfig.create({ data: dataToRow(data) });
  await hydrate();

  // ---- AUTO-SYNC TO STRIPE ----
  // Best-effort — never throws. The plan row is already created; if
  // the Stripe side fails, the admin can use the explicit "Sync to
  // Stripe" route to surface errors.
  const adminTouchedStripePriceIds =
    'stripePriceIdMonthly' in input || 'stripePriceIdYearly' in input;
  if (
    !adminTouchedStripePriceIds &&
    !data.isFree &&
    (data.priceMonthly > 0 || data.priceYearly > 0)
  ) {
    try {
      const { isStripeConfiguredAsync, getStripeClient, syncPlanToStripe } = await import('@/lib/stripe');
      if (await isStripeConfiguredAsync()) {
        const stripe = await getStripeClient();
        const syncResult = await syncPlanToStripe(stripe, {
          planId: data.planId,
          name: data.name,
          priceMonthly: data.priceMonthly,
          priceYearly: data.priceYearly,
          currency: data.currency,
          stripePriceIdMonthly: data.stripePriceIdMonthly,
          stripePriceIdYearly: data.stripePriceIdYearly,
        });
        if (
          syncResult.stripePriceIdMonthly !== data.stripePriceIdMonthly ||
          syncResult.stripePriceIdYearly !== data.stripePriceIdYearly
        ) {
          await db.planConfig.update({
            where: { planId: data.planId },
            data: {
              stripePriceIdMonthly: syncResult.stripePriceIdMonthly,
              stripePriceIdYearly: syncResult.stripePriceIdYearly,
            },
          });
          await hydrate();
          data.stripePriceIdMonthly = syncResult.stripePriceIdMonthly;
          data.stripePriceIdYearly = syncResult.stripePriceIdYearly;
        }
      }
    } catch {
      // best-effort — never block the create on a Stripe error
    }
  }

  return data;
}

/**
 * Delete a plan config. Refuses if:
 *  - it's the last remaining plan, OR
 *  - any Subscription still references this planId (would orphan the sub).
 *
 * Returns `{ ok: boolean, reason?: string }` describing the outcome.
 */
export async function deletePlanConfig(
  planId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const count = await db.planConfig.count();
  if (count <= 1) return { ok: false, reason: 'Cannot delete the last plan.' };
  const subCount = await db.subscription.count({ where: { planId } });
  if (subCount > 0) {
    return {
      ok: false,
      reason: `Cannot delete plan "${planId}" — ${subCount} active subscription(s) reference it. Migrate them first.`,
    };
  }
  try {
    await db.planConfig.delete({ where: { planId } });
    await hydrate();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Ensure the cache is hydrated. Called by the platform bootstrap. */
export async function ensureHydrated(): Promise<void> {
  if (!_hydrated) await hydrate();
}
