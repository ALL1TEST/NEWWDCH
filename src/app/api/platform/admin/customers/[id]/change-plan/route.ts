import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import {
  changeCustomerPlan,
  getCustomer,
  getPlan,
} from '@/lib/platform/platform-data';
import { logAdminAction } from '@/lib/platform/audit';
import {
  isStripeConfiguredAsync,
  getStripeClient,
  cancelStripeSubscription,
  updateSubscriptionPrice,
  resolveStripePriceId,
} from '@/lib/stripe';
import { db } from '@/lib/db';
import { ensurePlanAssignable } from '@/lib/platform/subscription-data';

// ============================================================
// PLATFORM ADMIN → CHANGE CUSTOMER PLAN.
// ============================================================
// Behavior:
//   1. Require PLATFORM_ADMIN / OWNER.
//   2. Route param `id` is the User.id. Look up the user's Subscription
//      row by `userId === id`. 404 if the user / sub row can't be found.
//   3. If the new plan is FREE:
//        - If Stripe is configured AND the sub has a `stripeSubscriptionId`,
//          call `cancelStripeSubscription(stripe, subId, false)` to
//          IMMEDIATELY cancel the Stripe subscription (the user is
//          downgrading away from a paid plan; no proration is collected).
//          On failure → 502 STRIPE_ERROR.
//        - Then write the local DB Subscription row (planId, billingInterval
//          ='monthly', status='active', trialEnd=null) via `changeCustomerPlan`.
//   4. If the new plan is PAID:
//        - If Stripe is NOT configured → 503 PAYMENT_PROVIDER_NOT_CONFIGURED
//          (admin cannot force a paid plan without a payment provider —
//          that would create a paid subscription with no payment method).
//        - If Stripe is configured AND the sub has a `stripeSubscriptionId`:
//          swap the underlying Stripe subscription's Price to the new
//          plan's price for the existing interval (monthly | yearly)
//          via `updateSubscriptionPrice`. On failure → 502 STRIPE_ERROR.
//          If the new plan's Stripe Price ID isn't wired yet → 503
//          STRIPE_PRICE_NOT_CONFIGURED.
//        - If Stripe is configured but no `stripeSubscriptionId` on the
//          row: this is an out-of-band admin assignment (the admin is
//          asserting the customer paid outside the system). Just update
//          the DB row; do not call Stripe.
//   5. `changeCustomerPlan` writes the DB Subscription planId (+ the
//      FREE-plan resets) + best-effort in-memory audit. The route then
//      writes the canonical DB AuditLog row via `logAdminAction`.
//   6. Return the refreshed `await getCustomer(id)`.
// ============================================================

// Plan ids are validated dynamically against the PlanConfig table via
// ensurePlanAssignable() below — custom plans created via Platform Admin
// flow through this route just like free/plus/pro/max.

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const body = (await request.json().catch(() => ({}))) as { planId?: string };
  const planId = body.planId ? String(body.planId) : '';
  if (!planId) {
    return fail('VALIDATION_ERROR', 'A valid planId is required.', 400);
  }
  // Validate against the DB (exists + active). Custom plans created via
  // Platform Admin must flow through here just like the canonical ids.
  const assignable = await ensurePlanAssignable(planId);
  if (!assignable.ok) {
    return fail('PLAN_NOT_AVAILABLE', assignable.reason ?? 'Plan is not available.', 403);
  }

  const before = await getCustomer(id);
  if (!before) return fail('NOT_FOUND', 'Customer not found.', 404);

  const sub = await db.subscription.findUnique({ where: { userId: id } });
  if (!sub) return fail('NOT_FOUND', 'Customer subscription not found.', 404);

  const target = getPlan(planId);

  if (target.isFree) {
    // Downgrade to FREE. If Stripe is configured AND the sub has a
    // stripeSubscriptionId, cancel it immediately (no proration).
    if ((await isStripeConfiguredAsync()) && sub.stripeSubscriptionId) {
      try {
        const stripe = await getStripeClient();
        await cancelStripeSubscription(stripe, sub.stripeSubscriptionId, false);
      } catch (err) {
        const msg = (err as Error).message;
        return fail(
          'STRIPE_ERROR',
          `Unable to cancel Stripe subscription while downgrading to free: ${msg}`,
          502,
        );
      }
    }
  } else {
    // Upgrade / switch to a PAID plan. Requires Stripe to be configured
    // (admin cannot force a paid plan without a payment provider —
    // there would be no payment method on the Stripe subscription).
    if (!(await isStripeConfiguredAsync())) {
      return fail(
        'PAYMENT_PROVIDER_NOT_CONFIGURED',
        'Stripe is not configured. Admin cannot force a paid plan without a payment provider. Configure credentials in Platform Admin → Stripe Settings or use the customer checkout flow.',
        503,
      );
    }
    if (sub.stripeSubscriptionId) {
      // Swap the underlying Stripe subscription's Price to the new
      // plan's price for the existing interval. Proration is created
      // automatically by Stripe.
      const interval = (sub.billingInterval === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly';
      const newPriceId = await resolveStripePriceId(planId, interval);
      if (!newPriceId) {
        return fail(
          'STRIPE_PRICE_NOT_CONFIGURED',
          `Stripe Price ID for plan ${planId} (${interval}) is not configured. Wire it via Platform Admin → Edit Plan.`,
          503,
        );
      }
      try {
        const stripe = await getStripeClient();
        await updateSubscriptionPrice(stripe, sub.stripeSubscriptionId, newPriceId);
      } catch (err) {
        const msg = (err as Error).message;
        return fail(
          'STRIPE_ERROR',
          `Unable to update Stripe subscription price: ${msg}`,
          502,
        );
      }
    }
    // No stripeSubscriptionId on the row but Stripe IS configured: this
    // is an out-of-band admin assignment. Just update the DB row; the
    // admin is asserting the customer has paid outside the system.
  }

  // Apply the DB update (Subscription.planId + FREE resets when target
  // is free) + best-effort in-memory audit. The route then writes the
  // canonical DB AuditLog row via logAdminAction.
  const updated = await changeCustomerPlan(id, planId, auth.user.email);
  if (!updated) return fail('NOT_FOUND', 'Customer not found.', 404);

  await logAdminAction({
    userId: auth.user.id,
    action: 'customer.plan_changed',
    resourceType: 'Customer',
    resourceId: id,
    details: `${updated.name}: ${before.planId ?? '?'}→${planId}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return ok(await getCustomer(id));
}
