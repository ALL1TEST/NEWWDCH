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
// MULTI-CURRENCY: the plan carries ONE base price configuration —
// priceMonthly / priceYearly denominated in the plan's default /
// fallback `currency` (both edited directly in the Edit Plan modal).
// The customer's currency is resolved SERVER-SIDE from their IP
// geolocation (see country-pricing.ts:resolveCustomerPricing) when
// the plan's `autoCurrency` flag is on; otherwise every customer is
// billed in the plan default currency.
//
// pricesByCurrency is a DERIVED store (NOT edited per-plan in the
// modal): the default currency's entry mirrors the base price on
// every save, and the other entries hold the platform-level
// regional prices (CountryPricing.regionalPrices + legacy entries)
// — preserved across saves so customers in other currencies keep
// seeing their configured price (e.g. "90 MAD").
//
// STRIPE: for each paid plan × supported currency × interval, a real
// Stripe Price is created on sync and its ID persisted in
// stripePriceIdsByCurrency. The default currency's IDs are mirrored
// in stripePriceIdMonthly/Yearly for legacy callers. Checkout always
// resolves the per-currency Stripe Price ID server-side — the
// customer's currency determines which Price is charged.
//
// The cache is hydrated from the PlanConfig table on startup and
// after every mutation. If the table is empty on first hydrate, the
// DEFAULT configs are seeded.
// ============================================================

import { db } from '@/lib/db';
// Re-export the shared client-safe vocabulary so existing imports keep working.
export { ENTITLEMENT_KEYS, ENTITLEMENT_LABELS } from './feature-config';
export {
  aiModeOfEntitlements,
  AI_MODE_PLATFORM,
  AI_MODE_CLIENT,
  PLAN_EDITOR_FEATURE_KEYS,
  type AiMode,
} from './feature-config';
export type { EntitlementKey } from './feature-config';

import { PLAN_EDITOR_FEATURE_KEYS, aiModeOfEntitlements } from './feature-config';

/** The entitlement keys the Create/Edit Plan modal manages. Keys NOT in
 *  this set (e.g. 'audit_log') are preserved on merge — they are system
 *  entitlements outside the plan editor's Feature Access list. */
const PLAN_EDITOR_KEY_SET = new Set<string>([
  ...PLAN_EDITOR_FEATURE_KEYS,
  'ai_platform',
  'ai_client',
  'ai_content',
]);

// USAGE LIMITS — only resources the PLATFORM actually controls.
//   maxSites / storageBytes — platform infrastructure (Site, Media).
//   ai*PerMonth — Platform AI usage, enforced against the AiLog usage
//   tracker. AI usage is metered by GENERATIONS only (article + image
//   generations) — there is NO words/tokens limit. The limits apply
//   ONLY while the plan includes Platform AI ('ai_platform'): Client's
//   Own AI API-only plans and AI-disabled plans store 0 and are never
//   checked. (When both AI features are enabled the limits apply to
//   usage through Platform AI; the client's own API usage never
//   consumes them.)
//   Newsletter / Email Templates / Backups are FEATURE entitlements
//   only — no usage limits by design.
export interface PlanLimits {
  /** -1 = unlimited */
  maxSites: number;
  /** CMS/media storage (uploaded content). NOT backup storage. -1 = unlimited. */
  storageBytes: number;
  /** Platform AI article generations / month. -1 = unlimited. Only when Platform AI. */
  aiArticlesPerMonth: number;
  /** Platform AI image generations / month. -1 = unlimited. Only when Platform AI. */
  aiImagesPerMonth: number;
}

/** Default limits for plans that never configured them (incl. the
 *  AI keys — 0 = none allowed, only meaningful with Platform AI). */
const DEFAULT_LIMITS: PlanLimits = {
  maxSites: 0,
  storageBytes: 0,
  aiArticlesPerMonth: 0,
  aiImagesPerMonth: 0,
};

// -------------------- Entitlement normalization --------------------

/** Normalize a raw entitlement key list (DB row or API input):
 *  - legacy 'ai_content' → 'ai_platform' (it predates the two-key
 *    split and always meant the platform-provided AI).
 *  - Platform AI and Client's Own AI API are INDEPENDENT — both may
 *    be present (no mutual exclusion to enforce).
 *  - API Access is REMOVED as a feature: 'api_access' is a legacy
 *    removed key (like custom_domains / white_label) — Client's Own
 *    AI API already represents the client's own-provider/API access,
 *    so the duplicate key is STRIPPED on load + save. Old DB rows
 *    self-clean; stale API input never reaches the saved plan.
 *  - legacy 'custom_domains' / 'white_label' are STRIPPED: site
 *    domains and site branding are client-owned in this architecture
 *    (every site carries its own domain + identity), so they are not
 *    plan entitlements. Old DB rows self-clean on load + next save.
 *  - dedupes while preserving order.
 *  Non-editor keys (e.g. 'audit_log') pass through untouched. */
