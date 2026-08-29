// ============================================================
// POST /api/billing/checkout — create a Stripe Checkout Session for a
// paid plan subscription.
// ============================================================
// Body: { planId: 'plus'|'pro'|'max', interval: 'monthly'|'yearly', couponCode?: string }
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
//   - Pre-creates (or fetches) the Stripe Customer via
//     getOrCreateStripeCustomer so the webhook can attribute the event to
//     the right user BEFORE checkout completes.
//   - If `couponCode` is provided:
//       * Looks up the local Coupon row (404 COUPON_NOT_FOUND if missing).
//       * Runs validateCoupon (must return ok:true; 400 COUPON_INVALID
//         otherwise — including per-customer redemption-limit rejection).
//       * Pushes the local coupon to Stripe via createStripeCouponMirror
//         (creates a Stripe Coupon + Promotion Code mirror; reuses the
//         cached stripeCouponId/stripePromotionCodeId on the local row
//         so subsequent checkouts don't re-create the mirror).
//       * Adds `discounts: [{ coupon: stripeCouponId }]` to the Checkout
//         Session params and sets allow_promotion_codes:false (we are
//         applying the coupon directly — no need for the customer to
//         enter another code).
//       * Adds `couponCode` to the session metadata so the webhook can
//         snapshot it onto the Payment row.
//   - If `couponCode` is NOT provided → keeps allow_promotion_codes:true
//     so the customer can enter a code at checkout (Stripe will validate
//     it against any Promotion Code we created via createStripeCouponMirror).
//   - On success → creates a Stripe Checkout Session and returns its `url`
//     so the client can redirect.
//   - The actual subscription activation happens via the
//     /api/webhooks/stripe route when Stripe fires
//     `checkout.session.completed`.
// ============================================================

import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { ensurePlanAssignable, getUserSubscription } from '@/lib/platform/subscription-data';
import {
  isStripeConfiguredAsync,
  getStripeClient,
  resolveStripePriceId,
  getPublicStripeConfig,
  getOrCreateStripeCustomer,
  createStripeCouponMirror,
} from '@/lib/stripe';
import { db } from '@/lib/db';
import { validateCoupon } from '@/lib/platform/coupons';
import { getPlanConfigSync } from '@/lib/platform/plan-config';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const planId = String(body.planId ?? '');
  const interval = String(body.interval ?? 'monthly') === 'yearly' ? 'yearly' : 'monthly';
  const couponCodeRaw = body.couponCode ? String(body.couponCode) : '';
  const couponCode = couponCodeRaw.trim();

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
  if (!(await isStripeConfiguredAsync())) {
    return fail(
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
      'Stripe is not configured on this platform. Connect your Stripe account in Platform Admin → Stripe Settings, or set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in .env, to enable real checkout. Free plans can be selected directly without Stripe.',
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

  // Look up the user's existing subscription (if any) so we can preserve
  // the Stripe Customer link + persist the pending state below.
  const existingSub = await getUserSubscription(auth.user.id);

  // ---- Coupon lookup + validation (BEFORE any Stripe API calls) ----
  // Local DB only. We surface 404 / 400 to the client before reaching out
  // to Stripe so an invalid coupon doesn't create an orphan Session.
  let couponRow: Awaited<ReturnType<typeof db.coupon.findUnique>> = null;
  if (couponCode) {
    const normalizedCode = couponCode.toUpperCase();
    couponRow = await db.coupon.findUnique({ where: { code: normalizedCode } });
    if (!couponRow) {
      return fail('COUPON_NOT_FOUND', `Coupon "${normalizedCode}" was not found.`, 404);
    }
    const planRow = getPlanConfigSync(planId);
    const validation = await validateCoupon(couponCode, planId, planRow.priceMonthly, auth.user.email);
    if (!validation.ok) {
      return fail('COUPON_INVALID', validation.message, 400);
    }
  }

  const appUrl = (await getPublicStripeConfig()).appUrl;
  const stripe = await getStripeClient();

  try {
    // Pre-create or fetch the Stripe Customer so the webhook can attribute
    // the event to the right user BEFORE checkout completes. This always
    // returns a valid customer id (creates one if the user has none).
    const customerId = await getOrCreateStripeCustomer(
      stripe,
      auth.user,
      existingSub?.stripeCustomerId ?? null,
    );

    // Build the Checkout Session params. mode='subscription' for recurring
    // billing. Stripe handles the renewal calendar automatically (monthly
    // periods aligned to the start date, NOT +30 days).
    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success&plan=${planId}&interval=${interval}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
      client_reference_id: auth.user.id,
      customer: customerId,
      customer_update: { address: 'auto' },
      metadata: {
        userId: auth.user.id,
        userEmail: auth.user.email,
        planId,
        interval,
      },
    };

    if (couponRow) {
      // Push the local coupon to Stripe (lazy, cached on the local Coupon
      // row). If stripeCouponId is already set we reuse it; otherwise we
      // create a fresh Stripe Coupon + Promotion Code mirror and persist
      // the IDs back onto the local row so subsequent checkouts skip the
      // mirror step entirely.
      let stripeCouponId = couponRow.stripeCouponId;
      let stripePromotionCodeId = couponRow.stripePromotionCodeId;
      if (!stripeCouponId) {
        const mirror = await createStripeCouponMirror(stripe, couponRow);
        stripeCouponId = mirror.stripeCouponId;
        stripePromotionCodeId = mirror.stripePromotionCodeId;
        await db.coupon.update({
          where: { id: couponRow.id },
          data: { stripeCouponId, stripePromotionCodeId },
        });
      }
      // Apply the coupon directly to the Checkout Session — the customer
      // does NOT need to enter a code at checkout.
      sessionParams.discounts = [{ coupon: stripeCouponId! }];
      sessionParams.allow_promotion_codes = false;
      // Surface the coupon code on the session metadata so the webhook
      // can snapshot it onto the Payment row when the charge succeeds.
      sessionParams.metadata = {
        userId: auth.user.id,
        userEmail: auth.user.email,
        planId,
        interval,
        couponCode: couponRow.code,
      };
    } else {
      // No coupon supplied → let the customer enter a code at checkout
      // via Stripe's built-in promotion code widget (validates against
      // any Promotion Code we created via createStripeCouponMirror).
      sessionParams.allow_promotion_codes = true;
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
  return ok(await getPublicStripeConfig());
}
