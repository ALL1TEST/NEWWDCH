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
//     Charge ID, + payment-method metadata). Also best-effort copies the
//     session-level discount snapshot onto the just-created Payment row
//     (the invoice.paid handler will overwrite it with the authoritative
//     value).
//   - customer.subscription.updated      → refresh status + currentPeriodEnd.
//   - customer.subscription.created      → refresh status + currentPeriodEnd.
//   - customer.subscription.deleted      → cancel the subscription
//     (preserve the row for audit; future access reverts to Free).
//   - invoice.paid                      → record a new Payment row with
//     the full Stripe relational + payment-method metadata, AND record
//     the coupon applied (CouponRedemption audit row + Coupon.timesRedeemed
//     increment + Payment.couponCode/discountAmount snapshot).
//   - invoice.payment_failed            → mark the subscription past_due
//     + record a failed Payment row with the failure reason.
//   - payment_intent.succeeded           → record a one-time / orphan
//     Payment (deduped by stripePaymentIntentId so it never duplicates
//     an invoice.paid / checkout row for the same PI).
//   - payment_intent.payment_failed      → record a failed one-time
//     Payment with the failure reason.
//   - charge.refunded                    → mark the existing Payment row
//     as 'refunded' (full) or annotate 'Partial refund processed: ...'
//     (partial). Deduped by stripeChargeId, falling back to PI id.
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
// IDEMPOTENCY: Stripe retries events up to 3 days. Before dispatching
// any handler, this route inserts a row into the WebhookEvent ledger
// (unique on stripeEventId). If the insert returns false (duplicate),
// the event is ack'd and skipped — never re-processed. If a handler
// throws after the ledger insert succeeds, the ledger row is updated
// to outcome='error' + errorMessage (best-effort). Stripe will retry.
//
// When Stripe is NOT configured (no STRIPE_SECRET_KEY), this route
// returns 503 — no events are processed. The platform's free-plan flow
// does not require this webhook.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { activateSubscriptionFromStripe, cancelSubscription } from '@/lib/platform/subscription-data';
import {
  isStripeConfiguredAsync,
  verifyStripeWebhook,
  getStripeClient,
  markWebhookEventProcessed,
  extractInvoiceCoupon,
} from '@/lib/stripe';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  if (!(await isStripeConfiguredAsync())) {
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

  // -------------------- Idempotency ledger --------------------
  // Stripe retries events up to 3 days; we MUST NOT process the same
  // evt_... twice. Insert a WebhookEvent row (unique on stripeEventId)
  // BEFORE dispatching the handler. If the insert returns false, the
  // event was already processed → ack and skip. The ledger insert
  // happens BEFORE processing so a crash mid-processing doesn't cause
  // a re-process on retry.
  const stripeEventId = event.id;
  const eventType = event.type;
  const apiVersion = event.api_version ?? null;
  const objectId =
    (event.data.object as unknown as { id?: string | null } | null)?.id ?? null;

  const isNewEvent = await markWebhookEventProcessed({
    stripeEventId,
    eventType,
    apiVersion,
    objectId,
    outcome: 'processed',
  });
  if (!isNewEvent) {
    // Duplicate event — already processed on a previous delivery.
    return NextResponse.json({ received: true, type: event.type, duplicate: true });
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
      case 'charge.refunded': {
        await handleChargeRefunded(event);
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
    // Best-effort: mark the ledger row as errored so we can see it in
    // the admin ledger view. Never mask the original error — if the
    // update itself fails, log it and continue.
    try {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await db.webhookEvent.update({
        where: { stripeEventId },
        data: {
          outcome: 'error',
          errorMessage: errorMessage.slice(0, 1000),
        },
      });
    } catch (ledgerErr) {
      console.error('Stripe webhook: failed to mark ledger row as errored:', ledgerErr);
    }
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

// -------------------- Coupon helpers --------------------

/** Best-effort: extract the discount applied to a Checkout Session's
 *  `total_details.discount`. Returns { couponCode, discountAmount } or null
 *  when the session had no discount.
 *
 *  The Stripe API exposes the discount as a Discount object whose `coupon`
 *  carries the Stripe Coupon id (e.g. "kUW0yO9r") — NOT the customer-facing
 *  code. We try to resolve the local customer-facing code from the Coupon
 *  table by stripeCouponId; if not found, we fall back to the Stripe coupon
 *  id. The authoritative coupon snapshot is set by the invoice.paid handler
 *  (which has the richer invoice-level discount) — this is a best-effort
 *  pre-population that gets overwritten. */
async function extractSessionDiscount(
  session: Stripe.Checkout.Session,
): Promise<{ couponCode: string | null; discountAmount: number | null } | null> {
  try {
    const totalDetails = session.total_details as unknown as {
      discount?: {
        coupon?: {
          id?: string;
          name?: string | null;
          percent_off?: number | null;
          amount_off?: number | null;
          currency?: string | null;
        } | null;
      } | null;
    } | null;
    const coupon = totalDetails?.discount?.coupon;
    if (!coupon?.id) return null;

    // Try to resolve the local customer-facing coupon code from the
    // Coupon table by stripeCouponId. (stripeCouponId is not unique in
    // the local schema — it's an index — so we use findFirst.)
    let couponCode: string | null = coupon.id;
    try {
      const local = await db.coupon.findFirst({
        where: { stripeCouponId: coupon.id },
        select: { code: true },
      });
      if (local?.code) couponCode = local.code;
    } catch {
      // ignore — fall back to Stripe coupon id (best-effort).
    }

    return {
      couponCode,
      discountAmount: coupon.amount_off ?? null,
    };
  } catch {
    return null;
  }
}

/** Record the coupon applied to an invoice onto the Payment + the local
 *  Coupon/CouponRedemption tables. Called from `handleInvoicePaid` AFTER
 *  the Payment row is created (or, when the payment row already exists
 *  from a previous event, against that existing row id).
 *
 *  Steps (all best-effort, never throws — the core payment-row creation
 *  is already done by the time this runs):
 *    1. extractInvoiceCoupon(invoice) → { couponCode, stripeCouponId, discountAmount }
 *    2. db.payment.update → set couponCode + discountAmount on the Payment row.
 *    3. db.coupon.findUnique({ where: { code } }) → resolve the local Coupon.
 *    4. Idempotency check: only increment timesRedeemed if no CouponRedemption
 *       row exists for this (couponId, userId, stripeEventId) tuple.
 *    5. db.coupon.update → increment timesRedeemed (idempotent).
 *    6. db.couponRedemption.create → audit row. Wrap in try/catch —
 *       unique-violation on stripeEventId means a parallel event already
 *       created the row; skip silently. */
async function recordInvoiceCoupon(
  event: Stripe.Event,
  invoice: Stripe.Invoice,
  paymentId: string,
  userId: string,
): Promise<void> {
  try {
    const couponInfo = extractInvoiceCoupon(invoice);
    if (!couponInfo || !couponInfo.couponCode) return;

    // 1. Set couponCode + discountAmount on the Payment row.
    try {
      await db.payment.update({
        where: { id: paymentId },
        data: {
          couponCode: couponInfo.couponCode,
          discountAmount: couponInfo.discountAmount ?? null,
        },
      });
    } catch (e) {
      console.error('Stripe webhook: failed to set coupon snapshot on Payment row:', e);
    }

    // 2. Resolve the local Coupon row by code.
    let coupon: { id: string } | null = null;
    try {
      coupon = await db.coupon.findUnique({
        where: { code: couponInfo.couponCode },
        select: { id: true },
      });
    } catch (e) {
      console.error('Stripe webhook: failed to look up local Coupon by code:', e);
    }
    if (!coupon) return; // no local Coupon to increment — best-effort, skip.

    // 3. Idempotency: only increment timesRedeemed if no CouponRedemption
    //    row exists for this (couponId, userId, stripeEventId) tuple.
    const stripeEventId = event.id;
    let alreadyRedeemed = false;
    try {
      const existingRedemption = await db.couponRedemption.findFirst({
        where: { couponId: coupon.id, userId, stripeEventId },
        select: { id: true },
      });
      alreadyRedeemed = !!existingRedemption;
    } catch (e) {
      console.error('Stripe webhook: failed to check existing CouponRedemption:', e);
    }

    if (!alreadyRedeemed) {
      try {
        await db.coupon.update({
          where: { id: coupon.id },
          data: { timesRedeemed: { increment: 1 } },
        });
      } catch (e) {
        console.error('Stripe webhook: failed to increment Coupon.timesRedeemed:', e);
      }
    }

    // 4. Create the CouponRedemption audit row. Unique-violation on
    //    stripeEventId (a parallel event already created the row) is
    //    swallowed — log and skip. Never block the payment row.
    try {
      await db.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId,
          stripeEventId,
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId:
            typeof invoice.subscription === 'string' ? invoice.subscription : null,
          amountOff: couponInfo.discountAmount ?? 0,
          currency: invoice.currency ?? 'usd',
        },
      });
    } catch (e) {
      console.error(
        'Stripe webhook: CouponRedemption insert failed (likely duplicate event — swallowed):',
        e,
      );
    }
  } catch (e) {
    // Best-effort — never let coupon recording break the webhook.
    console.error('Stripe webhook: coupon recording failed (best-effort, swallowed):', e);
  }
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
  const stripe = await getStripeClient();
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

  // Best-effort: pass the session-level discount snapshot along to the
  // just-created Payment row. We do NOT write a CouponRedemption row
  // here — the coupon snapshot lives on the invoice that fires
  // `invoice.paid`, and that handler will set the authoritative value
  // (which overwrites whatever we set here).
  if (session.amount_total && session.amount_total > 0) {
    try {
      const sessionDiscount = await extractSessionDiscount(session);
      if (sessionDiscount && sessionDiscount.couponCode) {
        // Find the just-created Payment row by invoice / PI id.
        const justCreated = await findExistingPayment(
          typeof session.invoice === 'string' ? session.invoice : null,
          piId,
        );
        if (justCreated) {
          await db.payment.update({
            where: { id: justCreated.id },
            data: {
              couponCode: sessionDiscount.couponCode,
              discountAmount: sessionDiscount.discountAmount ?? null,
            },
          });
        }
      }
    } catch (e) {
      console.error(
        'Stripe webhook: failed to set session-discount snapshot on Payment row (best-effort):',
        e,
      );
    }
  }
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
  if (existing) {
    // Even when the payment row already exists (e.g. from a previous
    // event for the same underlying charge), record the coupon snapshot
    // + redemption audit if the invoice had a discount.
    await recordInvoiceCoupon(event, invoice, existing.id, userId);
    return;
  }

  // Fetch the payment-method metadata for the full relational record.
  const stripe = await getStripeClient();
  const meta = await fetchPaymentMethodMeta(stripe, piId);

  // Find the user's subscription row.
  const sub = await db.subscription.findUnique({ where: { userId } });
  const payment = await db.payment.create({
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

  // Coupon recording — best-effort, never blocks the payment row creation
  // (the row was already created above). Sets couponCode/discountAmount on
  // the just-created Payment row, increments the local Coupon.timesRedeemed
  // (idempotent), and creates a CouponRedemption audit row (idempotent).
  await recordInvoiceCoupon(event, invoice, payment.id, userId);
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
  const stripe = await getStripeClient();
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
  const stripe = await getStripeClient();
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
  const stripe = await getStripeClient();
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

/** charge.refunded — updates the existing Payment row to reflect a refund.
 *  Full refund → status='refunded'. Partial refund → keep current status
 *  but annotate 'Partial refund processed: <amount_refunded> <currency>'.
 *  Deduped by stripeChargeId, falling back to PI id. Never creates a
 *  duplicate Payment row — the original row is updated in place. If no
 *  Payment row exists for the charge (orphan charge that never created
 *  one), returns silently. */
async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;

  // Find the existing Payment row by charge id, falling back to PI id.
  let payment = await db.payment.findFirst({ where: { stripeChargeId: charge.id } });
  if (!payment) {
    const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
    if (piId) {
      payment = await db.payment.findFirst({ where: { stripePaymentIntentId: piId } });
    }
  }
  if (!payment) {
    // Orphan charge (no Payment row ever created) — silently ignore.
    return;
  }

  // The Stripe SDK 2026-08-26.dahlia type may not expose `refunded` /
  // `amount_refunded` on Charge in all API versions; cast to access
  // them safely.
  const chargeAny = charge as unknown as {
    refunded?: boolean;
    amount_refunded?: number;
    amount?: number;
    currency?: string;
  };
  const fullyRefunded = chargeAny.refunded === true;
  const amountRefunded = chargeAny.amount_refunded ?? 0;
  const currency = (chargeAny.currency ?? charge.currency ?? 'usd').toUpperCase();

  if (fullyRefunded) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded' },
    });
  } else {
    // Partial refund — keep current status but record a memo so the
    // admin Payments table can show "Partial refund processed: …".
    await db.payment.update({
      where: { id: payment.id },
      data: {
        description: `Partial refund processed: ${amountRefunded} ${currency}`,
      },
    });
  }
}