export function normalizeEntitlementKeys(keys: readonly string[]): string[] {
  // Legacy keys that are no longer plan entitlements — stripped on
  // load/save so existing rows + stale API input clean themselves.
  // 'api_access' joined them: Client's Own AI API already covers the
  // client's own-API connectivity, so a separate API Access feature
  // no longer exists anywhere (editor, cards, server checks).
  const LEGACY_REMOVED_KEYS = new Set(['custom_domains', 'white_label', 'api_access']);
  const out: string[] = [];
  const seen = new Set<string>();
  const hasPlatform = keys.includes('ai_platform') || keys.includes('ai_content');
  for (const k of keys) {
    if (typeof k !== 'string' || !k.trim()) continue;
    if (k === 'ai_content') continue; // legacy → replaced by ai_platform below
    if (LEGACY_REMOVED_KEYS.has(k)) continue; // not plan entitlements anymore
    if (k === 'ai_platform' && hasPlatform) {
      if (!seen.has('ai_platform')) out.push('ai_platform');
      seen.add('ai_platform');
      continue;
    }
    if (!seen.has(k)) {
      out.push(k);
      seen.add(k);
    }
  }
  // Insert the platform AI key at the position where the legacy key
  // (or an existing 'ai_platform') first appeared — append at the end
  // when neither was present in the ordered loop above (defensive).
  if (hasPlatform && !seen.has('ai_platform')) out.push('ai_platform');
  return out;
}

/** The AI mode a plan's normalized entitlements resolve to
 *  ('none' | 'platform' | 'client'). Re-exported from feature-config
 *  for server callers (single shared implementation). NOTE: the two AI
 *  keys are independent — 'platform' means Platform AI is enabled
 *  (possibly together with Client's Own AI API). */
export { aiModeOfEntitlements as aiModeOf };

/** Zero the Platform AI usage limits — used when the plan does NOT
 *  include Platform AI (Client's Own AI API only, or AI disabled): the
 *  AI limits are not configurable in that configuration, so they are
 *  not part of the saved plan. (When BOTH AI features are enabled the
 *  limits stay — Platform AI usage is limited; the client's own API
 *  usage never consumes them.) */
function zeroAiLimitsIfNotPlatform(limits: PlanLimits, entitlements: readonly string[]): PlanLimits {
  if (aiModeOfEntitlements(entitlements) === 'platform') return limits;
  return {
    ...limits,
    aiArticlesPerMonth: 0,
    aiImagesPerMonth: 0,
  };
}

/** Pick only the known limit fields from an untyped/partial input —
 *  unknown keys (stale `aiWords` / `aiWordsPerMonth` / `automationRuns`
 *  from older rows) never leak into the cache and are not re-serialized
 *  on save. `aiWordsPerMonth` was REMOVED as a plan limit (AI usage is
 *  metered by generations only): rows that still carry it self-clean on
 *  load and the next save strips it permanently. */
function pickLimits(parsed: unknown): PlanLimits {
  const p = (parsed ?? {}) as Partial<PlanLimits>;
  const num = (v: unknown): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
  return {
    maxSites: num(p.maxSites),
    storageBytes: num(p.storageBytes),
    aiArticlesPerMonth: num(p.aiArticlesPerMonth),
    aiImagesPerMonth: num(p.aiImagesPerMonth),
  };
}

export type BillingInterval = 'monthly' | 'yearly';

/** The billing periods enabled on a plan (at least one, enforced).
 *  A disabled period: not shown on the Client Billing page, rejected
 *  at checkout (400 BILLING_PERIOD_NOT_ENABLED), and never gets a
 *  Stripe Price created or selected. */
export function enabledIntervalsOf(plan: {
  billingMonthly: boolean;
  billingYearly: boolean;
}): BillingInterval[] {
  const out: BillingInterval[] = [];
  if (plan.billingMonthly) out.push('monthly');
  if (plan.billingYearly) out.push('yearly');
  return out;
}

/** Clamp a requested default cadence to an ENABLED period:
 *  only monthly on → 'monthly'; only yearly on → 'yearly'; both on
 *  → the requested value. (Neither enabled is rejected upstream —
 *  here it falls back to the requested value.) */
function normalizeInterval(
  requested: BillingInterval,
  billingMonthly: boolean,
  billingYearly: boolean,
): BillingInterval {
  if (billingMonthly && !billingYearly) return 'monthly';
  if (!billingMonthly && billingYearly) return 'yearly';
  return requested;
}

/** Per-currency price for a plan: monthly + yearly in MAJOR units
 *  (e.g. 49 = 49 USD). 0 = free for that interval. */
export interface CurrencyPrice {
  monthly: number;
  yearly: number;
}

/** Per-currency Stripe Price IDs: monthly + yearly. null = not yet wired. */
export interface CurrencyStripeIds {
  monthly: string | null;
  yearly: string | null;
}

/** Map of currency → { monthly, yearly } prices. */
export type PricesByCurrency = Record<string, CurrencyPrice>;

/** Map of currency → { monthly, yearly } Stripe Price IDs. */
export type StripePriceIdsByCurrency = Record<string, CurrencyStripeIds>;

