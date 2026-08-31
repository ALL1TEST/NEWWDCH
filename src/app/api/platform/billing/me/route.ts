import { NextRequest } from 'next/server';
import { requireAuth, ok } from '@/lib/platform/platform-auth';
import { getClientBillingAsync } from '@/lib/platform/platform-data';
import {
  detectCurrencyContext,
  resolvePlanPricingFromContext,
  type CurrencyContext,
  type ResolvedPlanPricing,
} from '@/lib/platform/country-pricing';
import { getPlanConfigSync } from '@/lib/platform/plan-config';

// GET /api/platform/billing/me
//   Returns the authenticated user's full billing state PLUS the
//   server-determined currency + per-plan pricing resolution.
//
//   - `customerCurrencyResolution` is the detected country/currency for
//     this request (from the IP via x-forwarded-for → CountryPricing /
//     currency catalog). The customer never picks a currency manually —
//     this is what the page header badge shows.
//   - `planPricing` maps EVERY active planId → the SERVER-RESOLVED
//     final price the customer pays for that plan:
//       { currency, monthly, yearly, source, supported,
//         detectedCurrency, countryCode, countryName, regional }
//     It applies each plan's AUTO CURRENCY rules (autoCurrency off →
//     plan default; detected currency supported → that currency's
//     price; otherwise fallback to the plan default currency). The
//     frontend DISPLAYS these values — it does not compute prices.
//   - The existing ClientBillingState shape is NOT modified — the new
//     fields are added ALONGSIDE the existing ones.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  // Async path: prefers DB Subscription row over the legacy in-memory
  // customer. Returns the full ClientBillingState with billingInterval,
  // currentPeriodEnd, trialEnd, freeTrialExpiresAt, stripeSubscriptionId, etc.
  const billingState = await getClientBillingAsync(auth.user);

  // Detect the customer's country + currency ONCE (server-side, from
  // the request IP), then resolve each plan's final pricing from that
  // same context — one detection, consistent per-plan results.
  const ctx: CurrencyContext = await detectCurrencyContext(request);

  const planPricing: Record<string, ResolvedPlanPricing> = {};
  for (const plan of billingState.allPlans) {
    const config = getPlanConfigSync(plan.id);
    planPricing[plan.id] = resolvePlanPricingFromContext(config, ctx);
  }

  return ok({
    ...billingState,
    // Detected country/currency for this request (pre-fallback context).
    customerCurrencyResolution: {
      currency: ctx.currency,
      countryCode: ctx.countryCode,
      countryName: ctx.countryName,
      source: ctx.source,
    },
    // Convenience top-level fields — easy to consume on the frontend.
    customerCurrency: ctx.currency,
    customerCountryCode: ctx.countryCode,
    customerCountryName: ctx.countryName,
    currencySource: ctx.source,
    // Server-resolved FINAL price per plan (display source of truth).
    planPricing,
  });
}
