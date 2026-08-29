// ============================================================
// STRIPE CLIENT + CONFIGURATION GUARD.
// ============================================================
// This is the SINGLE place that reads Stripe env vars and constructs
// the Stripe SDK client. The rest of the codebase calls
// `isStripeConfigured()` to gate real billing; when false, checkout
// returns 503 with a clear "not configured" message and NEVER fakes
// a successful payment.
//
// Stripe SDK is only ever imported server-side (this file is imported
// by API routes and webhook handlers). The publishable key is exposed
// to the client only via /api/billing/config (so the client can show
// the right UI without leaking the secret key).
// ============================================================

import Stripe from 'stripe';

let _client: Stripe | null = null;

/** True when STRIPE_SECRET_KEY is present (non-empty). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim().length > 0);
}

/** Get the shared Stripe SDK client. Throws if not configured — call
 *  isStripeConfigured() first. */
export function getStripeClient(): Stripe {
  if (!_client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
    _client = new Stripe(key, {
      // Pin to a stable API version. Update together with the SDK.
      apiVersion: '2026-08-26.dahlia' as Stripe.LatestApiVersion,
      typescript: true,
      // Surface errors as detailed objects (don't hide fields).
      maxNetworkRetries: 2,
    });
  }
  return _client;
}

/** Public configuration the client can safely see (no secret keys). */
export function getPublicStripeConfig() {
  return {
    configured: isStripeConfigured(),
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
    appUrl: process.env.STRIPE_APP_URL ?? 'http://localhost:3000',
  };
}

/**
 * Resolve the Stripe Price ID for a (planId, billingInterval) pair.
 * Reads from PlanConfig.stripePriceIdMonthly / stripePriceIdYearly
 * (set via Platform Admin → Edit Plan).
 *
 * Returns null when the plan has no Stripe price wired for the
 * requested interval — the caller MUST refuse to fake checkout.
 */
export async function resolveStripePriceId(
  planId: string,
  interval: 'monthly' | 'yearly',
): Promise<string | null> {
  const { db } = await import('@/lib/db');
  const row = await db.planConfig.findUnique({ where: { planId } });
  if (!row) return null;
  if (interval === 'yearly') return row.stripePriceIdYearly ?? null;
  return row.stripePriceIdMonthly ?? null;
}

/** Verify the Stripe webhook signature using STRIPE_WEBHOOK_SECRET.
 *  Returns the verified event or null if verification fails. */
export async function verifyStripeWebhook(
  rawBody: Buffer | string,
  signature: string,
): Promise<Stripe.Event | null> {
  if (!isStripeConfigured()) return null;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;
  try {
    return getStripeClient().webhooks.constructEventAsync(
      rawBody instanceof Buffer ? rawBody : Buffer.from(rawBody),
      signature,
      secret,
    );
  } catch {
    return null;
  }
}

// ============================================================
// SERVER-SIDE STRIPE SDK HELPERS.
// ============================================================
// These helpers wrap raw Stripe SDK calls so callers (webhook
// handler, checkout route, cancel routes, admin sync route)
// don't have to repeat idempotency / best-effort-recovery /
// typed-error boilerplate. They all take a `stripe: Stripe`
// client as the first arg so they can be unit-tested with a
// mock client; production callers pass `getStripeClient()`.
// ============================================================

/**
 * Return the Stripe Customer id for `user`, reusing an existing
 * Customer when `existingCustomerId` resolves to a live (non-deleted)
 * Stripe Customer, otherwise creating a new Customer tagged with
 * `metadata.userId`. On retrieve failure of an existing id, falls
 * through to create.
 */
export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  user: { id: string; email: string; name?: string | null },
  existingCustomerId?: string | null,
): Promise<string> {
  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (customer && !(customer as { deleted?: boolean }).deleted) {
        return customer.id;
      }
    } catch {
      // fall through to create a new Customer
    }
  }
  const created = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });
  return created.id;
}

/**
 * Mirror a local Coupon into a Stripe Coupon + Promotion Code so
 * Stripe Checkout can apply it as a `discounts[]` entry. Reuses
 * existing Stripe objects when present (idempotent). Returns the
 * Stripe Coupon id + Promotion Code id so the caller can cache
 * them on the local Coupon row.
 */
