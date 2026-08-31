// ============================================================
// CURRENCY CATALOG — shared country → currency dataset.
// ============================================================
// Client-safe module (NO server / DB imports) used by:
//   - The Edit/Create Plan modal's Default Currency selector
//     (shows: country flag, country name, currency code, symbol).
//   - The Client Billing page price formatting (formatMoney).
//   - Server-side country → currency mapping (country-pricing.ts)
//     when the customer's country has no explicit CountryPricing
//     row (e.g. a French visitor maps FR → EUR via this catalog).
//
// SELECTOR: SELECTABLE_CURRENCIES is the de-duplicated list of
// currencies (one representative country per currency). The plan
// stores ONE default/fallback currency code; the selector's value
// IS that code. Flags render as self-hosted SVG images from
// /flags/{countryCode}.svg — NOT emoji (emoji flags render as
// plain country-code text like "GB" on Windows, which reads as a
// duplicate code prefix in "[Flag] Country — CODE — Symbol").
//
// PRICE DISPLAY: formatMoney(amount, code) renders "$9" / "€9" /
// "CHF 9" / "90 MAD" — symbol prefix for symbol currencies, code
// prefix/suffix otherwise.
// ============================================================

export interface CountryCurrencyEntry {
  /** ISO 3166-1 alpha-2 (or pseudo code like 'EU'). */
  country: string;
  countryName: string;
  currency: string;
  /** Flag emoji for the selector. */
  flag: string;
  /** Native currency symbol (display-only). */
  symbol: string;
}

/**
 * Country → currency dataset. The FIRST entry for a given currency is
 * the representative shown in the Default Currency selector (e.g. EUR
 * is represented by the European Union, MAD by Morocco, CHF by
 * Switzerland, USD by the United States).
 */
