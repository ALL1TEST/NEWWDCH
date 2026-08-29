import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { getClientBillingAsync } from '@/lib/platform/platform-data';
import { isStripeConfigured, getStripeClient, cancelStripeSubscription } from '@/lib/stripe';
import { db } from '@/lib/db';

// ============================================================
// CLIENT BILLING → CANCEL SUBSCRIPTION.
// ============================================================
// Behavior:
//   1. Look up the user's Subscription row (DB is the source of truth).
//   2. Idempotent: if the row is already 'cancelled' → return the
//      refreshed ClientBillingState immediately (no Stripe call).
//   3. If Stripe is configured AND the row has a `stripeSubscriptionId`,
//      call Stripe's `cancelStripeSubscription(stripe, subId, true)` to
//      SCHEDULE cancellation at period end — the customer keeps access
//      until the current period ends; the `customer.subscription.deleted`
//      webhook will fire at the actual end and finalize the local row
//      (with `immediatelyUnlinkStripe: true`).
//   4. Update the local DB Subscription row: status 'cancelled' (here it
//      means "scheduled for cancellation"), `cancelAt: now`, KEEP
//      `currentPeriodEnd` and `stripeSubscriptionId` so the dashboard
//      shows the right renewal/cancel date until the webhook finalizes.
//   5. If no Subscription row exists → 404.
//   6. On Stripe error → 502 with code `STRIPE_ERROR` and the message.
// ============================================================

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;

  // Look up the user's subscription row (DB is the source of truth).
  const sub = await db.subscription.findUnique({ where: { userId: auth.user.id } });
  if (!sub) return fail('NOT_FOUND', 'No subscription found for this account.', 404);

  // Idempotent: already cancelled → return current state.
  if (sub.status === 'cancelled') {
    return ok(await getClientBillingAsync(auth.user));
  }

  // If Stripe is configured and we have a stripeSubscriptionId, schedule
  // cancellation at period end via Stripe. This preserves the customer's
  // access until the current period ends; the customer.subscription.deleted
  // webhook will fire at the actual end and call cancelSubscription(userId)
  // (with the default immediatelyUnlinkStripe=true) to finalize the local
  // row.
  if (isStripeConfigured() && sub.stripeSubscriptionId) {
    try {
      const stripe = getStripeClient();
      await cancelStripeSubscription(stripe, sub.stripeSubscriptionId, true);
    } catch (err) {
      const msg = (err as Error).message;
      return fail('STRIPE_ERROR', `Unable to cancel Stripe subscription: ${msg}`, 502);
    }
  }

  // Update the local DB row: status 'cancelled' (means "scheduled" if
  // Stripe is still active, or "final" if no Stripe), keep the
  // stripeSubscriptionId and currentPeriodEnd so the dashboard shows the
  // right renewal/cancel date until the webhook finalizes.
  await db.subscription.update({
    where: { userId: auth.user.id },
    data: { status: 'cancelled', cancelAt: new Date() },
  });

  return ok(await getClientBillingAsync(auth.user));
}
