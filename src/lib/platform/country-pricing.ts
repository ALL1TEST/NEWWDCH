// ============================================================
// COUNTRY / CURRENCY / REGIONAL PRICING — server-determined.
// ============================================================
// IP geolocation is the initial detection; the SERVER determines the
// final applicable price + currency from the plan config + the
// CountryPricing table. The client cannot change currency in the
// frontend to obtain a different price.
//
// AUTO CURRENCY RESOLUTION (per plan):
//   1. When the plan's autoCurrency flag is OFF → every customer is
//      billed in the plan's default currency at the base price.
//   2. When ON → the customer's country is detected from their IP,
//      mapped to a currency (CountryPricing row first, then the
//      shared currency catalog), and the plan price for that currency
//      is resolved:
//        a. the plan's BASE price when the detected currency IS the
//           plan default currency;
//        b. the country's regional price (CountryPricing.regionalPrices
//           [planId]) when the platform configured one;
//        c. the plan's per-currency entry (pricesByCurrency) when
//           present (legacy / platform regional data);
//        d. otherwise the currency is NOT SUPPORTED for this plan →
//           FALL BACK to the plan default currency + base price.
//   3. Billing interval (monthly / yearly) is orthogonal — the
//      resolved { monthly, yearly } pair is interval-agnostic.
//
// resolveCustomerPricing(request, planId) is the SINGLE entry point
// used by /api/billing/checkout + /api/platform/billing/me. The
// customer NEVER sends a currency hint — the server's resolution is
// authoritative.
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getPlanConfigSync, type PlanConfigData } from './plan-config';
import { countryToCurrency, findCountryEntry } from './currency-catalog';

export interface CountryPricingRow {
  id: string;
  countryCode: string;
  countryName: string;
  currency: string;
  isDefault: boolean;
  regionalPrices: Record<string, { monthly: number; yearly: number }>;
  active: boolean;
}

const DEFAULT_COUNTRIES: CountryPricingRow[] = [
  {
    id: 'seed-ch',
    countryCode: 'CH',
    countryName: 'Switzerland',
    currency: 'CHF',
    isDefault: true,
    regionalPrices: {},
    active: true,
  },
  {
    id: 'seed-us',
    countryCode: 'US',
    countryName: 'United States',
    currency: 'USD',
    isDefault: false,
    regionalPrices: { pro: { monthly: 55, yearly: 550 }, max: { monthly: 109, yearly: 1090 } },
    active: true,
  },
  {
    id: 'seed-eu',
    countryCode: 'EU',
    countryName: 'European Union',
    currency: 'EUR',
    isDefault: false,
    regionalPrices: { pro: { monthly: 45, yearly: 450 }, max: { monthly: 92, yearly: 920 } },
    active: true,
  },
  {
    id: 'seed-ma',
    countryCode: 'MA',
    countryName: 'Morocco',
    currency: 'MAD',
    isDefault: false,
    regionalPrices: { pro: { monthly: 490, yearly: 4900 }, max: { monthly: 990, yearly: 9900 } },
    active: true,
  },
];

function rowToData(r: {
  id: string;
  countryCode: string;
  countryName: string;
  currency: string;
  isDefault: boolean;
  regionalPrices: string;
  active: boolean;
}): CountryPricingRow {
  let regionalPrices: Record<string, { monthly: number; yearly: number }> = {};
  try {
    regionalPrices = JSON.parse(r.regionalPrices || '{}');
  } catch {
    regionalPrices = {};
  }
  return {
    id: r.id,
    countryCode: r.countryCode,
    countryName: r.countryName,
    currency: r.currency,
    isDefault: r.isDefault,
    regionalPrices,
    active: r.active,
  };
}

let _hydrated = false;

async function ensureSeeded(): Promise<void> {
  if (_hydrated) return;
  try {
    const count = await db.countryPricing.count();
    if (count === 0) {
      await db.countryPricing.createMany({
        data: DEFAULT_COUNTRIES.map((c) => ({
          countryCode: c.countryCode,
          countryName: c.countryName,
          currency: c.currency,
          isDefault: c.isDefault,
          regionalPrices: JSON.stringify(c.regionalPrices),
          active: c.active,
        })),
      });
    }
    _hydrated = true;
  } catch {
    _hydrated = true;
  }
}

export async function listCountries(): Promise<CountryPricingRow[]> {
  await ensureSeeded();
  const rows = await db.countryPricing.findMany({ orderBy: { countryName: 'asc' } });
  return rows.map(rowToData);
}

