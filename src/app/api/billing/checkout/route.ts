// ============================================================
// POST /api/billing/checkout — create a Stripe Checkout Session for a
// paid plan subscription.
// ============================================================
// Body: { planId: 'plus'|'pro'|'max', interval: 'monthly'|'yearly' }
//
// Behavior:
//   - Validates the plan + interval and checks the user doesn't already
//     have an active subscription to the same plan (would be a no-op).
//   - Reads the Stripe Price ID from PlanConfig.stripePriceIdMonthly /
//     stripePriceIdYearly.
//   - If STRIPE_SECRET_KEY is not configured → returns 503
//     "PAYMENT_PROVIDER_NOT_CONFIGURED" with a clear message. NEVER
//     fakes a successful payment.
//   - If the plan's Stripe Price ID is missing → returns 424
//     "STRIPE_PRICE_NOT_CONFIGURED" with the plan id so the admin can
//     wire it via Platform Admin → Edit Plan.
//   - On success → creates a Stripe Checkout Session and returns its `url`
//     so the client can redirect.
//   - The actual subscription activation happens via the
//     /api/webhooks/stripe route when Stripe fires
//     `checkout.session.completed`.
// ============================================================

import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { ensurePlanAssignable, getUserSubscription } from '@/lib/platform/subscription-data';
import { isStripeConfigured, getStripeClient, resolveStripePriceId, getPublicStripeConfig } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const planId = String(body.planId ?? '');
  const interval = String(body.interval ?? 'monthly') === 'yearly' ? 'yearly' : 'monthly';

  // Validate plan id (whitelist of canonical plan ids).
  if (!['free', 'plus', 'pro', 'max'].includes(planId)) {
    return fail('VALIDATION_ERROR', 'A valid planId (free|plus|pro|max) is required.', 400);
  }
  if (planId === 'free') {
    return fail(
      'VALIDATION_ERROR',
      'Free plans do not require checkout. Use POST /api/platform/billing/change-plan with planId="free" instead.',
      400,
    );
  }

  // Plan must exist + be active.
  const assignable = await ensurePlanAssignable(planId);
  if (!assignable.ok) {
    return fail('PLAN_NOT_AVAILABLE', assignable.reason ?? 'Plan is not available.', 403);
  }

  // Stripe must be configured.
  if (!isStripeConfigured()) {
    return fail(
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
      'Stripe is not configured on this platform. Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in .env to enable real checkout. Free plans can be selected directly without Stripe.',
      503,
    );
  }

  // Resolve the Stripe Price ID for this plan + interval.
  const priceId = await resolveStripePriceId(planId, interval);
  if (!priceId) {
    return fail(
      'STRIPE_PRICE_NOT_CONFIGURED',
      `Plan "${planId}" does not have a Stripe Price ID configured for the ${interval} interval. An admin must wire it via Platform Admin → Edit Plan → Stripe Price ID (${interval}).`,
      424,
    );
  }

  // Look up the user's Stripe Customer ID (if they have an existing sub).
  const existingSub = await getUserSubscription(auth.user.id);
  const stripeCustomerId = existingSub?.stripeCustomerId ?? null;

  const appUrl = getPublicStripeConfig().appUrl;
  const stripe = getStripeClient();

  try {
    // Build the Checkout Session params. mode='subscription' for recurring
    // billing. Stripe handles the renewal calendar automatically (monthly
    // periods aligned to the start date, NOT +30 days).
    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success&plan=${planId}&interval=${interval}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
      client_reference_id: auth.user.id,
      metadata: {
        userId: auth.user.id,
        userEmail: auth.user.email,
        planId,
        interval,
      },
      allow_promotion_codes: true,
    };
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
      sessionParams.customer_update = { address: 'auto' };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Persist a pending state on the user's subscription row so we can
    // attribute the webhook event to the right user even before checkout
    // completes. (Stripe will overwrite this with the real sub id on
    // `checkout.session.completed`.)
    if (existingSub) {
      await db.subscription.update({
        where: { userId: auth.user.id },
        data: { planId, billingInterval: interval, status: 'past_due' },
      });
    } else {
      await db.subscription.create({
        data: {
          userId: auth.user.id,
          planId,
          billingInterval: interval,
          status: 'past_due',
          startDate: new Date(),
          currentPeriodEnd: null,
          trialEnd: null,
          freePlanDurationDays: null,
        },
      });
    }

    return ok({ url: session.url, sessionId: session.id });
  } catch (err) {
    return fail(
      'STRIPE_ERROR',
      `Stripe Checkout session creation failed: ${(err as Error).message}`,
      502,
    );
  }
}

/** GET /api/billing/checkout — returns the public Stripe configuration
 *  (publishable key + configured flag). Used by the client to decide
 *  whether to show "Checkout via Stripe" or "Stripe not configured". */
export async function GET() {
  return ok(getPublicStripeConfig());
}
