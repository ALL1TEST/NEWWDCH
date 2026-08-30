// ============================================================
// COUNTRY / CURRENCY / REGIONAL PRICING — server-determined.
// ============================================================
// IP geolocation is only used as an initial/default detection. The
// server determines the final applicable price from the CountryPricing
// table — the client cannot change currency in the frontend to obtain
// a different price. The owner configures supported countries, the
// currency per country, regional prices, and the default currency.
// ============================================================

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
