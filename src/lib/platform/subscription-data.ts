// ============================================================
// SUBSCRIPTION DATA — real DB-backed subscription + payment state.
// ============================================================
// This is the SINGLE source of truth for a customer's current plan,
// billing interval, status, renewal date, trial expiration, and
// payment history. The Client Billing dashboard, checkout, webhooks,
// entitlements, and usage-limit checks all read from here.
//
// Calendar-based periods (NOT +30 days):
//   - monthly subscription → next billing = startDate + 1 calendar month
//   - yearly subscription  → next billing = startDate + 1 calendar year
//
// Free plan duration:
//   - PlanConfig.freePlanDurationDays = null → unlimited (no expiration)
//   - PlanConfig.freePlanDurationDays = N (>0) → trial expires N days
//     after startDate. After expiration, gated features are blocked
//     server-side (entitlements.ts → hasFeature checks this).
//
// Stripe:
//   - When STRIPE_SECRET_KEY is set, webhooks update the Subscription
//     row (stripeSubscriptionId, currentPeriodEnd, status). The client
//     billing dashboard reads those fields directly.
//   - When STRIPE_SECRET_KEY is NOT set, only free or no-charge plan
//     subscriptions can be created (createOrUpdateForFreePlan).
// ============================================================

import { db } from '@/lib/db';
import { getPlanConfigSync, type PlanConfigData, type BillingInterval } from './plan-config';
import { hasBillingBypass, type EntitlementUser } from './entitlements';

// -------------------- Types --------------------

export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'cancelled' | 'expired';

export interface SubscriptionRow {
  id: string;
  userId: string;
  planId: string;
  billingInterval: BillingInterval;
  status: SubscriptionStatus;
  startDate: Date;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAt: Date | null;
  freePlanDurationDays: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRow {
  id: string;
  userId: string;
  subscriptionId: string | null;
  planId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  method: string | null;
  invoiceNumber: string | null;
  stripeInvoiceId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface ClientSubscriptionState {
  /** null when the user has no subscription row (e.g. a fresh account). */
  subscription: SubscriptionRow | null;
  plan: PlanConfigData;
  status: SubscriptionStatus | 'none';
  billingInterval: BillingInterval;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  freeTrialExpiresAt: string | null;
  freeTrialExpired: boolean;
  /** True when the user is on a free plan with a limited trial that has expired. */
  requiresPlanAction: boolean;
}

// -------------------- Calendar helpers --------------------

/**
 * Add N calendar months to a date. Preserves day-of-month when possible;
 * clamps to end-of-month if the target month is shorter (e.g. Jan 31 + 1
 * month = Feb 28/29). This is what Stripe does for monthly billing.
 */
export function addCalendarMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // If the day overflowed (e.g. Jan 31 → Mar 3), clamp back to last day
  // of the target month.
  const expectedMonth = ((date.getMonth() + months) % 12 + 12) % 12;
  if (d.getMonth() !== expectedMonth && d.getMonth() !== (expectedMonth + (date.getMonth() + months >= 12 ? 12 : 0))) {
    // Simpler approach: if month rolled over, set to last day of previous month.
    d.setDate(0);
  }
  return d;
}

/** Add N calendar years to a date. Handles Feb 29 leap-year boundary. */
export function addCalendarYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setFullYear(d.getFullYear() + years);
  // Feb 29 → Feb 28 if target year isn't a leap year.
  if (d.getMonth() !== date.getMonth()) {
    d.setDate(0);
  }
  return d;
}

/** Add N days to a date (for free-trial duration). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Compute the next billing/period-end date for a subscription.
 *   - monthly → startDate + 1 calendar month
 *   - yearly  → startDate + 1 calendar year
 * Returns null if status is 'cancelled' (no future renewal).
 */
export function computeNextPeriodEnd(
  startDate: Date,
  interval: BillingInterval,
  status: SubscriptionStatus,
): Date | null {
  if (status === 'cancelled') return null;
  if (interval === 'yearly') return addCalendarYears(startDate, 1);
  return addCalendarMonths(startDate, 1);
}