export async function createStripeCouponMirror(
  stripe: Stripe,
  coupon: {
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    currency: string;
    maxRedemptions?: number | null;
    perCustomerLimit?: number | null;
    expiresAt?: string | null;
    startsAt?: string | null;
  },
): Promise<{ stripeCouponId: string; stripePromotionCodeId: string }> {
  // Derive a safe Stripe Coupon id: local_<code_lowered_alphanum>, truncate to 40 chars.
  const derivedId = `local_${coupon.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 40);

  // Reuse an existing Stripe Coupon with that id, else create one.
  let stripeCouponId: string;
  try {
    const existing = await stripe.coupons.retrieve(derivedId);
    stripeCouponId = existing.id;
  } catch {
    const created = await stripe.coupons.create({
      id: derivedId,
      percent_off: coupon.type === 'percent' ? coupon.value : undefined,
      amount_off: coupon.type === 'fixed' ? coupon.value * 100 : undefined,
      currency: coupon.type === 'fixed' ? coupon.currency.toLowerCase() : undefined,
      duration: 'once',
      max_redemptions: coupon.maxRedemptions ?? undefined,
      redeem_by: coupon.expiresAt ? Math.floor(new Date(coupon.expiresAt).getTime() / 1000) : undefined,
      metadata: { localCode: coupon.code },
    });
    stripeCouponId = created.id;
  }

  // Create-or-reuse a Stripe Promotion Code with code: coupon.code.
  let stripePromotionCodeId: string;
  const existingPromos = await stripe.promotionCodes.list({ code: coupon.code, limit: 1 });
  if (existingPromos.data.length > 0) {
    stripePromotionCodeId = existingPromos.data[0].id;
  } else {
    const promo = await stripe.promotionCodes.create({
      coupon: stripeCouponId,
      code: coupon.code,
      max_redemptions: coupon.maxRedemptions ?? undefined,
      expires_at: coupon.expiresAt ? Math.floor(new Date(coupon.expiresAt).getTime() / 1000) : undefined,
      metadata: { localCode: coupon.code },
    });
    stripePromotionCodeId = promo.id;
  }

  return { stripeCouponId, stripePromotionCodeId };
}

/**
 * Best-effort teardown of a local Coupon's Stripe mirror: deactivate
 * the Promotion Code (so it can no longer be redeemed) then delete the
 * Stripe Coupon. Never throws — all errors are swallowed. Safe to call
 * with null/undefined ids (no-op).
 */
export async function clearStripeCouponMirror(
  stripe: Stripe,
  stripeCouponId?: string | null,
  stripePromotionCodeId?: string | null,
): Promise<void> {
  if (stripePromotionCodeId) {
    try {
      await stripe.promotionCodes.update(stripePromotionCodeId, { active: false });
    } catch {
      // best-effort — never throw
    }
  }
  if (stripeCouponId) {
    try {
      await stripe.coupons.del(stripeCouponId);
    } catch {
      // best-effort — never throw
    }
  }
}

/**
 * Sync a local PlanConfig to Stripe by ensuring both a monthly and a
 * yearly Stripe Price exist (with `metadata.planId` + `metadata.interval`
 * set so they can be discovered later). Reuses existing Stripe Prices
 * / Products where possible. Returns the resolved { monthly, yearly }
 * Stripe Price ids (existing + any newly created).
 */
export async function syncPlanToStripe(
  stripe: Stripe,
  plan: {
    planId: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    stripePriceIdMonthly?: string | null;
    stripePriceIdYearly?: string | null;
  },
): Promise<{ stripePriceIdMonthly: string; stripePriceIdYearly: string }> {
  const resolveInterval = async (interval: 'monthly' | 'yearly'): Promise<string> => {
    const existing = interval === 'monthly' ? plan.stripePriceIdMonthly : plan.stripePriceIdYearly;
    if (existing && existing.trim().length > 0) return existing;

    // Try to find an existing active Stripe Price with matching metadata.
    const list = await stripe.prices.list({ active: true, limit: 100 });
    const match = list.data.find(
      (p) => p.metadata?.planId === plan.planId && p.metadata?.interval === interval,
    );
    if (match) return match.id;

    // Create-or-reuse a Stripe Product tagged with metadata.planId.
    let productId: string | undefined;
    try {
      const existingProducts = await stripe.products.list({ limit: 100 });
      const existingProduct = existingProducts.data.find(
        (p) => p.metadata?.planId === plan.planId,
      );
      if (existingProduct) productId = existingProduct.id;
    } catch {
      // fall through to create
    }
    if (!productId) {
      const product = await stripe.products.create({
        name: plan.name,
        metadata: { planId: plan.planId },
      });
      productId = product.id;
    }

    // Stripe's recurring.interval enum is 'day' | 'week' | 'month' | 'year'
    // — map our local 'monthly'/'yearly' terms onto it.
    const stripeInterval: 'month' | 'year' = interval === 'monthly' ? 'month' : 'year';
    const price = await stripe.prices.create({
      unit_amount: (interval === 'monthly' ? plan.priceMonthly : plan.priceYearly) * 100,
      currency: plan.currency.toLowerCase(),
      recurring: { interval: stripeInterval },
      product: productId,
      metadata: { planId: plan.planId, interval },
    });
    return price.id;
  };

  const stripePriceIdMonthly = await resolveInterval('monthly');
  const stripePriceIdYearly = await resolveInterval('yearly');
  return { stripePriceIdMonthly, stripePriceIdYearly };
}

/**
 * Cancel a Stripe Subscription either at period end (subscriber keeps
 * access until the period ends) or immediately. On failure, throws a
 * typed Error with the Stripe error code/message included.
 */
export async function cancelStripeSubscription(
  stripe: Stripe,
  stripeSubscriptionId: string,
  atPeriodEnd: boolean,
): Promise<void> {
  try {
    if (atPeriodEnd) {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await stripe.subscriptions.del(stripeSubscriptionId);
    }
  } catch (err: unknown) {
    const e = (err ?? {}) as { code?: string; message?: string };
    const code = e.code ?? 'stripe_error';
    const message = e.message ?? 'Unknown Stripe error';
    throw new Error(`cancelStripeSubscription failed (${code}): ${message}`);
  }
}

/**
 * Refund a Stripe Charge (full refund when `amount` is omitted; partial
 * refund of `amount` major-units when provided — multiplied by 100 to
 * convert to cents). Returns the created Stripe Refund object. On
 * failure, throws a typed Error.
 */
export async function refundStripeCharge(
  stripe: Stripe,
  chargeId: string,
  amount?: number,
): Promise<Stripe.Refund> {
  try {
    return await stripe.refunds.create({
      charge: chargeId,
      amount: amount ? amount * 100 : undefined,
      metadata: { source: 'platform_admin' },
    });
  } catch (err: unknown) {
    const e = (err ?? {}) as { code?: string; message?: string };
    const code = e.code ?? 'stripe_error';
    const message = e.message ?? 'Unknown Stripe error';
    throw new Error(`refundStripeCharge failed (${code}): ${message}`);
  }
}

/**
 * Swap the underlying Stripe Price on an existing Subscription (single
 * item assumed). Uses `proration_behavior: 'create_prorations'` so the
 * customer is credited / charged the difference. On failure, throws a
 * typed Error.
 */
export async function updateSubscriptionPrice(
  stripe: Stripe,
  stripeSubscriptionId: string,
  newPriceId: string,
): Promise<void> {
  try {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const existingItem = sub.items.data[0];
    if (existingItem) {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{ id: existingItem.id, price: newPriceId }],
        proration_behavior: 'create_prorations',
      });
    }
  } catch (err: unknown) {
    const e = (err ?? {}) as { code?: string; message?: string };
    const code = e.code ?? 'stripe_error';
    const message = e.message ?? 'Unknown Stripe error';
    throw new Error(`updateSubscriptionPrice failed (${code}): ${message}`);
  }
}

/**
 * Pure helper (no Stripe call) that extracts coupon snapshot info from
 * a Stripe Invoice. Returns `{ couponCode: null, stripeCouponId: null,
 * discountAmount: null }` when the invoice has no discount, otherwise
 * returns the localCode (when present on the Stripe Coupon metadata)
 * or the Stripe Coupon id as `couponCode`, the Stripe Coupon id, and
 * the discount amount in major units.
 *
 * Cast through `unknown` because the dahlia API version's type defs
 * lag the actual API surface (some fields are missing / mistyped).
 */
export function extractInvoiceCoupon(invoice: Stripe.Invoice): {
  couponCode: string | null;
  stripeCouponId: string | null;
  discountAmount: number | null;
} {
  const inv = invoice as unknown as {
    discount?: {
      coupon?: {
        id: string;
        metadata?: { localCode?: string } | null;
        amount_off?: number | null;
        percent_off?: number | null;
      } | null;
    } | null;
    total_discount_amounts?: Array<{
      amount: number;
      coupon?: { id: string; metadata?: { localCode?: string } | null } | null;
    }> | null;
  };

  if (inv.discount?.coupon) {
    const stripeCouponId = inv.discount.coupon.id;
    const couponCode = inv.discount.coupon.metadata?.localCode ?? inv.discount.coupon.id;
    const rawAmount = inv.total_discount_amounts?.[0]?.amount ?? 0;
    const discountAmount = rawAmount / 100;
    return { couponCode, stripeCouponId, discountAmount };
  }

  return { couponCode: null, stripeCouponId: null, discountAmount: null };
}

/**
 * Record a Stripe webhook event id in the WebhookEvent idempotency
 * ledger. Returns `true` when the event was newly recorded (i.e. the
 * caller should process it) or `false` when the event was already
 * recorded (a duplicate — the caller MUST skip processing and return
 * 200 to Stripe). Conservative: any error → returns `false` so the
 * webhook skips; the request still returns 200 to Stripe either way
 * (the outer route handler swallows the ledger error).
 *
 * Lazy-imports `@/lib/db` so this file stays safe to import from
 * server-only contexts without forcing Prisma to load eagerly.
 */
export async function markWebhookEventProcessed(params: {
  stripeEventId: string;
  eventType: string;
  apiVersion?: string;
  objectId?: string;
  outcome: 'processed' | 'skipped_duplicate' | 'error';
  errorMessage?: string;
}): Promise<boolean> {
  const { db } = await import('@/lib/db');
  try {
    await db.webhookEvent.create({
      data: {
        stripeEventId: params.stripeEventId,
        eventType: params.eventType,
        apiVersion: params.apiVersion ?? null,
        objectId: params.objectId ?? null,
        outcome: params.outcome,
        errorMessage: params.errorMessage ?? null,
      },
    });
    return true;
  } catch (err: unknown) {
    const e = (err ?? {}) as { code?: string; message?: string };
    if (e.code === 'P2002' || e.message?.includes('Unique constraint')) {
      // duplicate → already processed
      return false;
    }
    // conservative: any other error → treat as duplicate so the
    // webhook skips processing (request still returns 200 to Stripe).
    return false;
  }
}
