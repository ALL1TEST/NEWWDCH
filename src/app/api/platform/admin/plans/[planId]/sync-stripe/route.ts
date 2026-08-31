import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { getPlanConfigSync, savePlanConfig, type PlanConfigInput } from '@/lib/platform/plan-config';
import {
  isStripeConfiguredAsync,
  getStripeClient,
  syncPlanToStripeMulti,
  type SyncMultiResult,
} from '@/lib/stripe';
import { logAdminAction } from '@/lib/platform/audit';

// ============================================================
// PLATFORM ADMIN → SYNC A PLAN TO STRIPE (MULTI-CURRENCY).
// ============================================================
// POST /api/platform/admin/plans/[planId]/sync-stripe
//   Owner-only. Idempotently creates (or reuses) the Stripe Product +
//   one Stripe Price PER (currency, interval) pair for this local
//   PlanConfig (multi-currency), and writes the resolved
//   stripePriceIdsByCurrency map back onto the plan row.
//
// Behavior:
//   1. Refuses when Stripe is not configured → 503
//      PAYMENT_PROVIDER_NOT_CONFIGURED. The admin must connect
//      Stripe first (Platform Admin → Stripe Settings).
//   2. Refuses when the plan is FREE → 400. Free plans have no
//      Stripe charge — they're handled by the free-plan flow
//      (POST /api/platform/billing/change-plan with planId='free').
//   3. Calls syncPlanToStripeMulti which:
//        - Creates/reuses a single Stripe Product per plan (metadata.planId).
//        - For each (currency, interval) pair in pricesByCurrency:
//            * Reuses the existing Stripe Price ID when the amount matches.
//            * Creates a NEW Stripe Price when the amount changed
//              (price-change detection — old Price kept active so
//              existing subscriptions stay on the original price).
//            * Skips zero-price pairs (preserves any existing IDs).
//   4. Persists the resolved stripePriceIdsByCurrency map back onto
//      the local PlanConfig row via savePlanConfig. Also mirrors the
//      DEFAULT currency's IDs into stripePriceIdMonthly /
//      stripePriceIdYearly for backward-compat with legacy callers.
//   5. Returns the refreshed planId + stripePriceIdsByCurrency +
//      created count + defaultCurrencySnapshot so the admin UI can
//      display all per-currency Stripe Price IDs.
//
// This route is the manual "Sync to Stripe" affordance in the
// Edit Plan dialog. It's also called automatically when an admin
// saves a paid plan with empty Stripe Price IDs (see plan-config.ts).
// ============================================================

export async function POST(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const planId = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  if (!planId) return fail('VALIDATION_ERROR', 'planId is required.', 400);

  if (!(await isStripeConfiguredAsync())) {
    return fail(
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
      'Stripe is not configured. Connect your Stripe account in Platform Admin → Stripe Settings before syncing plans.',
      503,
    );
  }

  const plan = getPlanConfigSync(planId);
  if (!plan) return fail('NOT_FOUND', `Plan "${planId}" not found.`, 404);
  if (plan.isFree) {
    return fail('VALIDATION_ERROR', 'Free plans do not need a Stripe Product / Price — they are handled by the free-plan flow.', 400);
  }

  try {
    const stripe = await getStripeClient();
    const result: SyncMultiResult = await syncPlanToStripeMulti(stripe, {
      planId: plan.planId,
      name: plan.name,
      defaultCurrency: plan.currency,
      pricesByCurrency: plan.pricesByCurrency,
      stripePriceIdsByCurrency: plan.stripePriceIdsByCurrency,
    });

    // Snapshot the default currency's IDs so we can mirror them into
    // the legacy stripePriceIdMonthly / stripePriceIdYearly fields.
    // The map is keyed by UPPERCASE currency code; plan.currency is the
    // already-resolved default currency but we normalize defensively.
    const snapshot =
      result.stripePriceIdsByCurrency[plan.currency.toUpperCase()] ?? {
        monthly: null,
        yearly: null,
      };

    // Persist the resolved stripePriceIdsByCurrency back onto the local
    // plan row. Also mirror the default currency's IDs into the legacy
    // stripePriceIdMonthly / stripePriceIdYearly snapshot fields so
    // legacy callers (e.g. the older single-currency checkout path)
    // keep seeing the right IDs.
    const patch: PlanConfigInput = {
      stripePriceIdsByCurrency: result.stripePriceIdsByCurrency,
      stripePriceIdMonthly: snapshot.monthly,
      stripePriceIdYearly: snapshot.yearly,
    };
    await savePlanConfig(planId, patch);

    // Whether any NEW Stripe Prices were created during this sync.
    // (syncPlanToStripeMulti returns this counter — the admin UI uses
    // it to surface a "X new Stripe Prices created" toast.)
    const created = result.created;

    await logAdminAction({
      userId: auth.user.id,
      action: 'plan.synced_to_stripe',
      resourceType: 'PlanConfig',
      resourceId: planId,
      details: `${plan.name}: currencies=${Object.keys(result.stripePriceIdsByCurrency).join(
        ',',
      )} (default ${plan.currency}: monthly=${snapshot.monthly ?? '—'}, yearly=${snapshot.yearly ?? '—'}) — ${
        created > 0 ? `${created} new Stripe Price(s) created` : 'unchanged'
      }`,
      ipAddress: getClientIp(request) ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return ok({
      planId: plan.planId,
      stripePriceIdsByCurrency: result.stripePriceIdsByCurrency,
      created,
      defaultCurrencySnapshot: snapshot,
    });
  } catch (err) {
    return fail(
      'STRIPE_ERROR',
      err instanceof Error ? err.message : 'Unable to sync plan to Stripe.',
      502,
    );
  }
}