export async function getDefaultCountry(): Promise<CountryPricingRow | null> {
  await ensureSeeded();
  const row = (await db.countryPricing.findFirst({ where: { isDefault: true, active: true } })) ?? (await db.countryPricing.findFirst({ where: { active: true } }));
  return row ? rowToData(row) : null;
}

export interface ResolvedPrice {
  planId: string;
  monthly: number;
  yearly: number;
  currency: string;
  countryCode: string;
  countryName: string;
  /** Whether a regional override was applied (vs. the plan's base price). */
  regional: boolean;
}

/** Resolve the server-determined price for a plan for an explicit
 *  country (admin/testing entry point — same core logic the customer
 *  flow uses, with the country forced instead of IP-detected). */
export async function resolvePrice(planId: string, countryCode?: string | null): Promise<ResolvedPrice> {
  const ctx = await detectCurrencyContext(null, countryCode ?? undefined);
  const plan = getPlanConfigSync(planId);
  const resolved = resolvePlanPricingFromContext(plan, ctx);
  return {
    planId,
    monthly: resolved.monthly,
    yearly: resolved.yearly,
    currency: resolved.currency,
    countryCode: resolved.countryCode,
    countryName: resolved.countryName,
    regional: resolved.regional,
  };
}

export async function upsertCountry(input: {
  id?: string;
  countryCode: string;
  countryName: string;
  currency: string;
  isDefault?: boolean;
  regionalPrices?: Record<string, { monthly: number; yearly: number }>;
  active?: boolean;
}): Promise<CountryPricingRow | null> {
  await ensureSeeded();
  if (input.isDefault) {
    await db.countryPricing.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
  const data = {
    countryCode: input.countryCode.toUpperCase(),
    countryName: input.countryName,
    currency: input.currency,
    isDefault: input.isDefault ?? false,
    regionalPrices: JSON.stringify(input.regionalPrices ?? {}),
    active: input.active ?? true,
  };
  const row = input.id
    ? await db.countryPricing.update({ where: { id: input.id }, data }).catch(() => null)
    : await db.countryPricing.upsert({
        where: { countryCode: input.countryCode.toUpperCase() },
        create: data,
        update: data,
      });
  return row ? rowToData(row) : null;
}

export async function deleteCountry(id: string): Promise<boolean> {
  try {
    await db.countryPricing.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the platform's DEFAULT billing currency (from the default
 * CountryPricing row). Used as the INITIAL selection for a NEW plan's
 * default currency in the Create Plan modal and as the fallback when
 * a plan row carries no currency. Each plan's default / fallback
 * currency is admin-editable via the country/currency selector in the
 * Edit Plan modal — this is only the platform-level starting point.
 */
export async function getPlatformDefaultCurrency(): Promise<string> {
  const def = await getDefaultCountry();
  if (def?.currency && def.currency.trim().length > 0) return def.currency.trim().toUpperCase();
  // Fallback: any active country's currency, then 'CHF' (schema default).
  await ensureSeeded();
  const any = await db.countryPricing.findFirst({ where: { active: true } });
  if (any?.currency && any.currency.trim().length > 0) return any.currency.trim().toUpperCase();
  return 'CHF';
}

// ============================================================
// IP → COUNTRY RESOLUTION + CUSTOMER CURRENCY DETECTION
// ============================================================
// The IP→country table below covers the well-known cloud ranges +
// loopback / RFC1918 addresses used in dev/test. For an unknown IP,
// we fall back to the platform default country. This is intentionally
// a static table (no external HTTP API) so currency resolution is
// deterministic and never blocked by network availability.
//
// PRODUCTION HARDENING: for a production deployment, plug in a real
// MaxMind GeoLite2 database (or a paid IP geolocation service) by
// replacing the `ipToCountryCode` function below. The rest of the
// flow (resolveCustomerCurrency → resolvePrice → checkout) is
// already correct — only the IP→country step needs the upgrade.
// ============================================================

/** Country code for a CIDR block (e.g. '1.0.0.0/8' → 'US'). */
interface IpRange {
  cidr: string;
  country: string;
}

// Minimal IP→country table covering the active CountryPricing rows
// (CH / US / EU / MA) + cloud ranges (AWS, GCP, Azure) + the
// loopback / RFC1918 ranges that map to the platform default country.
const IP_RANGES: IpRange[] = [
  // Loopback + RFC1918 → resolve to the platform DEFAULT country.
  // (Localhost requests are from the dev machine — treat as default.)
  { cidr: '127.0.0.0/8', country: '__LOCAL__' },
  { cidr: '10.0.0.0/8', country: '__LOCAL__' },
  { cidr: '172.16.0.0/12', country: '__LOCAL__' },
  { cidr: '192.168.0.0/16', country: '__LOCAL__' },
  // Morocco (MAD) — Morocco's RIPE allocations start with 41.92.0.0/13,
  // 105.128.0.0/11, 197.0.0.0/9 — covered at the /8 granularity.
  { cidr: '41.0.0.0/8', country: 'MA' },
  { cidr: '105.0.0.0/8', country: 'MA' },
  { cidr: '197.0.0.0/8', country: 'MA' },
  // Switzerland (CHF) — Swiss IPs are scattered; common prefix is
  // 85.0.0.0/8 (Init7) + 194.x and 195.x Swisscom. We'll resolve
  // 85.x and 194.230.x → CH.
  { cidr: '85.0.0.0/8', country: 'CH' },
  { cidr: '194.230.0.0/16', country: 'CH' },
  // European Union (EUR) — broad European RIPE ranges. This is
  // intentionally coarse; in production replace with MaxMind.
  { cidr: '176.0.0.0/8', country: 'EU' },
  { cidr: '178.0.0.0/8', country: 'EU' },
  { cidr: '188.0.0.0/8', country: 'EU' },
  // United States (USD) — common AWS / GCP / Azure + US ISPs.
  { cidr: '8.0.0.0/8', country: 'US' },
  { cidr: '23.0.0.0/8', country: 'US' },
  { cidr: '35.0.0.0/8', country: 'US' },
  { cidr: '50.0.0.0/8', country: 'US' },
  { cidr: '52.0.0.0/8', country: 'US' },
  { cidr: '54.0.0.0/8', country: 'US' },
  { cidr: '64.0.0.0/8', country: 'US' },
  { cidr: '98.0.0.0/8', country: 'US' },
  { cidr: '104.0.0.0/8', country: 'US' },
  { cidr: '142.0.0.0/8', country: 'US' },
  { cidr: '204.0.0.0/8', country: 'US' },
];

/** Parse an IPv4 dotted-quad into a 32-bit unsigned integer.
 *  Returns null when the string is not a valid IPv4. */
function parseIpv4(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = result * 256 + n;
  }
  return result >>> 0; // unsigned 32-bit
}

/** Parse a CIDR (e.g. '52.0.0.0/8') into { base, mask } as 32-bit
 *  unsigned integers. Returns null on parse failure. */
function parseCidr(cidr: string): { base: number; mask: number } | null {
  const [ipStr, maskStr] = cidr.split('/');
  const base = parseIpv4(ipStr);
  if (base === null) return null;
  const bits = maskStr !== undefined ? Number(maskStr) : 32;
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  // mask: high `bits` bits set, low (32-bits) bits clear.
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { base: (base & mask) >>> 0, mask };
}

/** Map an IP to a country code (or '__LOCAL__' for RFC1918 / loopback).
 *  Returns null when no range matches → caller falls back to the
 *  platform default country. */
function ipToCountryCode(ip: string): string | null {
  const ipInt = parseIpv4(ip);
  if (ipInt === null) return null;
  for (const range of IP_RANGES) {
    const parsed = parseCidr(range.cidr);
    if (!parsed) continue;
    if ((ipInt & parsed.mask) >>> 0 === parsed.base) {
      return range.country;
    }
  }
  return null;
}

export interface ResolvedCustomerCurrency {
  currency: string;
  countryCode: string;
  countryName: string;
  /** 'ip' = resolved from client IP; 'default' = platform default fallback;
   *  'local' = loopback/RFC1918 (treated as platform default). */
  source: 'ip' | 'default' | 'local';
  /** True when the resolved country has a regionalPrices override for the
   *  requested plan (vs. falling back to the plan's base price). */
  regional: boolean;
}

// -------------------- Currency detection context --------------------

/** Full server-side detection context for one request: the customer's
 *  country + currency + the CountryPricing row it came from (null when
 *  the currency came from the shared catalog or the platform default). */
export interface CurrencyContext {
  currency: string;
  countryCode: string;
  countryName: string;
  source: 'ip' | 'default' | 'local';
  /** The active CountryPricing row for the detected country (null when
   *  none exists — the currency then came from the currency catalog). */
  row: CountryPricingRow | null;
}

/** Detect the customer's country + currency from the request.
 *
 *  Flow:
 *    1. Extract client IP (x-forwarded-for first, x-real-ip next).
 *    2. Map IP → country code via the built-in IP→country table.
 *       Loopback / RFC1918 → '__LOCAL__' → platform default.
 *    3. Resolve the country's currency:
 *         a. an ACTIVE CountryPricing row for the country (the
 *            platform's explicit country → currency config) wins;
 *         b. else the shared currency catalog (FR → EUR, MA → MAD, …);
 *         c. else the platform default country.
 *
 *  `countryOverride` forces the country (admin/testing entry point).
 *
 *  The client NEVER sends a currency hint — the server's IP resolution
 *  is authoritative: "The backend must determine/validate the final
 *  currency before creating the Stripe Checkout Session." */
export async function detectCurrencyContext(
  request: NextRequest | null,
  countryOverride?: string,
): Promise<CurrencyContext> {
  await ensureSeeded();

  // ---- 1-2. IP → country ----
  let clientIp: string | null = null;
  if (request) {
    clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip')?.trim() ??
      null;
  }
  // IPv6 loopback (::1) + IPv4 loopback (127.0.0.1) → local.
  const isLoopback = !clientIp || clientIp === '::1' || clientIp.startsWith('127.');

  let countryCode: string | null = null;
  let source: 'ip' | 'default' | 'local' = 'default';
  if (countryOverride && countryOverride.trim()) {
    countryCode = countryOverride.trim().toUpperCase();
    source = 'ip';
  } else if (isLoopback) {
    source = 'local';
  } else if (clientIp) {
    const cc = ipToCountryCode(clientIp);
    if (cc === '__LOCAL__') {
      source = 'local';
    } else if (cc) {
      countryCode = cc;
      source = 'ip';
    }
  }

  // Local / unknown → the platform default country (and its currency).
  if (source !== 'ip' && !countryCode) {
    const def = await getDefaultCountry();
    return {
      currency: (def?.currency ?? 'CHF').toUpperCase(),
      countryCode: def?.countryCode ?? '—',
      countryName: def?.countryName ?? 'Default',
      source: source === 'local' ? 'local' : 'default',
      row: def,
    };
  }

  // ---- 3. Country → currency ----
  // (a) Active CountryPricing row for the country wins.
  if (countryCode) {
    const row = await db.countryPricing.findFirst({
      where: { countryCode, active: true },
    });
    if (row) {
      const data = rowToData(row);
      return {
        currency: data.currency.toUpperCase(),
        countryCode: data.countryCode,
        countryName: data.countryName,
        source,
        row: data,
      };
    }
    // (b) Shared currency catalog (FR → EUR, MA → MAD, …).
    const catalogCurrency = countryToCurrency(countryCode);
    if (catalogCurrency) {
      const entry = findCountryEntry(countryCode);
      return {
        currency: catalogCurrency,
        countryCode,
        countryName: entry?.countryName ?? countryCode,
        source,
        row: null,
      };
    }
    // Country detected but unknown to the catalog → default fallback.
    if (source === 'ip') source = 'default';
  }

  // (c) Platform default country.
  const def = await getDefaultCountry();
  return {
    currency: (def?.currency ?? 'CHF').toUpperCase(),
    countryCode: def?.countryCode ?? countryCode ?? '—',
    countryName: def?.countryName ?? 'Default',
    source,
    row: def,
  };
}

/** Resolve the customer's billing currency + country from the request
 *  (country-level detection WITHOUT plan context — used where only the
 *  detected currency matters, e.g. the Client Billing header badge). */
export async function resolveCustomerCurrency(
  request: NextRequest | null,
): Promise<ResolvedCustomerCurrency> {
  const ctx = await detectCurrencyContext(request);
  return {
    currency: ctx.currency,
    countryCode: ctx.countryCode,
    countryName: ctx.countryName,
    source: ctx.source,
    regional: false,
  };
}

// -------------------- Per-plan pricing resolution --------------------

export interface ResolvedPlanPricing {
  planId: string;
  /** The FINAL billing/display currency (detected, or the plan default
   *  after fallback). This is what Stripe checkout MUST charge in. */
  currency: string;
  monthly: number;
  yearly: number;
  /** Where the final currency came from:
   *  'ip' | 'local' — detected from the customer's location;
   *  'default'      — detection failed → platform default;
   *  'plan'         — the plan's autoCurrency is OFF (plan default). */
  source: 'ip' | 'default' | 'local' | 'plan';
  /** True when the detected currency had a price for this plan (no
   *  fallback applied). False → the plan default currency is in use. */
  supported: boolean;
  /** The currency that was DETECTED for the customer (pre-fallback) —
   *  surfaced so the UI can explain the fallback. */
  detectedCurrency: string;
  countryCode: string;
  countryName: string;
  /** True when a country-specific regional price was applied. */
  regional: boolean;
}

/** Pure, synchronous per-plan pricing resolution. Takes the detection
 *  context (from detectCurrencyContext) + the plan config and applies
 *  the AUTO CURRENCY rules:
 *    1. autoCurrency OFF → plan default currency + base price.
 *    2. Detected currency === plan default → base price.
 *    3. Country regional price (CountryPricing.regionalPrices[planId]).
 *    4. Plan per-currency entry (pricesByCurrency — platform regional
 *       / legacy data).
 *    5. No price for the detected currency → FALL BACK to the plan
 *       default currency + base price (supported: false).
 *  The billing interval picks monthly vs yearly from the resolved
 *  pair — currency detection and interval are orthogonal. */
export function resolvePlanPricingFromContext(
  plan: PlanConfigData,
  ctx: CurrencyContext,
): ResolvedPlanPricing {
  const base = {
    planId: plan.planId,
    currency: (plan.currency ?? 'CHF').toUpperCase(),
    monthly: plan.priceMonthly,
    yearly: plan.priceYearly,
    detectedCurrency: ctx.currency,
    countryCode: ctx.countryCode,
    countryName: ctx.countryName,
  };

  // 1. Auto Currency OFF → everyone is billed in the plan default.
  if (!plan.autoCurrency) {
    return { ...base, source: 'plan', supported: true, regional: false };
  }

  // 2. Detected currency IS the plan default → base price.
  if (ctx.currency === base.currency) {
    return { ...base, source: ctx.source, supported: true, regional: false };
  }

  // 3. Country regional price (the platform's configured price for
  //    this plan in the customer's country).
  const regional = ctx.row?.regionalPrices?.[plan.planId];
  if (regional && ctx.row && ctx.currency === ctx.row.currency.toUpperCase()) {
    return {
      ...base,
      currency: ctx.currency,
      monthly: regional.monthly,
      yearly: regional.yearly,
      source: ctx.source,
      supported: true,
      regional: true,
    };
  }

  // 4. Plan per-currency entry (platform regional / legacy data).
  const perCurrency = plan.pricesByCurrency?.[ctx.currency];
  if (perCurrency) {
    return {
      ...base,
      currency: ctx.currency,
      monthly: perCurrency.monthly,
      yearly: perCurrency.yearly,
      source: ctx.source,
      supported: true,
      regional: false,
    };
  }

  // 5. Detected currency NOT SUPPORTED for this plan → fall back to
  //    the plan default currency + base price.
  return { ...base, source: ctx.source, supported: false, regional: false };
}

/** Resolve the FINAL price + currency a customer must pay for a plan.
 *  The SINGLE entry point used by /api/billing/checkout (and the
 *  billing page via /api/platform/billing/me). The server is the
 *  authority — the client cannot influence the currency. */
export async function resolveCustomerPricing(
  request: NextRequest | null,
  planId: string,
  countryOverride?: string,
): Promise<ResolvedPlanPricing> {
  const ctx = await detectCurrencyContext(request, countryOverride);
  const plan = getPlanConfigSync(planId);
  return resolvePlanPricingFromContext(plan, ctx);
}

/** List the platform's SUPPORTED currencies — the unique set of
 *  currencies from all ACTIVE CountryPricing rows (used by the
 *  platform-level pricing configuration + Stripe sync flows). */
export async function listSupportedCurrencies(): Promise<string[]> {
  await ensureSeeded();
  const rows = await db.countryPricing.findMany({
    where: { active: true },
    select: { currency: true },
  });
  const set = new Set<string>();
  for (const r of rows) {
    if (r.currency && r.currency.trim().length > 0) {
      set.add(r.currency.trim().toUpperCase());
    }
  }
  // Always include the platform default at the front.
  const def = await getDefaultCountry();
  const defCur = def?.currency?.trim().toUpperCase();
  const list = Array.from(set);
  if (defCur && list.includes(defCur)) {
    list.splice(list.indexOf(defCur), 1);
    list.unshift(defCur);
  }
  return list.length > 0 ? list : ['CHF'];
}