export const COUNTRY_CURRENCY_CATALOG: CountryCurrencyEntry[] = [
  // ---- Representative entries (drive the selector order) ----
  { country: 'US', countryName: 'United States', currency: 'USD', flag: '🇺🇸', symbol: '$' },
  { country: 'MA', countryName: 'Morocco', currency: 'MAD', flag: '🇲🇦', symbol: 'د.م.' },
  { country: 'EU', countryName: 'European Union', currency: 'EUR', flag: '🇪🇺', symbol: '€' },
  { country: 'CH', countryName: 'Switzerland', currency: 'CHF', flag: '🇨🇭', symbol: 'CHF' },
  { country: 'GB', countryName: 'United Kingdom', currency: 'GBP', flag: '🇬🇧', symbol: '£' },
  { country: 'CA', countryName: 'Canada', currency: 'CAD', flag: '🇨🇦', symbol: '$' },
  { country: 'AU', countryName: 'Australia', currency: 'AUD', flag: '🇦🇺', symbol: '$' },
  { country: 'JP', countryName: 'Japan', currency: 'JPY', flag: '🇯🇵', symbol: '¥' },
  { country: 'CN', countryName: 'China', currency: 'CNY', flag: '🇨🇳', symbol: '¥' },
  { country: 'IN', countryName: 'India', currency: 'INR', flag: '🇮🇳', symbol: '₹' },
  { country: 'SA', countryName: 'Saudi Arabia', currency: 'SAR', flag: '🇸🇦', symbol: 'SAR' },
  { country: 'AE', countryName: 'United Arab Emirates', currency: 'AED', flag: '🇦🇪', symbol: 'AED' },
  { country: 'SE', countryName: 'Sweden', currency: 'SEK', flag: '🇸🇪', symbol: 'kr' },
  { country: 'NO', countryName: 'Norway', currency: 'NOK', flag: '🇳🇴', symbol: 'kr' },
  { country: 'DK', countryName: 'Denmark', currency: 'DKK', flag: '🇩🇰', symbol: 'kr' },
  { country: 'PL', countryName: 'Poland', currency: 'PLN', flag: '🇵🇱', symbol: 'zł' },
  { country: 'CZ', countryName: 'Czechia', currency: 'CZK', flag: '🇨🇿', symbol: 'Kč' },
  { country: 'TR', countryName: 'Türkiye', currency: 'TRY', flag: '🇹🇷', symbol: '₺' },
  { country: 'BR', countryName: 'Brazil', currency: 'BRL', flag: '🇧🇷', symbol: 'R$' },
  { country: 'MX', countryName: 'Mexico', currency: 'MXN', flag: '🇲🇽', symbol: '$' },
  { country: 'ZA', countryName: 'South Africa', currency: 'ZAR', flag: '🇿🇦', symbol: 'R' },
  { country: 'EG', countryName: 'Egypt', currency: 'EGP', flag: '🇪🇬', symbol: 'E£' },
  { country: 'NG', countryName: 'Nigeria', currency: 'NGN', flag: '🇳🇬', symbol: '₦' },
  { country: 'KE', countryName: 'Kenya', currency: 'KES', flag: '🇰🇪', symbol: 'KSh' },
  { country: 'SG', countryName: 'Singapore', currency: 'SGD', flag: '🇸🇬', symbol: '$' },
  { country: 'HK', countryName: 'Hong Kong', currency: 'HKD', flag: '🇭🇰', symbol: '$' },
  { country: 'NZ', countryName: 'New Zealand', currency: 'NZD', flag: '🇳🇿', symbol: '$' },
  { country: 'KR', countryName: 'South Korea', currency: 'KRW', flag: '🇰🇷', symbol: '₩' },
  { country: 'TH', countryName: 'Thailand', currency: 'THB', flag: '🇹🇭', symbol: '฿' },
  { country: 'VN', countryName: 'Vietnam', currency: 'VND', flag: '🇻🇳', symbol: '₫' },
  { country: 'ID', countryName: 'Indonesia', currency: 'IDR', flag: '🇮🇩', symbol: 'Rp' },
  { country: 'PH', countryName: 'Philippines', currency: 'PHP', flag: '🇵🇭', symbol: '₱' },
  { country: 'MY', countryName: 'Malaysia', currency: 'MYR', flag: '🇲🇾', symbol: 'RM' },
  { country: 'IL', countryName: 'Israel', currency: 'ILS', flag: '🇮🇱', symbol: '₪' },
  { country: 'QA', countryName: 'Qatar', currency: 'QAR', flag: '🇶🇦', symbol: 'QAR' },
  { country: 'KW', countryName: 'Kuwait', currency: 'KWD', flag: '🇰🇼', symbol: 'KWD' },
  { country: 'BH', countryName: 'Bahrain', currency: 'BHD', flag: '🇧🇭', symbol: 'BHD' },
  { country: 'OM', countryName: 'Oman', currency: 'OMR', flag: '🇴🇲', symbol: 'OMR' },
  { country: 'JO', countryName: 'Jordan', currency: 'JOD', flag: '🇯🇴', symbol: 'JOD' },
  { country: 'LB', countryName: 'Lebanon', currency: 'LBP', flag: '🇱🇧', symbol: 'LBP' },
  { country: 'TN', countryName: 'Tunisia', currency: 'TND', flag: '🇹🇳', symbol: 'TND' },
  { country: 'DZ', countryName: 'Algeria', currency: 'DZD', flag: '🇩🇿', symbol: 'DZD' },
  { country: 'LY', countryName: 'Libya', currency: 'LYD', flag: '🇱🇾', symbol: 'LYD' },
  { country: 'PK', countryName: 'Pakistan', currency: 'PKR', flag: '🇵🇰', symbol: '₨' },
  { country: 'BD', countryName: 'Bangladesh', currency: 'BDT', flag: '🇧🇩', symbol: '৳' },
  { country: 'UA', countryName: 'Ukraine', currency: 'UAH', flag: '🇺🇦', symbol: '₴' },
  { country: 'RO', countryName: 'Romania', currency: 'RON', flag: '🇷🇴', symbol: 'RON' },
  { country: 'HU', countryName: 'Hungary', currency: 'HUF', flag: '🇭🇺', symbol: 'Ft' },
  { country: 'BG', countryName: 'Bulgaria', currency: 'BGN', flag: '🇧🇬', symbol: 'BGN' },
  { country: 'HR', countryName: 'Croatia', currency: 'EUR', flag: '🇭🇷', symbol: '€' },
  { country: 'AR', countryName: 'Argentina', currency: 'ARS', flag: '🇦🇷', symbol: '$' },
  { country: 'CL', countryName: 'Chile', currency: 'CLP', flag: '🇨🇱', symbol: '$' },
  { country: 'CO', countryName: 'Colombia', currency: 'COP', flag: '🇨🇴', symbol: '$' },
  { country: 'PE', countryName: 'Peru', currency: 'PEN', flag: '🇵🇪', symbol: 'S/' },
  { country: 'UY', countryName: 'Uruguay', currency: 'UYU', flag: '🇺🇾', symbol: '$' },
  { country: 'RU', countryName: 'Russia', currency: 'RUB', flag: '🇷🇺', symbol: '₽' },

  // ---- Additional EUR countries (country → currency detection) ----
  { country: 'FR', countryName: 'France', currency: 'EUR', flag: '🇫🇷', symbol: '€' },
  { country: 'DE', countryName: 'Germany', currency: 'EUR', flag: '🇩🇪', symbol: '€' },
  { country: 'IT', countryName: 'Italy', currency: 'EUR', flag: '🇮🇹', symbol: '€' },
  { country: 'ES', countryName: 'Spain', currency: 'EUR', flag: '🇪🇸', symbol: '€' },
  { country: 'NL', countryName: 'Netherlands', currency: 'EUR', flag: '🇳🇱', symbol: '€' },
  { country: 'BE', countryName: 'Belgium', currency: 'EUR', flag: '🇧🇪', symbol: '€' },
  { country: 'PT', countryName: 'Portugal', currency: 'EUR', flag: '🇵🇹', symbol: '€' },
  { country: 'IE', countryName: 'Ireland', currency: 'EUR', flag: '🇮🇪', symbol: '€' },
  { country: 'AT', countryName: 'Austria', currency: 'EUR', flag: '🇦🇹', symbol: '€' },
  { country: 'FI', countryName: 'Finland', currency: 'EUR', flag: '🇫🇮', symbol: '€' },
  { country: 'GR', countryName: 'Greece', currency: 'EUR', flag: '🇬🇷', symbol: '€' },
  { country: 'LU', countryName: 'Luxembourg', currency: 'EUR', flag: '🇱🇺', symbol: '€' },
  { country: 'SK', countryName: 'Slovakia', currency: 'EUR', flag: '🇸🇰', symbol: '€' },
  { country: 'SI', countryName: 'Slovenia', currency: 'EUR', flag: '🇸🇮', symbol: '€' },
  { country: 'EE', countryName: 'Estonia', currency: 'EUR', flag: '🇪🇪', symbol: '€' },
  { country: 'LV', countryName: 'Latvia', currency: 'EUR', flag: '🇱🇻', symbol: '€' },
  { country: 'LT', countryName: 'Lithuania', currency: 'EUR', flag: '🇱🇹', symbol: '€' },
  { country: 'CY', countryName: 'Cyprus', currency: 'EUR', flag: '🇨🇾', symbol: '€' },
  { country: 'MT', countryName: 'Malta', currency: 'EUR', flag: '🇲🇹', symbol: '€' },
];

