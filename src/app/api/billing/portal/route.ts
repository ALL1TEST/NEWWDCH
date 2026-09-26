// ============================================================
// POST /api/billing/portal — create a Stripe Customer Portal
// session for the authenticated user.
// ============================================================
// Behavior:
//   - Lets a SUBSCRIBED customer manage their real Stripe payment
//     data (payment method, card details, billing information and
//     other Stripe-supported payment settings) on Stripe's hosted
//     Customer Portal — we NEVER build a local/fake payment-method
//     page.
//   - Auth: requireAuth (session cookie). The Stripe Customer is
//     resolved SERVER-SIDE from the user's own subscription row
//     (Subscription.stripeCustomerId) or created via the SAME
//     getOrCreateStripeCustomer helper the checkout route uses —
//     the client cannot influence which customer is opened.
//   - If a Stripe Customer id was missing on the subscription row
//     and had to be created, it is persisted back onto the row so
//     future sessions (checkout, portal, webhooks) reuse it.
//   - If STRIPE_SECRET_KEY is not configured (no DB StripeSettings
//     row, no env) → 503 PAYMENT_PROVIDER_NOT_CONFIGURED with a
//     clear message — the SAME honest behavior as checkout; we
//     never fake a portal URL.
//   - The return URL is `${appUrl}/#billing` — the SAME appUrl
//     source checkout uses (DB StripeSettings → env fallback), so
//     the customer lands back on Billing & Subscription.
//   - Only the portal session URL is returned to the client. No
//     Stripe secret key ever leaves the server.
// ============================================================

import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { getUserSubscription } from '@/lib/platform/subscription-data';
import {
  isStripeConfiguredAsync,
  getStripeClient,
  getPublicStripeConfig,
  getOrCreateStripeCustomer,
} from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;

  // Stripe must be configured — identical gate (and error shape) to
  // /api/billing/checkout. NEVER fake a portal URL.
  if (!(await isStripeConfiguredAsync())) {
    return fail(
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
      'Stripe is not configured on this platform. Connect your Stripe account in Platform Admin → Stripe Settings, or set STRIPE_SECRET_KEY in .env, to enable payment management.',
      503,
    );
  }

  try {
    const stripe = await getStripeClient();
    const appUrl = (await getPublicStripeConfig()).appUrl;

    // Resolve the user's Stripe Customer SERVER-SIDE: prefer the
    // customer id stored on their own subscription row; create the
    // customer (same helper as checkout) when none exists yet.
    const existingSub = await getUserSubscription(auth.user.id);
    const customerId = await getOrCreateStripeCustomer(
      stripe,
      auth.user,
      existingSub?.stripeCustomerId ?? null,
    );

    // Persist a newly-created customer id back onto the subscription
    // row so future checkout/portal sessions and webhooks reuse the
    // SAME Stripe customer (matches how the checkout webhook links
    // them).
    if (existingSub && !existingSub.stripeCustomerId) {
      await db.subscription.update({
        where: { userId: auth.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create the Billing Portal session. When no configuration_id is
    // passed Stripe uses the account's default portal configuration
    // (test mode ships one; live mode requires the admin to have
    // created one in the Stripe dashboard — a Stripe error here is
    // surfaced verbatim below).
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/#billing`,
    });

    return ok({ url: session.url });
  } catch (err) {
    return fail(
      'STRIPE_ERROR',
      `Stripe Customer Portal session creation failed: ${(err as Error).message}`,
      502,
    );
  }
}