/**
 * Compute the free-trial end date for a free plan with limited duration.
 * Returns null if duration is null/0 (unlimited free access).
 */
export function computeFreeTrialEnd(startDate: Date, freePlanDurationDays: number | null): Date | null {
  if (!freePlanDurationDays || freePlanDurationDays <= 0) return null;
  return addDays(startDate, freePlanDurationDays);
}

// -------------------- DB CRUD --------------------

/** Convert a Prisma Subscription row to the public SubscriptionRow shape.
 *  Accepts `any` because the exact Prisma type is generated dynamically;
 *  the cast is safe — the DB schema matches the SubscriptionRow interface. */
function rowToSubscription(row: unknown): SubscriptionRow {
  const r = row as {
    id: string;
    userId: string;
    planId: string;
    billingInterval: string;
    status: string;
    startDate: Date;
    currentPeriodEnd: Date | null;
    trialEnd: Date | null;
    cancelAt: Date | null;
    freePlanDurationDays: number | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    id: r.id,
    userId: r.userId,
    planId: r.planId,
    billingInterval: (r.billingInterval === 'yearly' ? 'yearly' : 'monthly') as BillingInterval,
    status: (['active', 'trial', 'past_due', 'cancelled', 'expired'].includes(r.status)
      ? r.status
      : 'active') as SubscriptionStatus,
    startDate: r.startDate,
    currentPeriodEnd: r.currentPeriodEnd,
    trialEnd: r.trialEnd,
    cancelAt: r.cancelAt,
    freePlanDurationDays: r.freePlanDurationDays,
    stripeCustomerId: r.stripeCustomerId,
    stripeSubscriptionId: r.stripeSubscriptionId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Get the active Subscription row for a user (or null). */
export async function getUserSubscription(userId: string): Promise<SubscriptionRow | null> {
  const row = await db.subscription.findUnique({ where: { userId } });
  return row ? rowToSubscription(row) : null;
}

/** Get the user's payment history, newest first. */
export async function getUserPayments(userId: string, limit = 50): Promise<PaymentRow[]> {
  const rows = await db.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    subscriptionId: r.subscriptionId,
    planId: r.planId,
    amount: r.amount,
    currency: r.currency,
    status: (['pending', 'paid', 'failed', 'refunded'].includes(r.status)
      ? r.status
      : 'pending') as PaymentRow['status'],
    method: r.method,
    invoiceNumber: r.invoiceNumber,
    stripeInvoiceId: r.stripeInvoiceId,
    paidAt: r.paidAt,
    createdAt: r.createdAt,
  }));
}

/**
 * Resolve the full client subscription state for a user. This is what
 * the Client Billing dashboard and the entitlement/limit checks consume.
 *
 * For billing-bypass users (OWNER / INTERNAL / EXEMPT), returns a
 * synthetic "internal" state with the Free plan and unlimited access
 * — they have no DB subscription row and are not counted as customers.
 */