export interface PlanConfigData {
  planId: string;
  name: string;
  /** Base monthly price (in the plan default currency) — edited in the
   *  Edit Plan modal. Authoritative for the default currency. */
  priceMonthly: number;
  /** Base yearly price (in the plan default currency). */
  priceYearly: number;
  /** Plan DEFAULT / FALLBACK currency (admin-selected via the
   *  country/currency selector in the Edit Plan modal). */
  currency: string;
  /** When true the customer's currency is auto-detected server-side from
   *  their IP (country → currency → supported check → fallback to
   *  `currency`). When false every customer is billed in `currency`. */
  autoCurrency: boolean;
  /** Derived per-currency price map — default entry mirrors the base
   *  price; other entries are platform regional prices (preserved). */
  pricesByCurrency: PricesByCurrency;
  /** Per-currency Stripe Price IDs (maintained by the Stripe sync). */
  stripePriceIdsByCurrency: StripePriceIdsByCurrency;
  /** ENABLED BILLING PERIODS — which checkout options exist for this
   *  plan. At least one must be true (enforced on create/update).
   *  Controls the Client Billing page, checkout validation, and the
   *  Stripe sync (a disabled period never creates/selects a Price). */
  billingMonthly: boolean;
  billingYearly: boolean;
  /** DERIVED default cadence — always an ENABLED period: 'monthly'
   *  when only monthly is enabled, 'yearly' when only yearly is
   *  enabled, and the admin's pick when both are enabled. Clients
   *  with both periods can switch between them. */
  interval: BillingInterval;
  isFree: boolean;
  /** null = unlimited free access; positive N = trial duration in days for free plans. */
  freePlanDurationDays: number | null;
  /** Snapshot Stripe Price IDs for the platform DEFAULT currency.
   *  Authoritative IDs live in `stripePriceIdsByCurrency`. */
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  active: boolean;
  /** Marketing copy — auto-derived from entitlements on the client side.
   *  Kept on the model for backward-compat but NOT a separate config. */
  features: string[];
  /** Authoritative feature keys granted by this plan (checked by hasFeature). */
  entitlements: string[];
  limits: PlanLimits;
  badgeVariant: string;
  sortOrder: number;
}

// -------------------- Defaults (also the seed) --------------------

const GB = 1024 * 1024 * 1024;

// Default multi-currency prices for each plan. The platform DEFAULT
// currency is CHF (CountryPricing seed: Switzerland/CH/isDefault=true).
// Each plan carries an explicit price for every supported currency so
// the same plan can be sold in MAD, USD, EUR, and CHF at independent
// price points. Free plans are 0 in every currency. Prices are in
// MAJOR units (49 = 49 USD), per Stripe's convention.
const PRICES_FREE: PricesByCurrency = {
  CHF: { monthly: 0, yearly: 0 },
  USD: { monthly: 0, yearly: 0 },
  EUR: { monthly: 0, yearly: 0 },
  MAD: { monthly: 0, yearly: 0 },
};
const PRICES_PLUS: PricesByCurrency = {
  CHF: { monthly: 9, yearly: 90 },
  USD: { monthly: 10, yearly: 100 },
  EUR: { monthly: 9, yearly: 90 },
  MAD: { monthly: 90, yearly: 900 },
};
const PRICES_PRO: PricesByCurrency = {
  CHF: { monthly: 49, yearly: 490 },
  USD: { monthly: 55, yearly: 550 },
  EUR: { monthly: 45, yearly: 450 },
  MAD: { monthly: 490, yearly: 4900 },
};
const PRICES_MAX: PricesByCurrency = {
  CHF: { monthly: 99, yearly: 990 },
  USD: { monthly: 109, yearly: 1090 },
  EUR: { monthly: 92, yearly: 920 },
  MAD: { monthly: 990, yearly: 9900 },
};

