// ============================================================
// POST /api/webhooks/stripe — Stripe webhook handler.
// ============================================================
// Stripe is the source of truth for paid subscription state. This route
// receives Stripe events, verifies the signature using
// STRIPE_WEBHOOK_SECRET, and updates the Subscription + Payment tables.
//
// Handled events:
//   - checkout.session.completed → activate the subscription (mark
//     active, set currentPeriodEnd from Stripe's subscription period end,
//     record the Stripe customer + subscription IDs, write a Payment row).
//   - customer.subscription.updated → refresh status + currentPeriodEnd.
//   - customer.subscription.deleted → cancel the subscription (preserve
//     the row for audit; future access reverts to Free).
//   - invoice.paid → record a new Payment row.
//   - invoice.payment_failed → mark the subscription past_due.
//
// When Stripe is NOT configured (no STRIPE_SECRET_KEY), this route
// returns 503 — no events are processed. The platform's free-plan flow
// does not require this webhook.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { activateSubscriptionFromStripe, cancelSubscription } from '@/lib/platform/subscription-data';
import { isStripeConfigured, verifyStripeWebhook, getStripeClient } from '@/lib/stripe';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED', message: 'Stripe is not configured.' } },
      { status: 503 },
    );
  }

  const signature = request.headers.get('stripe-signature') ?? '';
  const rawBody = await request.text();

  const event = await verifyStripeWebhook(rawBody, signature);
  if (!event) {
    return NextResponse.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed.' } },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        await handleSubscriptionUpdated(event);
        break;
      }
      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event);
        break;
      }
      case 'invoice.paid': {
        await handleInvoicePaid(event);
        break;
      }
      case 'invoice.payment_failed': {
        await handleInvoiceFailed(event);
        break;
      }
      default:
        // Unhandled event types are silently ignored (no DB changes).
        break;
    }
    return NextResponse.json({ received: true, type: event.type });
  } catch (err) {
    // Don't leak the error message to the client — Stripe will retry.
    console.error('Stripe webhook handler error:', err);
    return NextResponse.json(
      { error: { code: 'WEBHOOK_HANDLER_ERROR', message: 'Internal handler error.' } },
      { status: 500 },
    );
  }
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
  if (!userId) return;

  const planId = session.metadata?.planId ?? null;
  const interval = session.metadata?.interval === 'yearly' ? 'yearly' : 'monthly';
  if (!planId) return;

  // Look up the Stripe subscription to get the real period end + IDs.
  const stripe = getStripeClient();
  let stripeSub: Stripe.Subscription | null = null;
  if (session.subscription) {
    stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
  }

  // The Stripe SDK 2026-08-26.dahlia type doesn't expose `current_period_end`
  // on Subscription directly, but the API response still includes it. We cast
  // to access it safely.
  const subAny = stripeSub as unknown as { current_period_end?: number; current_period_start?: number } | null;
  const periodEnd = subAny?.current_period_end ? new Date(subAny.current_period_end * 1000) : new Date();
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer && typeof session.customer === 'object' && 'id' in session.customer
      ? session.customer.id
      : '';

  // Build the subscription activation payload.
  await activateSubscriptionFromStripe({
    userId,
    planId,
    billingInterval: interval,
    stripeCustomerId: customerId,
    stripeSubscriptionId: stripeSub?.id ?? (typeof session.subscription === 'string' ? session.subscription : '') ?? '',
    stripeCurrentPeriodEnd: periodEnd,
    status: stripeSub?.status === 'trialing' ? 'trial' : 'active',
    payment:
      session.amount_total && session.amount_total > 0
        ? {
            amount: session.amount_total,
            currency: session.currency ?? 'usd',
            stripeInvoiceId: session.invoice as string | undefined,
          }
        : undefined,
  });
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const userId = sub.metadata?.userId;
  if (!userId) return;

  // Look up the existing subscription row by userId.
  const existing = await db.subscription.findUnique({ where: { userId } });
  if (!existing) return;

  // Compute the effective status.
  const status =
    sub.status === 'trialing'
      ? 'trial'
      : sub.status === 'active'
      ? 'active'
      : sub.status === 'past_due' || sub.status === 'unpaid'
      ? 'past_due'
      : sub.status === 'canceled'
      ? 'cancelled'
      : 'active';

  // The Stripe SDK 2026-08-26.dahlia type doesn't expose current_period_end
  // on Subscription directly; cast to access it safely.
  const subAny = sub as unknown as { current_period_end?: number };
  const customerId =
    typeof sub.customer === 'string'
      ? sub.customer
      : sub.customer && typeof sub.customer === 'object' && 'id' in sub.customer
      ? sub.customer.id
      : existing.stripeCustomerId;

  await db.subscription.update({
    where: { userId },
    data: {
      status,
      currentPeriodEnd: subAny.current_period_end ? new Date(subAny.current_period_end * 1000) : null,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  });
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const userId = sub.metadata?.userId;
  if (!userId) return;
  await cancelSubscription(userId);
}

async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const userId = invoice.metadata?.userId;
  if (!userId) return;
  const planId = invoice.metadata?.planId;
  if (!planId) return;

  // Don't duplicate the payment row if it already exists (Stripe may
  // fire `invoice.paid` multiple times for the same invoice).
  const existing = invoice.id
    ? await db.payment.findFirst({ where: { stripeInvoiceId: invoice.id } })
    : null;
  if (existing) return;

  // Find the user's subscription row.
  const sub = await db.subscription.findUnique({ where: { userId } });
  await db.payment.create({
    data: {
      userId,
      subscriptionId: sub?.id ?? null,
      planId,
      amount: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? 'usd',
      status: 'paid',
      method: 'Stripe',
      invoiceNumber: invoice.number ?? null,
      stripeInvoiceId: invoice.id,
      paidAt: new Date(),
    },
  });
}

async function handleInvoiceFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const userId = invoice.metadata?.userId;
  if (!userId) return;

  // Mark the subscription as past_due (Stripe handles retries; we just
  // reflect the current state).
  const existing = await db.subscription.findUnique({ where: { userId } });
  if (existing) {
    await db.subscription.update({
      where: { userId },
      data: { status: 'past_due' },
    });
  }

  // Record the failed payment attempt.
  const planId = invoice.metadata?.planId;
  if (planId) {
    await db.payment.create({
      data: {
        userId,
        subscriptionId: existing?.id ?? null,
        planId,
        amount: invoice.amount_due ?? 0,
        currency: invoice.currency ?? 'usd',
        status: 'failed',
        method: 'Stripe',
        invoiceNumber: invoice.number ?? null,
        stripeInvoiceId: invoice.id,
      },
    });
  }
}
