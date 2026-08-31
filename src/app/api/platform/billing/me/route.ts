import { NextRequest } from 'next/server';
import { requireAuth, ok } from '@/lib/platform/platform-auth';
import { getClientBillingAsync } from '@/lib/platform/platform-data';
import { resolveCustomerCurrency } from '@/lib/platform/country-pricing';

// GET /api/platform/billing/me
//   Returns the authenticated user's full billing state PLUS the
//   server-determined customer currency resolution (from their request
//   IP via x-forwarded-for → CountryPricing).
//
//   - `customerCurrencyResolution` is the authoritative sub-object:
//     { currency, countryCode, countryName, source, regional }.
//   - Top-level convenience fields (customerCurrency, customerCountryCode,
//     customerCountryName, currencySource) are also surfaced for easy
//     frontend consumption.
//   - The existing ClientBillingState shape is NOT modified — the new
//     fields are added ALONGSIDE the existing ones. The frontend reads
//     `plan.pricesByCurrency[customerCurrency]` to display the right
//     price per plan (the pricesByCurrency map is already on every Plan
//     in `allPlans`).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  // Async path: prefers DB Subscription row over the legacy in-memory
  // customer. Returns the full ClientBillingState with billingInterval,
  // currentPeriodEnd, trialEnd, freeTrialExpiresAt, stripeSubscriptionId, etc.
  const billingState = await getClientBillingAsync(auth.user);

  // Resolve the customer's billing currency + country SERVER-SIDE from
  // the request IP. We do NOT pass a planId — the customer currency is
  // the same regardless of which plan they're on (it's determined by IP
  // geolocation only). The existing plans already expose a
  // pricesByCurrency map so the frontend can look up the right price.
  const currencyResolution = await resolveCustomerCurrency(request);

  return ok({
    ...billingState,
    // Authoritative sub-object — preserves the full resolution context
    // (source, regional flag) for clients that need it.
    customerCurrencyResolution: currencyResolution,
    // Convenience top-level fields — easy to consume on the frontend
    // without drilling into the sub-object.
    customerCurrency: currencyResolution.currency,
    customerCountryCode: currencyResolution.countryCode,
    customerCountryName: currencyResolution.countryName,
    currencySource: currencyResolution.source,
  });
}
