import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { isStripeConfiguredAsync, getStripeClient, cancelStripeSubscription } from '@/lib/stripe';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/platform/audit';
import { getCustomer } from '@/lib/platform/platform-data';

// ============================================================
// PLATFORM ADMIN → CANCEL CUSTOMER SUBSCRIPTION.
// ============================================================
// Behavior:
//   1. Require PLATFORM_ADMIN / OWNER.
//   2. Route param `id` is the User.id (NOT the Subscription.id, NOT the
//      legacy mock cus_ id). Look up the user's Subscription row by
//      `userId === id`.
//   3. If no Subscription row → 404.
//   4. Idempotent: if the row is already 'cancelled' → skip the Stripe +
//      DB update steps (still audit-log the request + return the
//      refreshed customer).
//   5. If Stripe is configured AND the row has a `stripeSubscriptionId`,
//      call Stripe's `cancelStripeSubscription(stripe, subId, true)` to
//      SCHEDULE cancellation at period end (the customer keeps access
//      until the current period ends; the `customer.subscription.deleted`
//      webhook will fire later and finalize the local row).
//   6. Update the local DB Subscription row: status 'cancelled'
//      (means "scheduled"), `cancelAt: now`, KEEP `currentPeriodEnd`
//      and `stripeSubscriptionId` so the admin Customers table shows
//      the right renewal/cancel date until the webhook finalizes.
//   7. Audit-log + return the refreshed customer.
//
// `getCustomer` is being made async by Task 78-D; awaiting it works
// whether it returns a Customer or a Promise<Customer>.
// ============================================================

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;

  // Look up the user's subscription row.
  const sub = await db.subscription.findUnique({ where: { userId: id } });
  if (!sub) return fail('NOT_FOUND', 'Customer subscription not found.', 404);

  // Idempotent: only do the Stripe call + DB update if NOT already cancelled.
  if (sub.status !== 'cancelled') {
    // If Stripe is configured and we have a stripeSubscriptionId, schedule
    // cancellation at period end via Stripe.
    if ((await isStripeConfiguredAsync()) && sub.stripeSubscriptionId) {
      try {
        const stripe = await getStripeClient();
        await cancelStripeSubscription(stripe, sub.stripeSubscriptionId, true);
      } catch (err) {
        const msg = (err as Error).message;
        return fail('STRIPE_ERROR', `Unable to cancel Stripe subscription: ${msg}`, 502);
      }
    }

    // Update the local DB row (status 'cancelled' = "scheduled" if Stripe
    // is still active; "final" if no Stripe). KEEP currentPeriodEnd +
    // stripeSubscriptionId so the admin Customers table shows the right
    // renewal/cancel date until the webhook finalizes.
    await db.subscription.update({
      where: { userId: id },
      data: { status: 'cancelled', cancelAt: new Date() },
    });
  }

  await logAdminAction({
    userId: auth.user.id,
    action: 'customer.subscription_cancelled',
    resourceType: 'Customer',
    resourceId: id,
    details: `User ${id} subscription ${sub.stripeSubscriptionId ?? '(local)'} cancelled (at period end)`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return ok(await getCustomer(id));
}