export async function getClientSubscriptionState(
  user: EntitlementUser,
): Promise<ClientSubscriptionState> {
  // Bypass users: synthetic internal state.
  if (hasBillingBypass(user)) {
    const freePlan = getPlanConfigSync('free');
    return {
      subscription: null,
      plan: freePlan,
      status: 'active',
      billingInterval: 'monthly',
      trialEnd: null,
      currentPeriodEnd: null,
      freeTrialExpiresAt: null,
      freeTrialExpired: false,
      requiresPlanAction: false,
    };
  }

  const sub = await getUserSubscription(user.id);
  // No subscription row → default to Free plan, no expiry (legacy or
  // fresh account that hasn't gone through checkout).
  if (!sub) {
    const freePlan = getPlanConfigSync('free');
    return {
      subscription: null,
      plan: freePlan,
      status: 'none',
      billingInterval: freePlan.interval,
      trialEnd: null,
      currentPeriodEnd: null,
      freeTrialExpiresAt: null,
      freeTrialExpired: false,
      requiresPlanAction: false,
    };
  }

  const plan = getPlanConfigSync(sub.planId);
  const now = new Date();

  // Free-trial expiration check (only for free plans with duration).
  const freeTrialExpiresAt = sub.trialEnd;
  const freeTrialExpired =
    plan.isFree && sub.trialEnd !== null && sub.trialEnd < now && sub.status !== 'cancelled';

  // Subscription period expired? (cancelled → currentPeriodEnd null)
  const periodExpired =
    sub.currentPeriodEnd !== null && sub.currentPeriodEnd < now && sub.status !== 'cancelled';

  let effectiveStatus: SubscriptionStatus = sub.status;
  if (freeTrialExpired) {
    effectiveStatus = 'expired';
  } else if (periodExpired && sub.status === 'trial') {
    effectiveStatus = 'expired';
  } else if (periodExpired && sub.status === 'active') {
    effectiveStatus = 'past_due';
  }

  return {
    subscription: sub,
    plan,
    status: effectiveStatus,
    billingInterval: sub.billingInterval,
    trialEnd: sub.trialEnd ? sub.trialEnd.toISOString() : null,
    currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
    freeTrialExpiresAt: freeTrialExpiresAt ? freeTrialExpiresAt.toISOString() : null,
    freeTrialExpired,
    requiresPlanAction: freeTrialExpired || effectiveStatus === 'past_due' || effectiveStatus === 'expired',
  };
}

// -------------------- Plan assignment --------------------

/** Check whether a plan is assignable to new customers (active + exists). */
export async function ensurePlanAssignable(planId: string): Promise<{ ok: boolean; reason?: string }> {
  const row = await db.planConfig.findUnique({ where: { planId } });
  if (!row) return { ok: false, reason: `Plan "${planId}" does not exist.` };
  if (!row.active) return { ok: false, reason: `Plan "${planId}" is not active.` };
  return { ok: true };
}

/**
 * Create or update a user's subscription for a FREE plan.
 *
 * This is the ONLY way to subscribe to a free plan without Stripe:
 *   - Computes trialEnd from PlanConfig.freePlanDurationDays (or null if unlimited).
 *   - Sets currentPeriodEnd = trialEnd (so the dashboard shows the right date).
 *   - Never creates a Payment row (free plans have no charge).
 *
 * For PAID plans, this function refuses — paid plans must go through
 * /api/billing/checkout (Stripe). Returns { ok: false, reason: ... } if
 * called for a paid plan with no Stripe configuration.
 */
export async function subscribeToFreePlan(
  userId: string,
  planId: string,
): Promise<{ ok: boolean; reason?: string; subscription?: SubscriptionRow }> {
  const planRow = await db.planConfig.findUnique({ where: { planId } });
  if (!planRow) return { ok: false, reason: `Plan "${planId}" does not exist.` };
  if (!planRow.active) return { ok: false, reason: `Plan "${planId}" is not active.` };
  if (!planRow.isFree) {
    return {
      ok: false,
      reason: `Plan "${planId}" is a paid plan. Use /api/billing/checkout to subscribe via Stripe.`,
    };
  }

  const now = new Date();
  const trialEnd = computeFreeTrialEnd(now, planRow.freePlanDurationDays);
  const status: SubscriptionStatus = trialEnd ? 'trial' : 'active';

  // Upsert: one subscription row per user (userId is unique).
  const existing = await db.subscription.findUnique({ where: { userId } });
  if (existing) {
    const updated = await db.subscription.update({
      where: { userId },
      data: {
        planId,
        billingInterval: 'monthly',
        status,
        startDate: now,
        currentPeriodEnd: trialEnd,
        trialEnd,
        cancelAt: null,
        freePlanDurationDays: planRow.freePlanDurationDays,
        stripeCustomerId: existing.stripeCustomerId, // preserve Stripe link
        stripeSubscriptionId: null, // free plan has no Stripe sub
      },
    });
    return { ok: true, subscription: rowToSubscription(updated) };
  }

  const created = await db.subscription.create({
    data: {
      userId,
      planId,
      billingInterval: 'monthly',
      status,
      startDate: now,
      currentPeriodEnd: trialEnd,
      trialEnd,
      freePlanDurationDays: planRow.freePlanDurationDays,
    },
  });
  return { ok: true, subscription: rowToSubscription(created) };
}