/** Country code (ISO alpha-2, case-insensitive) → currency code.
 *  Mirrors COUNTRY_CURRENCY_CATALOG for O(1) lookup. */
const COUNTRY_TO_CURRENCY = new Map<string, string>(
  COUNTRY_CURRENCY_CATALOG.map((e) => [e.country.toUpperCase(), e.currency.toUpperCase()]),
);

/** Map a country code to its currency. Returns null for unknown codes. */
export function countryToCurrency(countryCode: string): string | null {
  return COUNTRY_TO_CURRENCY.get((countryCode ?? '').trim().toUpperCase()) ?? null;
}

/** Find the catalog entry for a country code (null when unknown). */
export function findCountryEntry(countryCode: string): CountryCurrencyEntry | null {
  const cc = (countryCode ?? '').trim().toUpperCase();
  return COUNTRY_CURRENCY_CATALOG.find((e) => e.country.toUpperCase() === cc) ?? null;
}

// -------------------- Currency display formatting --------------------

/** How a price renders for a currency: the symbol and whether it is
 *  prefixed or suffixed. Symbol currencies (USD $, EUR € …) prefix the
 *  symbol; MAD suffixes its code ("90 MAD"); CHF prefixes ("CHF 9");
 *  unknown codes prefix their code. */
const CURRENCY_FORMAT: Record<string, { text: string; position: 'prefix' | 'suffix' }> = {
  USD: { text: '$', position: 'prefix' },
  EUR: { text: '€', position: 'prefix' },
  GBP: { text: '£', position: 'prefix' },
  JPY: { text: '¥', position: 'prefix' },
  CNY: { text: '¥', position: 'prefix' },
  INR: { text: '₹', position: 'prefix' },
  KRW: { text: '₩', position: 'prefix' },
  TRY: { text: '₺', position: 'prefix' },
  RUB: { text: '₽', position: 'prefix' },
  BRL: { text: 'R$', position: 'prefix' },
  ZAR: { text: 'R', position: 'prefix' },
  PLN: { text: 'zł', position: 'suffix' },
  CZK: { text: 'Kč', position: 'suffix' },
  SEK: { text: 'kr', position: 'suffix' },
  NOK: { text: 'kr', position: 'suffix' },
  DKK: { text: 'kr', position: 'suffix' },
  MAD: { text: 'MAD', position: 'suffix' },
  CHF: { text: 'CHF', position: 'prefix' },
};