export const DEFAULT_PLAN_CONFIGS: PlanConfigData[] = [
  {
    planId: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'CHF',
    autoCurrency: true,
    pricesByCurrency: { ...PRICES_FREE },
    stripePriceIdsByCurrency: {},
    billingMonthly: true,
    billingYearly: true,
    interval: 'monthly',
    isFree: true,
    freePlanDurationDays: null, // unlimited
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    active: true,
    features: [], // derived from entitlements on the client side
    // FREE example: AI disabled, Newsletter / Email Templates / Backups
    // disabled, limited sites + storage. No AI limits (AI is off).
    entitlements: [],
    limits: { maxSites: 3, storageBytes: 1 * GB, aiArticlesPerMonth: 0, aiImagesPerMonth: 0 },
    badgeVariant: 'free',
    sortOrder: 0,
  },
  {
    planId: 'plus',
    name: 'Plus',
    priceMonthly: 9,
    priceYearly: 90,
    currency: 'CHF',
    autoCurrency: true,
    pricesByCurrency: { ...PRICES_PLUS },
    stripePriceIdsByCurrency: {},
    billingMonthly: true,
    billingYearly: true,
    interval: 'monthly',
    isFree: false,
    freePlanDurationDays: null,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    active: true,
    features: [],
    // Plus: Platform AI with modest usage limits.
    entitlements: ['ai_platform', 'advanced_analytics', 'comments', 'newsletter'],
    limits: { maxSites: 5, storageBytes: 5 * GB, aiArticlesPerMonth: 25, aiImagesPerMonth: 10 },
    badgeVariant: 'plus',
    sortOrder: 1,
  },
  {
    planId: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    priceYearly: 490,
    currency: 'CHF',
    autoCurrency: true,
    pricesByCurrency: { ...PRICES_PRO },
    stripePriceIdsByCurrency: {},
    billingMonthly: true,
    billingYearly: true,
    interval: 'monthly',
    isFree: false,
    freePlanDurationDays: null,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    active: true,
    features: [],
    // PRO example: Platform AI — 100 article generations + 50 image
    // generations per month — plus Comments, Newsletter, Email Templates
    // and Backups enabled. (No custom_domains / white_label: site
    // identity is client-owned, not a plan entitlement.)
    entitlements: ['ai_platform', 'advanced_analytics', 'automation', 'comments', 'newsletter', 'email_templates', 'backups'],
    limits: { maxSites: 10, storageBytes: 10 * GB, aiArticlesPerMonth: 100, aiImagesPerMonth: 50 },
    badgeVariant: 'pro',
    sortOrder: 2,
  },
  {
    planId: 'max',
    name: 'Max',
    priceMonthly: 99,
    priceYearly: 990,
    currency: 'CHF',
    autoCurrency: true,
    pricesByCurrency: { ...PRICES_MAX },
    stripePriceIdsByCurrency: {},
    billingMonthly: true,
    billingYearly: true,
    interval: 'monthly',
    isFree: false,
    freePlanDurationDays: null,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    active: true,
    features: [],
    // ENTERPRISE example: Client's Own AI API — the client connects
    // their own provider, so NO platform AI usage limits are stored.
    // All other platform features enabled. (Platform AI and Client's
    // Own AI API are independent — this example simply ships the
    // client-AI configuration; a plan MAY carry both AI keys.)
    entitlements: [
      'ai_client',
      'advanced_analytics',
      'automation',
      'comments',
      'audit_log',
      'advanced_seo',
      'newsletter',
      'email_templates',
      'backups',
    ],
    limits: { maxSites: -1, storageBytes: 100 * GB, aiArticlesPerMonth: 0, aiImagesPerMonth: 0 },
    badgeVariant: 'max',
    sortOrder: 3,
  },
];

// -------------------- Cache --------------------

/** Resolve the platform's default billing currency via a LAZY import of
 *  country-pricing (which itself imports `getPlanConfigSync` from here).
 *  The lazy `await import()` breaks the static circular dependency —
 *  this module never statically imports country-pricing, so both load.
 *  Falls back to 'CHF' (the schema default) if anything fails. */
async function resolvePlatformDefaultCurrency(): Promise<string> {
  try {
    const { getPlatformDefaultCurrency } = await import('./country-pricing');
    return await getPlatformDefaultCurrency();
  } catch {
    return 'CHF';
  }
}

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

/** Entitlement keys granted by a plan, NORMALIZED: legacy 'ai_content'
 *  is mapped to 'ai_platform', and when the plan has either AI
 *  feature ('ai_platform' OR 'ai_client') the legacy 'ai_content' key
 *  is ALSO included as a compatibility alias — so every existing
 *  `requireFeature(request, 'ai_content')` gate keeps passing for
 *  BOTH Platform AI and Client's Own AI API plans (general AI-tools
 *  access) with zero route changes. Source-specific checks use
 *  'ai_platform' / 'ai_client'. */