/**
 * Activate / update a subscription after a successful Stripe checkout.
 * Called from the Stripe webhook handler.
 *
 * - Creates or updates the Subscription row.
 * - Computes the calendar-based currentPeriodEnd from the Stripe
 *   subscription's `current_period_end` (Stripe is the source of truth
 *   for paid subscriptions).
 * - Records a Payment row if `payment` info is provided — fully
 *   relational: links to the Subscription, captures the Stripe Invoice
 *   ID, PaymentIntent ID, Charge ID, and the payment-method metadata
 *   (brand / last4 / exp / funding / country) so the admin Payments
 *   table shows the real Stripe state.
 */
export async function activateSubscriptionFromStripe(params: {
  userId: string;
  planId: string;
  billingInterval: BillingInterval;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeCurrentPeriodEnd: Date;
  status: SubscriptionStatus;
  payment?: {
    amount: number;
    currency: string;
    stripeInvoiceId?: string;
    invoiceNumber?: string;
    // Full Stripe relational + payment-method metadata, fetched by the
    // webhook from the PaymentIntent / latest Charge.
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    paymentMethodType?: string;
    paymentMethodDetails?: string; // JSON
    method?: string; // display label, e.g. "Visa ••4242"
    description?: string;
  };
}): Promise<SubscriptionRow> {
  const { userId, planId, billingInterval, payment } = params;
  const existing = await db.subscription.findUnique({ where: { userId } });

  const data = {
    userId,
    planId,
    billingInterval,
    status: params.status,
    startDate: existing?.startDate ?? new Date(),
    currentPeriodEnd: params.stripeCurrentPeriodEnd,
    trialEnd: existing?.trialEnd ?? null,
    cancelAt: null,
    freePlanDurationDays: null, // paid plan: no free-trial duration
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
  };

  const sub = existing
    ? await db.subscription.update({ where: { userId }, data })
    : await db.subscription.create({ data });

  // Record the payment row, if provided — with the full Stripe relational
  // + payment-method metadata so the admin Payments table mirrors Stripe.
  if (payment) {
    await db.payment.create({
      data: {
        userId,
        subscriptionId: sub.id,
        planId,
        amount: payment.amount,
        currency: payment.currency,
        status: 'paid',
        method: payment.method ?? 'Stripe',
        invoiceNumber: payment.invoiceNumber ?? null,
        stripeInvoiceId: payment.stripeInvoiceId ?? null,
        stripePaymentIntentId: payment.stripePaymentIntentId ?? null,
        stripeChargeId: payment.stripeChargeId ?? null,
        paymentMethodType: payment.paymentMethodType ?? null,
        paymentMethodDetails: payment.paymentMethodDetails ?? null,
        description: payment.description ?? null,
        paidAt: new Date(),
      },
    });
  }

  return rowToSubscription(sub);
}

/**
 * Mark a subscription as cancelled. This is the SINGLE local mutator that
 * the Stripe webhook (`customer.subscription.deleted`), the client cancel
 * endpoint, and the admin cancel endpoint converge on.
 *
 * Idempotency:
 *   - If the Subscription row does not exist → return null.
 *   - If the row is already `cancelled` → return it as-is (no-op). This
 *     lets the webhook retry `customer.subscription.deleted` safely and
 *     also lets the cancel routes be called more than once.
 *
 * The `immediatelyUnlinkStripe` flag:
 *   - `true` (DEFAULT) → set `currentPeriodEnd = null` AND
 *     `stripeSubscriptionId = null`. Use this when the Stripe subscription
 *     has actually been deleted (i.e. the Stripe sub object no longer
 *     exists). This is what the `customer.subscription.deleted` webhook
 *     passes — and what the cancel routes pass when Stripe is NOT
 *     configured (local-only cancellation of free/non-Stripe plans).
 *   - `false` → KEEP `currentPeriodEnd` AND `stripeSubscriptionId`. Use
 *     this when the cancellation is SCHEDULED at period end (Stripe's
 *     `cancel_at_period_end: true`) — the Stripe sub still exists, the
 *     customer keeps access until the period ends, and the
 *     `customer.subscription.deleted` webhook will fire later and call
 *     this function again with the default flag to finalize the row.
 *
 * The Subscription row is NOT deleted — historical records are preserved
 * for audit / re-activation. After cancellation, the user reverts to the
 * Free plan automatically (enforced in entitlements.ts via the
 * 'no subscription row → free plan' fallback).
 */
