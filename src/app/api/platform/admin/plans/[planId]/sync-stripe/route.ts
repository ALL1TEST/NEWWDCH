import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { getPlanConfigSync, savePlanConfig, type PlanConfigInput } from '@/lib/platform/plan-config';
import { isStripeConfiguredAsync, getStripeClient, syncPlanToStripe } from '@/lib/stripe';
import { logAdminAction } from '@/lib/platform/audit';

// ============================================================
// PLATFORM ADMIN → SYNC A PLAN TO STRIPE.
// ============================================================
// POST /api/platform/admin/plans/[planId]/sync-stripe
//   Owner-only. Idempotently creates (or reuses) the Stripe
//   Product + monthly + yearly Stripe Prices for this local
//   PlanConfig and writes the resolved Stripe Price IDs back
//   onto the plan row (stripePriceIdMonthly / stripePriceIdYearly).
//
// Behavior:
//   1. Refuses when Stripe is not configured → 503
//      PAYMENT_PROVIDER_NOT_CONFIGURED. The admin must connect
//      Stripe first (Platform Admin → Stripe Settings).
//   2. Refuses when the plan is FREE → 400. Free plans have no
//      Stripe charge — they're handled by the free-plan flow
//      (POST /api/platform/billing/change-plan with planId='free').
//   3. Calls syncPlanToStripe (existing helper) which:
//        - Reuses existing Stripe Price IDs when present.
//        - Otherwise looks up active Stripe Prices by metadata.
//        - Otherwise creates a Stripe Product (metadata.planId) +
//          monthly + yearly Prices (metadata.planId + metadata.interval).
//   4. Persists the resolved Stripe Price IDs back onto the local
//      PlanConfig row via savePlanConfig (no-op when the values
//      match the existing row).
//   5. Returns the refreshed plan + the Stripe Price IDs + whether
//      any new Stripe objects were created (created: boolean).
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
    const result = await syncPlanToStripe(stripe, {
      planId: plan.planId,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      currency: plan.currency,
      stripePriceIdMonthly: plan.stripePriceIdMonthly,
      stripePriceIdYearly: plan.stripePriceIdYearly,
    });

    // Persist the resolved Stripe Price IDs back onto the local plan
    // row. Only patch the two price-id fields — leave everything else
    // (price, features, entitlements, etc.) untouched.
    const created =
      result.stripePriceIdMonthly !== plan.stripePriceIdMonthly ||
      result.stripePriceIdYearly !== plan.stripePriceIdYearly;

    if (created) {
      const patch: PlanConfigInput = {
        stripePriceIdMonthly: result.stripePriceIdMonthly,
        stripePriceIdYearly: result.stripePriceIdYearly,
      };
      await savePlanConfig(planId, patch);
    }

    await logAdminAction({
      userId: auth.user.id,
      action: 'plan.synced_to_stripe',
      resourceType: 'PlanConfig',
      resourceId: planId,
      details: `${plan.name}: monthly=${result.stripePriceIdMonthly}, yearly=${result.stripePriceIdYearly} (${created ? 'updated' : 'unchanged'})`,
      ipAddress: getClientIp(request) ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return ok({
      planId: plan.planId,
      stripePriceIdMonthly: result.stripePriceIdMonthly,
      stripePriceIdYearly: result.stripePriceIdYearly,
      created,
    });
  } catch (err) {
    return fail(
      'STRIPE_ERROR',
      err instanceof Error ? err.message : 'Unable to sync plan to Stripe.',
      502,
    );
  }
}
