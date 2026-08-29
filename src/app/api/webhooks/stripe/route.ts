// ============================================================
// POST /api/webhooks/stripe — Stripe webhook handler.
// ============================================================
// Stripe is the source of truth for paid subscription state. This route
// receives Stripe events, verifies the signature using
// STRIPE_WEBHOOK_SECRET, and updates the Subscription + Payment tables.
//
// Handled events:
//   - checkout.session.completed        → activate the subscription
//     (mark active, set currentPeriodEnd from Stripe's subscription
//     period end, record the Stripe customer + subscription IDs, write
//     a FULLY-relational Payment row: Invoice ID, PaymentIntent ID,
//     Charge ID, + payment-method metadata).
//   - customer.subscription.updated      → refresh status + currentPeriodEnd.
//   - customer.subscription.deleted      → cancel the subscription
//     (preserve the row for audit; future access reverts to Free).
//   - invoice.paid                      → record a new Payment row with
//     the full Stripe relational + payment-method metadata.
//   - invoice.payment_failed            → mark the subscription past_due
//     + record a failed Payment row with the failure reason.
//   - payment_intent.succeeded           → record a one-time / orphan
//     Payment (deduped by stripePaymentIntentId so it never duplicates
//     an invoice.paid / checkout row for the same PI).
//   - payment_intent.payment_failed      → record a failed one-time
//     Payment with the failure reason.
//
// Every Payment row written here carries: userId (Customer), planId
// (Plan), subscriptionId (Subscription), stripeInvoiceId (Invoice),
// stripePaymentIntentId + stripeChargeId (Stripe transaction), and
// paymentMethodType + paymentMethodDetails (payment-method metadata) —
// so the admin Payments table, the customer detail view, and the
// Dashboard always reflect the real Stripe state. Payments reads these
// rows; Plans & Pricing reads PlanConfig; the webhook keeps them in
// sync with Stripe.
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
      case 'payment_intent.succeeded': {
        await handlePaymentIntentSucceeded(event);
        break;
      }
      case 'payment_intent.payment_failed': {
        await handlePaymentIntentFailed(event);
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

// -------------------- Payment-method metadata fetcher --------------------

/** The normalized payment-method details extracted from a Stripe Charge's
 *  `payment_method_details`. Stored as JSON on the Payment row so the admin
 *  Payments table can show "Visa ••4242" / brand / last4 / exp / funding /
 *  country — the real payment-method metadata, never fabricated. */
interface PaymentMethodMeta {
  stripeChargeId: string | null;
  paymentMethodType: string | null;
  paymentMethodDetails: string | null; // JSON
  method: string | null; // display label, e.g. "Visa ••4242"
}

/** Fetch the latest Charge on a PaymentIntent and extract the
 *  payment-method metadata. Returns null when the PI has no charge yet
 *  (e.g. some pending states). Never throws — the caller treats null as
 *  "no metadata available" and still records the payment. */
async function fetchPaymentMethodMeta(
  stripe: Stripe,
  paymentIntentId: string | null | undefined,
): Promise<PaymentMethodMeta | null> {
  if (!paymentIntentId) return null;
  try {
    const pi = (await stripe.paymentIntents.retrieve(paymentIntentId, {
      // Expand the latest charge so we can read payment_method_details
      // without a second round-trip. Cast because the dahlia API version
      // type doesn't expose `latest_charge` on PaymentIntent directly,
      // but the API response includes it.
      expand: ['latest_charge' as string],
    })) as unknown as {
      latest_charge?:
        | string
        | {
            id: string;
            payment_method_details?: {
              type: string;
              card?: {
                brand?: string | null;
                last4?: string | null;
                exp_month?: number | null;
                exp_year?: number | null;
                funding?: string | null;
                country?: string | null;
              } | null;
            } | null;
          };
    };

    const charge = pi.latest_charge;
    if (!charge) return null;

    const stripeChargeId = typeof charge === 'string' ? charge : charge.id;
    const pmd = typeof charge === 'string' ? null : charge.payment_method_details ?? null;

    if (!pmd) {
      return { stripeChargeId, paymentMethodType: null, paymentMethodDetails: null, method: null };
    }

    if (pmd.type === 'card' && pmd.card) {
      const c = pmd.card;
      const details = {
        brand: c.brand ?? null,
        last4: c.last4 ?? null,
        expMonth: c.exp_month ?? null,
        expYear: c.exp_year ?? null,
        funding: c.funding ?? null,
        country: c.country ?? null,
      };
      const method =
        c.brand && c.last4 ? `${cap(c.brand)} ••${c.last4}` : c.brand ? cap(c.brand) : null;
      return {
        stripeChargeId,
        paymentMethodType: 'card',
        paymentMethodDetails: JSON.stringify(details),
        method,
      };
    }

    // Non-card payment methods (ach_debit, sepa_debit, link, ...): record
    // the type; no brand/last4 to extract.
    return {
      stripeChargeId,
      paymentMethodType: pmd.type,
      paymentMethodDetails: null,
      method: cap(pmd.type),
    };
  } catch {
    // Retrieval failed (PI not found, network error, ...). Don't block
    // the payment row creation — return null so the caller still writes
    // the core fields (invoice / PI / amount).
    return null;
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// -------------------- Dedup helper --------------------

/** Find an existing Payment row by Stripe Invoice ID OR PaymentIntent ID.
 *  Stripe may fire `invoice.paid` + `payment_intent.succeeded` +
 *  `checkout.session.completed` for the same underlying payment — dedup
 *  by these IDs so a single real-world payment never creates duplicate
 *  rows. Returns the existing row or null. */
async function findExistingPayment(stripeInvoiceId?: string | null, stripePaymentIntentId?: string | null) {
  if (stripeInvoiceId) {
    const byInvoice = await db.payment.findFirst({ where: { stripeInvoiceId } });
    if (byInvoice) return byInvoice;
  }
  if (stripePaymentIntentId) {
    const byPi = await db.payment.findFirst({ where: { stripePaymentIntentId } });
    if (byPi) return byPi;
  }
  return null;
}

// -------------------- Event handlers --------------------

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

  // Fetch the payment-method metadata from the session's PaymentIntent so
  // the recorded Payment row carries the full relational + card details.
  const piId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
  const meta = await fetchPaymentMethodMeta(stripe, piId);

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
            stripeInvoiceId: typeof session.invoice === 'string' ? session.invoice : undefined,
            stripePaymentIntentId: piId ?? undefined,
            stripeChargeId: meta?.stripeChargeId ?? undefined,
            paymentMethodType: meta?.paymentMethodType ?? undefined,
            paymentMethodDetails: meta?.paymentMethodDetails ?? undefined,
            method: meta?.method ?? 'Stripe',
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

  // PaymentIntent id on the invoice (may be a string or null for some
  // invoice types, e.g. pre-payment).
  const piId =
    typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : null;

  // Don't duplicate the payment row if it already exists (Stripe may
  // fire `invoice.paid` + `payment_intent.succeeded` for the same charge).
  // Dedup by invoice id OR payment-intent id.
  const existing = await findExistingPayment(invoice.id, piId);
  if (existing) return;

  // Fetch the payment-method metadata for the full relational record.
  const stripe = getStripeClient();
  const meta = await fetchPaymentMethodMeta(stripe, piId);

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
      method: meta?.method ?? 'Stripe',
      invoiceNumber: invoice.number ?? null,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: piId,
      stripeChargeId: meta?.stripeChargeId ?? null,
      paymentMethodType: meta?.paymentMethodType ?? null,
      paymentMethodDetails: meta?.paymentMethodDetails ?? null,
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

  const planId = invoice.metadata?.planId;
  if (!planId) return;

  const piId = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null;

  // Don't duplicate a failed row if one already exists for this invoice/PI.
  const existingPayment = await findExistingPayment(invoice.id, piId);
  if (existingPayment) return;

  // Fetch payment-method metadata + the failure reason for the description.
  const stripe = getStripeClient();
  const meta = await fetchPaymentMethodMeta(stripe, piId);
  let failureReason: string | null = null;
  if (piId) {
    try {
      const pi = (await stripe.paymentIntents.retrieve(piId)) as unknown as {
        last_payment_error?: { message?: string } | null;
      };
      failureReason = pi.last_payment_error?.message ?? null;
    } catch {
      // ignore — failure reason is best-effort
    }
  }

  await db.payment.create({
    data: {
      userId,
      subscriptionId: existing?.id ?? null,
      planId,
      amount: invoice.amount_due ?? 0,
      currency: invoice.currency ?? 'usd',
      status: 'failed',
      method: meta?.method ?? 'Stripe',
      invoiceNumber: invoice.number ?? null,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: piId,
      stripeChargeId: meta?.stripeChargeId ?? null,
      paymentMethodType: meta?.paymentMethodType ?? null,
      paymentMethodDetails: meta?.paymentMethodDetails ?? null,
      description: failureReason,
    },
  });
}

/** payment_intent.succeeded — captures a one-time / orphan charge that
 *  isn't tied to a subscription invoice (or acts as a dedup-safe mirror
 *  of an invoice.paid that already recorded the same PI). Never
 *  duplicates because findExistingPayment dedups by PI id. */
async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const pi = event.data.object as Stripe.PaymentIntent;
  const userId = pi.metadata?.userId;
  if (!userId) return;

  // Dedup against any row already created by invoice.paid /
  // checkout.session.completed for this PI.
  const existing = await findExistingPayment(null, pi.id);
  if (existing) return;

  // Determine the planId: prefer metadata, else fall back to the user's
  // current subscription's plan.
  let planId = pi.metadata?.planId ?? null;
  if (!planId) {
    const sub = await db.subscription.findUnique({ where: { userId } });
    planId = sub?.planId ?? null;
  }
  if (!planId) return; // can't attribute to a plan → skip

  const sub = await db.subscription.findUnique({ where: { userId } });
  const stripe = getStripeClient();
  const meta = await fetchPaymentMethodMeta(stripe, pi.id);

  await db.payment.create({
    data: {
      userId,
      subscriptionId: sub?.id ?? null,
      planId,
      amount: pi.amount_received ?? pi.amount ?? 0,
      currency: pi.currency ?? 'usd',
      status: 'paid',
      method: meta?.method ?? 'Stripe',
      stripePaymentIntentId: pi.id,
      stripeChargeId: meta?.stripeChargeId ?? null,
      paymentMethodType: meta?.paymentMethodType ?? null,
      paymentMethodDetails: meta?.paymentMethodDetails ?? null,
      description: pi.description ?? null,
      paidAt: new Date(),
    },
  });
}

/** payment_intent.payment_failed — records a failed one-time charge with
 *  the failure reason. Deduped by PI id. */
async function handlePaymentIntentFailed(event: Stripe.Event) {
  const pi = event.data.object as Stripe.PaymentIntent;
  const userId = pi.metadata?.userId;
  if (!userId) return;

  const existing = await findExistingPayment(null, pi.id);
  if (existing) return;

  let planId = pi.metadata?.planId ?? null;
  if (!planId) {
    const sub = await db.subscription.findUnique({ where: { userId } });
    planId = sub?.planId ?? null;
  }
  if (!planId) return;

  const sub = await db.subscription.findUnique({ where: { userId } });
  const stripe = getStripeClient();
  const meta = await fetchPaymentMethodMeta(stripe, pi.id);

  const piAny = pi as unknown as { last_payment_error?: { message?: string } | null };
  const failureReason = piAny.last_payment_error?.message ?? null;

  await db.payment.create({
    data: {
      userId,
      subscriptionId: sub?.id ?? null,
      planId,
      amount: pi.amount ?? 0,
      currency: pi.currency ?? 'usd',
      status: 'failed',
      method: meta?.method ?? 'Stripe',
      stripePaymentIntentId: pi.id,
      stripeChargeId: meta?.stripeChargeId ?? null,
      paymentMethodType: meta?.paymentMethodType ?? null,
      paymentMethodDetails: meta?.paymentMethodDetails ?? null,
      description: failureReason,
    },
  });
}