export function getPlanEntitlements(planId: string): string[] {
  const plan = getPlanConfigSync(planId);
  const base = plan.entitlements;
  if (base.includes('ai_platform') || base.includes('ai_client')) {
    return base.includes('ai_content') ? base : [...base, 'ai_content'];
  }
  return base;
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
  autoCurrency: boolean;
  pricesByCurrency: string;
  stripePriceIdsByCurrency: string;
  billingMonthly: boolean;
  billingYearly: boolean;
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
  // Explicitly pick only the known limit fields. Older DB rows may still
  // carry stale `aiWords` / `aiWordsPerMonth` / `automationRuns` keys in the
  // limits JSON (aiWordsPerMonth was removed — AI usage is metered by
  // generations only; those other keys never had real enforcement).
  // Picking only the known fields prevents the stale keys from leaking
  // back into the cache and being re-serialized on the next save.
  let limits: PlanLimits = { ...DEFAULT_LIMITS };
  try {
    limits = pickLimits(JSON.parse(row.limits || '{}'));
  } catch {
    // keep defaults
  }
  // AI usage limits only exist for Platform AI plans — normalize the
  // stored configuration to match the entitlement mode.
  limits = zeroAiLimitsIfNotPlatform(limits, entitlements);
  let pricesByCurrency: PricesByCurrency = {};
  try {
    const parsed = JSON.parse(row.pricesByCurrency || '{}') as Partial<PricesByCurrency>;
    if (parsed && typeof parsed === 'object') {
      for (const [cur, val] of Object.entries(parsed)) {
        if (val && typeof val === 'object') {
          const m = typeof (val as CurrencyPrice).monthly === 'number' ? (val as CurrencyPrice).monthly : 0;
          const y = typeof (val as CurrencyPrice).yearly === 'number' ? (val as CurrencyPrice).yearly : 0;
          pricesByCurrency[cur.toUpperCase()] = { monthly: m, yearly: y };
        }
      }
    }
  } catch {
    pricesByCurrency = {};
  }
  let stripePriceIdsByCurrency: StripePriceIdsByCurrency = {};
  try {
    const parsed = JSON.parse(row.stripePriceIdsByCurrency || '{}') as Partial<StripePriceIdsByCurrency>;
    if (parsed && typeof parsed === 'object') {
      for (const [cur, val] of Object.entries(parsed)) {
        if (val && typeof val === 'object') {
          const m = typeof (val as CurrencyStripeIds).monthly === 'string' ? (val as CurrencyStripeIds).monthly : null;
          const y = typeof (val as CurrencyStripeIds).yearly === 'string' ? (val as CurrencyStripeIds).yearly : null;
          stripePriceIdsByCurrency[cur.toUpperCase()] = { monthly: m, yearly: y };
        }
      }
    }
  } catch {
    stripePriceIdsByCurrency = {};
  }
  return {
    planId: row.planId,
    name: row.name,
    priceMonthly: row.priceMonthly,
    priceYearly: row.priceYearly,
    currency: row.currency,
    autoCurrency: row.autoCurrency ?? true,
    pricesByCurrency,
    stripePriceIdsByCurrency,
    billingMonthly: row.billingMonthly ?? true,
    billingYearly: row.billingYearly ?? true,
    // Normalize the default cadence to an ENABLED period (defensive:
    // legacy rows / stale values never advertise a disabled period).
    interval: normalizeInterval(
      (row.interval === 'yearly' ? 'yearly' : 'monthly') as BillingInterval,
      row.billingMonthly ?? true,
      row.billingYearly ?? true,
    ),
    isFree: row.isFree,
    freePlanDurationDays: row.freePlanDurationDays,
    stripePriceIdMonthly: row.stripePriceIdMonthly,
    stripePriceIdYearly: row.stripePriceIdYearly,
    active: row.active,
    features,
    // Normalize: legacy 'ai_content' → 'ai_platform'; the legacy
    // 'api_access' key is stripped (no separate API Access feature —
    // Client's Own AI API covers it); the two AI keys are independent
    // (both may be present).
    entitlements: normalizeEntitlementKeys(entitlements),
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
    autoCurrency: d.autoCurrency,
    pricesByCurrency: JSON.stringify(d.pricesByCurrency ?? {}),
    stripePriceIdsByCurrency: JSON.stringify(d.stripePriceIdsByCurrency ?? {}),
    billingMonthly: d.billingMonthly,
    billingYearly: d.billingYearly,
    interval: d.interval,
    isFree: d.isFree,
    freePlanDurationDays: d.freePlanDurationDays,
    stripePriceIdMonthly: d.stripePriceIdMonthly,
    stripePriceIdYearly: d.stripePriceIdYearly,
    active: d.active,
    features: JSON.stringify(d.features),
    entitlements: JSON.stringify(normalizeEntitlementKeys(d.entitlements)),
    limits: JSON.stringify(zeroAiLimitsIfNotPlatform(d.limits, d.entitlements)),
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
  /** Base monthly price in the plan default currency (modal-edited). */
  priceMonthly?: number;
  /** Base yearly price in the plan default currency (modal-edited). */
  priceYearly?: number;
  /** Plan default / fallback currency (admin-selected). When provided
   *  together with priceMonthly/priceYearly, the default currency's
   *  pricesByCurrency entry is DERIVED from the base price. */
  currency?: string;
  /** Auto-detect the customer's currency from their IP (fallback to
   *  `currency` when the detected currency is unsupported). */
  autoCurrency?: boolean;
  /** Per-currency prices. Rarely sent directly — the modal sends the
   *  base price + currency and the backend derives the default entry. */
  pricesByCurrency?: PricesByCurrency;
  /** Stripe Price ID snapshots for the default currency. */
  stripePriceIdMonthly?: string | null;
  stripePriceIdYearly?: string | null;
  /** Authoritative per-currency Stripe Price IDs: { USD: { monthly, yearly }, ... }. */
  stripePriceIdsByCurrency?: StripePriceIdsByCurrency;
  interval?: BillingInterval;
  /** Monthly billing available for this plan. */
  billingMonthly?: boolean;
  /** Yearly billing available for this plan. */
  billingYearly?: boolean;
  isFree?: boolean;
  freePlanDurationDays?: number | null;
  active?: boolean;
  /** Marketing copy. Auto-derived from entitlements when omitted. */
  features?: string[];
  entitlements?: string[];
  limits?: Partial<PlanLimits>;
  badgeVariant?: string;
  sortOrder?: number;
}

/** Merge a patch (Partial<PlanConfigData>) into the current data.
 *  The Edit Plan modal sends the ONE base price configuration
 *  (priceMonthly + priceYearly + currency + autoCurrency) — NOT a
 *  per-currency matrix. Derivation rules:
 *  - pricesByCurrency: starts from the current map (or the explicit
 *    patch map when provided); whenever the base price / currency is
 *    in the patch, the DEFAULT currency's entry is re-derived as
 *    { monthly: priceMonthly, yearly: priceYearly }. Other currency
 *    entries (platform regional / legacy prices) are PRESERVED.
 *  - stripePriceIdsByCurrency: kept as-is when omitted (the Stripe
 *    sync maintains it); the default-currency snapshots mirror the
 *    default entry.
 */
function mergePlanPatch(current: PlanConfigData, patch: PlanConfigInput, defaultCurrency: string): PlanConfigData {
  const curUpper = defaultCurrency.toUpperCase();

  // pricesByCurrency — clone (never mutate the cache's object in place).
  const sourcePrices = patch.pricesByCurrency ?? current.pricesByCurrency ?? {};
  const pricesByCurrency: PricesByCurrency = { ...sourcePrices };

  // Base price precedence:
  //   1. Explicit patch values (the modal always sends these).
  //   2. Legacy mirror: an explicit pricesByCurrency map with an entry
  //      for the final default currency (backward-compat callers).
  //   3. Current snapshot.
  const mirrored =
    patch.priceMonthly === undefined && patch.pricesByCurrency !== undefined
      ? pricesByCurrency[curUpper]
      : undefined;
  const priceMonthly =
    patch.priceMonthly !== undefined ? patch.priceMonthly : mirrored?.monthly ?? current.priceMonthly;
  const priceYearly =
    patch.priceYearly !== undefined ? patch.priceYearly : mirrored?.yearly ?? current.priceYearly;

  // The base price configuration was touched (or a legacy map was sent)
  // → re-derive the DEFAULT currency's entry from the base price. All
  // OTHER currency entries (platform regional / legacy prices) are
  // preserved untouched.
  const baseTouched =
    patch.priceMonthly !== undefined ||
    patch.priceYearly !== undefined ||
    patch.currency !== undefined ||
    patch.pricesByCurrency !== undefined;
  if (baseTouched) {
    pricesByCurrency[curUpper] = { monthly: priceMonthly, yearly: priceYearly };
  }

  const stripePriceIdsByCurrency: StripePriceIdsByCurrency = {
    ...(patch.stripePriceIdsByCurrency ?? current.stripePriceIdsByCurrency ?? {}),
  };
  // Default-currency snapshot — keep the legacy fields in sync so legacy
  // callers that read stripePriceIdMonthly/Yearly see the right values.
  const defIds = stripePriceIdsByCurrency[curUpper] ?? { monthly: null, yearly: null };
  const stripePriceIdMonthly =
    patch.stripePriceIdMonthly !== undefined
      ? patch.stripePriceIdMonthly
      : patch.stripePriceIdsByCurrency !== undefined
        ? defIds.monthly
        : current.stripePriceIdMonthly;
  const stripePriceIdYearly =
    patch.stripePriceIdYearly !== undefined
      ? patch.stripePriceIdYearly
      : patch.stripePriceIdsByCurrency !== undefined
        ? defIds.yearly
        : current.stripePriceIdYearly;
  const isFree = patch.isFree ?? current.isFree;
  // ---- Billing periods ----
  const billingMonthly = patch.billingMonthly ?? current.billingMonthly;
  const billingYearly = patch.billingYearly ?? current.billingYearly;
  // The default cadence must be an ENABLED period (single-period plans
  // are pinned to their only period; both-period plans keep the
  // admin's requested / current cadence).
  const interval = normalizeInterval(
    patch.interval ?? current.interval,
    billingMonthly,
    billingYearly,
  );
  return {
    planId: current.planId,
    name: patch.name ?? current.name,
    priceMonthly,
    priceYearly,
    currency: curUpper,
    autoCurrency: patch.autoCurrency ?? current.autoCurrency,
    pricesByCurrency,
    stripePriceIdsByCurrency,
    billingMonthly,
    billingYearly,
    interval,
    isFree,
    freePlanDurationDays: patch.freePlanDurationDays ?? current.freePlanDurationDays,
    stripePriceIdMonthly,
    stripePriceIdYearly,
    active: patch.active ?? current.active,
    features: patch.features ?? current.features,
    // Entitlements: the patch's editor-managed keys replace the current
    // ones, while NON-editor keys (e.g. 'audit_log') are PRESERVED from
    // the current plan — the Create/Edit Plan modal only manages the 9
    // Feature Access keys. Then normalize (legacy 'ai_content' →
    // 'ai_platform'; the removed 'api_access' key is stripped; the two
    // AI keys are independent).
    entitlements: normalizeEntitlementKeys(
      patch.entitlements !== undefined
        ? [
            ...patch.entitlements,
            ...current.entitlements.filter(
              (k) =>
                !patch.entitlements!.includes(k) &&
                k !== 'ai_content' &&
                // keys below are editor-managed (replaced by the patch):
                !PLAN_EDITOR_KEY_SET.has(k),
            ),
          ]
        : current.entitlements,
    ),
    // Limits: merge; the AI usage limits are only part of the saved
    // configuration while the plan includes Platform AI (zeroed
    // otherwise — Client's Own AI API usage is never limited).
    limits: zeroAiLimitsIfNotPlatform(
      pickLimits({ ...current.limits, ...(patch.limits ?? {}) }),
      patch.entitlements !== undefined
        ? normalizeEntitlementKeys(patch.entitlements)
        : current.entitlements,
    ),
    badgeVariant: patch.badgeVariant ?? current.badgeVariant,
    sortOrder: patch.sortOrder ?? current.sortOrder,
  };
}

/** Update an existing plan config. Writes DB, refreshes cache.
 *
 *  AUTO-SYNC TO STRIPE: when Stripe is configured AND the plan is
 *  PAID (any currency has a positive price) AND the admin did NOT
 *  explicitly set the Stripe Price IDs in this patch, the backend calls
 *  syncPlanToStripe (multi-currency) to ensure a Stripe Product +
 *  per-currency monthly+yearly Prices exist and writes the resolved IDs
 *  into stripePriceIdsByCurrency + the default-currency snapshot fields.
 */
export async function savePlanConfig(planId: string, patch: PlanConfigInput): Promise<PlanConfigData | null> {
  const existing = await db.planConfig.findUnique({ where: { planId } });
  if (!existing) return null;
  const current = rowToData(existing);

  // When the admin omitted currency, resolve the platform default so the
  // legacy priceMonthly/priceYearly snapshot stays in the right currency.
  if (!patch.currency && !current.currency) {
    patch = { ...patch, currency: await resolvePlatformDefaultCurrency() };
  }
  const finalCurrency = (patch.currency ?? current.currency).toUpperCase();

  // Distinguish "field omitted" from "field set". When the admin omits
  // both stripePriceId* AND stripePriceIdsByCurrency, they want the
  // backend to auto-sync. When either is explicitly provided, manual.
  const adminTouchedStripePriceIds =
    'stripePriceIdMonthly' in patch ||
    'stripePriceIdYearly' in patch ||
    'stripePriceIdsByCurrency' in patch;

  const next = mergePlanPatch(current, patch, finalCurrency);
  await db.planConfig.update({ where: { planId }, data: dataToRow(next) });
  await hydrate();

  // ---- AUTO-SYNC TO STRIPE (multi-currency) ----
  // Best-effort — never throws. Only ENABLED billing periods get
  // Stripe Prices (a disabled period never creates one).
  const hasAnyPaidCurrency = Object.values(next.pricesByCurrency).some(
    (p) =>
      (next.billingMonthly && p.monthly > 0) ||
      (next.billingYearly && p.yearly > 0),
  );
  if (!adminTouchedStripePriceIds && !next.isFree && hasAnyPaidCurrency) {
    try {
      const { isStripeConfiguredAsync, getStripeClient, syncPlanToStripeMulti } = await import('@/lib/stripe');
      if (await isStripeConfiguredAsync()) {
        const stripe = await getStripeClient();
        const syncResult = await syncPlanToStripeMulti(stripe, {
          planId: next.planId,
          name: next.name,
          defaultCurrency: finalCurrency,
          pricesByCurrency: next.pricesByCurrency,
          stripePriceIdsByCurrency: next.stripePriceIdsByCurrency,
          // Only the ENABLED billing periods get Stripe Prices.
          enabledIntervals: enabledIntervalsOf(next),
        });
        // Persist the resolved Stripe Price IDs back onto the row when they changed.
        const snapshot = syncResult.stripePriceIdsByCurrency[finalCurrency] ?? { monthly: null, yearly: null };
        const changed =
          JSON.stringify(syncResult.stripePriceIdsByCurrency) !==
            JSON.stringify(next.stripePriceIdsByCurrency) ||
          snapshot.monthly !== next.stripePriceIdMonthly ||
          snapshot.yearly !== next.stripePriceIdYearly;
        if (changed) {
          await db.planConfig.update({
            where: { planId },
            data: {
              stripePriceIdsByCurrency: JSON.stringify(syncResult.stripePriceIdsByCurrency),
              stripePriceIdMonthly: snapshot.monthly,
              stripePriceIdYearly: snapshot.yearly,
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

/** Create a new plan config. AUTO-SYNC TO STRIPE: when Stripe is
 *  configured AND the new plan is PAID AND the admin did NOT
 *  explicitly provide Stripe Price IDs in the input, the backend
 *  calls syncPlanToStripeMulti (multi-currency) to create a Stripe
 *  Product + per-currency monthly+yearly Prices and writes the
 *  resolved IDs back onto the new plan row.
 *
 *  The Create Plan modal sends the ONE base price configuration
 *  (priceMonthly + priceYearly + currency + autoCurrency); the default
 *  currency's pricesByCurrency entry is derived from the base price. */
export async function createPlanConfig(
  input: PlanConfigInput & { planId: string; name: string },
): Promise<PlanConfigData> {
  const maxOrder = await db.planConfig.count();
  const currency =
    input.currency && input.currency.trim().length > 0
      ? input.currency
      : await resolvePlatformDefaultCurrency();
  const curUpper = currency.toUpperCase();
  const pricesByCurrency: PricesByCurrency = { ...(input.pricesByCurrency ?? {}) };
  // Base price precedence: explicit input → legacy mirror from an
  // explicit pricesByCurrency map → 0.
  const mirrored = input.pricesByCurrency ? pricesByCurrency[curUpper] : undefined;
  const priceMonthly = input.priceMonthly ?? mirrored?.monthly ?? 0;
  const priceYearly = input.priceYearly ?? mirrored?.yearly ?? 0;
  // Derive the default currency entry from the base price.
  pricesByCurrency[curUpper] = { monthly: priceMonthly, yearly: priceYearly };
  const stripePriceIdsByCurrency: StripePriceIdsByCurrency = input.stripePriceIdsByCurrency ?? {};
  const defIds = stripePriceIdsByCurrency[curUpper] ?? { monthly: null, yearly: null };
  const billingMonthly = input.billingMonthly ?? true;
  const billingYearly = input.billingYearly ?? true;
  const data: PlanConfigData = {
    planId: input.planId,
    name: input.name,
    priceMonthly,
    priceYearly,
    currency: curUpper,
    autoCurrency: input.autoCurrency ?? true,
    pricesByCurrency,
    stripePriceIdsByCurrency,
    billingMonthly,
    billingYearly,
    interval: normalizeInterval(input.interval ?? 'monthly', billingMonthly, billingYearly),
    isFree: input.isFree ?? false,
    freePlanDurationDays: input.freePlanDurationDays ?? null,
    stripePriceIdMonthly: input.stripePriceIdMonthly !== undefined ? input.stripePriceIdMonthly : defIds.monthly,
    stripePriceIdYearly: input.stripePriceIdYearly !== undefined ? input.stripePriceIdYearly : defIds.yearly,
    active: input.active ?? true,
    features: input.features ?? [],
    entitlements: normalizeEntitlementKeys(input.entitlements ?? []),
    limits: zeroAiLimitsIfNotPlatform(
      pickLimits({ ...DEFAULT_LIMITS, ...(input.limits ?? {}) }),
      normalizeEntitlementKeys(input.entitlements ?? []),
    ),
    badgeVariant: input.badgeVariant ?? input.planId,
    sortOrder: input.sortOrder ?? maxOrder,
  };
  await db.planConfig.create({ data: dataToRow(data) });
  await hydrate();

  // ---- AUTO-SYNC TO STRIPE (multi-currency) ----
  // Best-effort — never throws. The plan row is already created; if
  // the Stripe side fails, the admin can use the explicit "Sync to
  // Stripe" route to surface errors.
  const adminTouchedStripePriceIds =
    'stripePriceIdMonthly' in input ||
    'stripePriceIdYearly' in input ||
    'stripePriceIdsByCurrency' in input;
  const hasAnyPaidCurrency = Object.values(data.pricesByCurrency).some(
    (p) =>
      (data.billingMonthly && p.monthly > 0) ||
      (data.billingYearly && p.yearly > 0),
  );
  if (!adminTouchedStripePriceIds && !data.isFree && hasAnyPaidCurrency) {
    try {
      const { isStripeConfiguredAsync, getStripeClient, syncPlanToStripeMulti } = await import('@/lib/stripe');
      if (await isStripeConfiguredAsync()) {
        const stripe = await getStripeClient();
        const syncResult = await syncPlanToStripeMulti(stripe, {
          planId: data.planId,
          name: data.name,
          defaultCurrency: curUpper,
          pricesByCurrency: data.pricesByCurrency,
          stripePriceIdsByCurrency: data.stripePriceIdsByCurrency,
          // Only the ENABLED billing periods get Stripe Prices.
          enabledIntervals: enabledIntervalsOf(data),
        });
        const snapshot = syncResult.stripePriceIdsByCurrency[curUpper] ?? { monthly: null, yearly: null };
        const changed =
          JSON.stringify(syncResult.stripePriceIdsByCurrency) !==
            JSON.stringify(data.stripePriceIdsByCurrency) ||
          snapshot.monthly !== data.stripePriceIdMonthly ||
          snapshot.yearly !== data.stripePriceIdYearly;
        if (changed) {
          await db.planConfig.update({
            where: { planId: data.planId },
            data: {
              stripePriceIdsByCurrency: JSON.stringify(syncResult.stripePriceIdsByCurrency),
              stripePriceIdMonthly: snapshot.monthly,
              stripePriceIdYearly: snapshot.yearly,
            },
          });
          await hydrate();
          data.stripePriceIdsByCurrency = syncResult.stripePriceIdsByCurrency;
          data.stripePriceIdMonthly = snapshot.monthly;
          data.stripePriceIdYearly = snapshot.yearly;
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
