// ============================================================
// COUNTRY / CURRENCY / REGIONAL PRICING — server-determined.
// ============================================================
// IP geolocation is the initial detection; the SERVER determines the
// final applicable price + currency from the CountryPricing table.
// The client cannot change currency in the frontend to obtain a
// different price. The owner configures supported countries, the
// currency per country, regional prices, and the default currency.
//
// resolveCustomerCurrency(request) is the SINGLE entry point used by
// /api/billing/checkout + /api/platform/billing/me to determine the
// customer's currency for a given request. It:
//   1. Extracts the client IP from x-forwarded-for / x-real-ip.
//   2. Maps the IP to a country code via a built-in IP→country table
//      (covers well-known cloud + ISP ranges + RFC1918 / loopback
//      mappings so dev/test from localhost resolves deterministically).
//   3. Looks up the country code in CountryPricing. If active, returns
//      that country's currency. If not active / unknown, falls back to
//      the platform default country.
//   4. Returns { currency, countryCode, countryName, source, regional }.
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getPlanConfigSync } from './plan-config';

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

/** Resolve the final server-determined price for a plan in a country. */
export async function resolvePrice(planId: string, countryCode?: string | null): Promise<ResolvedPrice> {
  await ensureSeeded();
  const plan = getPlanConfigSync(planId);

  let country: CountryPricingRow | null = null;
  if (countryCode) {
    const row = await db.countryPricing.findFirst({ where: { countryCode, active: true } });
    country = row ? rowToData(row) : null;
  }
  if (!country) country = await getDefaultCountry();
  if (!country) {
    return {
      planId,
      monthly: plan.priceMonthly,
      yearly: plan.priceYearly,
      currency: plan.currency,
      countryCode: '—',
      countryName: 'Default',
      regional: false,
    };
  }

  const regional = country.regionalPrices[planId];
  if (regional) {
    return {
      planId,
      monthly: regional.monthly,
      yearly: regional.yearly,
      currency: country.currency,
      countryCode: country.countryCode,
      countryName: country.countryName,
      regional: true,
    };
  }
  return {
    planId,
    monthly: plan.priceMonthly,
    yearly: plan.priceYearly,
    currency: country.currency,
    countryCode: country.countryCode,
    countryName: country.countryName,
    regional: false,
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
 * Resolve the platform's default billing currency. The currency is NOT
 * chosen per-plan in the admin editor — it is derived from the default
 * country configured in the CountryPricing table (the "billing
 * configuration" the platform already uses). Falls back to 'CHF' when
 * no default country is configured (e.g. fresh DB before bootstrap).
 *
 * This keeps currency handling consistent between the plan, checkout,
 * client billing page, and Stripe: every plan stores its prices in the
 * platform default currency, the Stripe Prices are created in that same
 * currency, and the client billing page displays that same currency —
 * the admin never manually picks a currency per plan.
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

/** Resolve the customer's billing currency + country from the request.
 *  This is the SINGLE entry point used by /api/billing/checkout and
 *  /api/platform/billing/me to determine which currency to charge in.
 *
 *  Flow:
 *    1. Extract client IP (x-forwarded-for first, x-real-ip next).
 *    2. Map IP → country code via the built-in IP→country table.
 *       Loopback / RFC1918 → '__LOCAL__' → platform default.
 *    3. Look up the country code in CountryPricing (must be active).
 *       If found, return that country's currency (source='ip' or
 *       'local'). Otherwise fall back to the platform default country
 *       (source='default').
 *
 *  The client NEVER sends a currency hint — the server's IP resolution
 *  is authoritative. This is the user's explicit requirement:
 *  "The backend must determine/validate the final currency before
 *   creating the Stripe Checkout Session." */
export async function resolveCustomerCurrency(
  request: NextRequest | null,
  planId?: string,
): Promise<ResolvedCustomerCurrency> {
  await ensureSeeded();
  // Extract client IP from standard proxy headers (the Caddy gateway
  // and Next.js both set x-forwarded-for).
  let clientIp: string | null = null;
  if (request) {
    clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip')?.trim() ??
      null;
  }
  // IPv6 loopback (::1) + IPv4 loopback (127.0.0.1) → local.
  const isLoopback = !clientIp || clientIp === '::1' || clientIp.startsWith('127.');

  // Try IP → country resolution.
  let countryCode: string | null = null;
  let source: 'ip' | 'default' | 'local' = 'default';
  if (isLoopback) {
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

  // Look up the resolved country in CountryPricing. Fall back to the
  // platform default when no match.
  let country: CountryPricingRow | null = null;
  if (countryCode) {
    const row = await db.countryPricing.findFirst({
      where: { countryCode, active: true },
    });
    country = row ? rowToData(row) : null;
  }
  if (!country) {
    country = await getDefaultCountry();
    if (source === 'ip') source = 'default'; // IP resolved but no match
  }
  if (!country) {
    // No countries configured at all → CHF (schema default).
    return {
      currency: 'CHF',
      countryCode: '—',
      countryName: 'Default',
      source,
      regional: false,
    };
  }

  // Determine whether the resolved country has a regionalPrices override
  // for the requested plan (if any).
  let regional = false;
  if (planId) {
    const plan = getPlanConfigSync(planId);
    const override = country.regionalPrices[planId];
    if (override) {
      regional = true;
    } else {
      // No country-level override → the plan's pricesByCurrency[currency]
      // is the source of truth (also "regional" in the multi-currency
      // sense — different price per currency).
      regional = Boolean(plan.pricesByCurrency?.[country.currency]);
    }
  }

  return {
    currency: country.currency.toUpperCase(),
    countryCode: country.countryCode,
    countryName: country.countryName,
    source,
    regional,
  };
}

/** List the platform's SUPPORTED currencies — the unique set of
 *  currencies from all ACTIVE CountryPricing rows. Drives the
 *  multi-currency price inputs in the Edit Plan modal. */
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