/** The native symbol for a currency code (e.g. MAD → 'د.م.'). Used by
 *  the selector's "flag — name — code — symbol" display. */
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  KRW: '₩',
  TRY: '₺',
  RUB: '₽',
  BRL: 'R$',
  ZAR: 'R',
  PLN: 'zł',
  CZK: 'Kč',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  MAD: 'د.م.',
  CHF: 'CHF',
};

/** Format an amount for display in a currency.
 *  e.g. (9, 'USD') → "$9"; (90, 'MAD') → "90 MAD"; (9, 'CHF') → "CHF 9".
 *  `decimals` controls the fraction digits (default 0). */
export function formatMoney(amount: number, currency: string, decimals = 0): string {
  const code = (currency ?? '').trim().toUpperCase();
  const fmt = CURRENCY_FORMAT[code] ?? { text: code || '?', position: 'prefix' as const };
  const num = (Number.isFinite(amount) ? amount : 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return fmt.position === 'prefix' ? `${fmt.text}${num}` : `${num} ${fmt.text}`;
}

/** Display symbol for a currency (MAD → 'د.م.', USD → '$'). */
export function currencySymbolOf(code: string): string {
  return CURRENCY_SYMBOL[(code ?? '').trim().toUpperCase()] ?? (code ?? '').toUpperCase();
}

// -------------------- Selector list --------------------

export interface SelectableCurrency {
  /** The currency code — this is the stored plan default currency. */
  code: string;
  /** ISO country code of the representative country (drives the
   *  self-hosted flag image: /flags/{countryCode}.svg). */
  countryCode: string;
  flag: string;
  countryName: string;
  /** Native symbol shown in the selector (MAD → 'د.م.'). */
  symbol: string;
}

/** De-duplicated currency list for the Default Currency selector. The
 *  first catalog entry per currency is the representative country
 *  (🇺🇸 United States — USD, 🇲🇦 Morocco — MAD, 🇪🇺 European Union —
 *  EUR, 🇨🇭 Switzerland — CHF, …). Order follows the catalog. */
export const SELECTABLE_CURRENCIES: SelectableCurrency[] = (() => {
  const seen = new Set<string>();
  const out: SelectableCurrency[] = [];
  for (const e of COUNTRY_CURRENCY_CATALOG) {
    const code = e.currency.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      countryCode: e.country.toUpperCase(),
      flag: e.flag,
      countryName: e.countryName,
      symbol: CURRENCY_SYMBOL[code] ?? e.symbol,
    });
  }
  return out;
})();

/** Find the selector entry for a currency code (null when unknown). */
export function findSelectableCurrency(code: string): SelectableCurrency | null {
  const c = (code ?? '').trim().toUpperCase();
  return SELECTABLE_CURRENCIES.find((s) => s.code === c) ?? null;
}