export async function cancelSubscription(
  userId: string,
  opts?: { immediatelyUnlinkStripe?: boolean },
): Promise<SubscriptionRow | null> {
  const existing = await db.subscription.findUnique({ where: { userId } });
  if (!existing) return null;
  // Idempotent: already cancelled → no-op, return the existing row.
  if (existing.status === 'cancelled') return rowToSubscription(existing);

  const immediatelyUnlinkStripe = opts?.immediatelyUnlinkStripe !== false;
  const now = new Date();
  const updated = await db.subscription.update({
    where: { userId },
    data: {
      status: 'cancelled',
      cancelAt: now,
      // When the Stripe sub is truly gone, null out the period end + the
      // Stripe link so the dashboard shows "no future billing". When the
      // cancel is only scheduled (period end), keep both so the dashboard
      // can keep showing the renewal/cancel date until the webhook
      // finalizes.
      ...(immediatelyUnlinkStripe
        ? { currentPeriodEnd: null, stripeSubscriptionId: null }
        : {}),
    },
  });
  return rowToSubscription(updated);
}

// -------------------- Validation helpers --------------------

/**
 * Validate plan configuration input from the admin API. Returns an
 * array of error strings (empty array = valid).
 */
export function validatePlanConfigInput(input: {
  name?: string;
  planId?: string;
  priceMonthly?: number;
  priceYearly?: number;
  currency?: string;
  interval?: string;
  freePlanDurationDays?: number | null;
  limits?: Partial<{
    maxSites: number;
    storageBytes: number;
    aiWords: number;
    aiArticles: number;
    automationRuns: number;
  }>;
  entitlements?: string[];
}): string[] {
  const errors: string[] = [];
  if (input.name !== undefined && !input.name.trim()) errors.push('Plan name is required.');
  if (input.planId !== undefined && !input.planId.trim()) errors.push('Plan ID is required.');
  if (input.priceMonthly !== undefined && (Number.isNaN(input.priceMonthly) || input.priceMonthly < 0)) {
    errors.push('Monthly price must be a non-negative number.');
  }
  if (input.priceYearly !== undefined && (Number.isNaN(input.priceYearly) || input.priceYearly < 0)) {
    errors.push('Yearly price must be a non-negative number.');
  }
  if (input.currency !== undefined && !input.currency.trim()) errors.push('Currency is required.');
  if (input.interval !== undefined && !['monthly', 'yearly'].includes(input.interval)) {
    errors.push('Billing interval must be "monthly" or "yearly".');
  }
  if (
    input.freePlanDurationDays !== undefined &&
    input.freePlanDurationDays !== null &&
    (Number.isNaN(input.freePlanDurationDays) || input.freePlanDurationDays < 0)
  ) {
    errors.push('Free plan duration must be a positive number of days, or null for unlimited.');
  }
  if (input.limits) {
    for (const [k, v] of Object.entries(input.limits)) {
      if (v !== undefined && (Number.isNaN(v) || (v < -1))) {
        errors.push(`Usage limit "${k}" must be a non-negative number or -1 for unlimited.`);
      }
    }
  }
  if (input.entitlements) {
    for (const k of input.entitlements) {
      if (typeof k !== 'string' || !k.trim()) {
        errors.push('Entitlement keys must be non-empty strings.');
      }
    }
  }
  return errors;
}
