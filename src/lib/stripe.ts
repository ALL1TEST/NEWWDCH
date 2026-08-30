// ============================================================
// STRIPE CLIENT + CONFIGURATION GUARD.
// ============================================================
// This is the SINGLE place that resolves Stripe credentials and
// constructs the Stripe SDK client. The rest of the codebase calls
// `isStripeConfigured()` to gate real billing; when false, checkout
// returns 503 with a clear "not configured" message and NEVER fakes
// a successful payment.
//
// CREDENTIAL RESOLUTION ORDER (per credential type):
//   1. The StripeSettings singleton row in the DB (admin-configured
//      via Platform Admin → Stripe Settings). Secret keys are stored
//      AES-256-GCM encrypted; only the masked form is returned to the
//      frontend. Publishable keys are stored as plaintext.
//   2. process.env.STRIPE_* (fallback — works without any DB row,
//      e.g. on first deploy before the admin has connected Stripe).
//
// So an admin can connect Stripe from the UI without editing .env,
// and existing .env-based deployments keep working.
//
// Stripe SDK is only ever imported server-side (this file is imported
// by API routes and webhook handlers). The publishable key is exposed
// to the client only via /api/billing/checkout (GET) (so the client
// can show the right UI without leaking the secret key).
// ============================================================

import Stripe from 'stripe';
import { encrypt, decrypt, maskSecret } from '@/lib/encryption';

/** The Unicode bullet character (U+2022) used by `maskSecret` to mask
 *  the middle of secret keys. Used to detect when the admin has
 *  copy-pasted the MASKED form of a secret back into the input —
 *  storing that would silently break Stripe API calls (Stripe would
 *  reject the masked string as an "Invalid API Key"). */
const MASK_BULLET = '\u2022'; // = '•'

/** True when the value looks like a masked secret (contains the mask
 *  bullet character). Used to reject masked form values at the API
 *  boundary so an admin can never accidentally persist the masked
 *  form as the real secret. */
export function isMaskedSecretValue(value: string): boolean {
  return typeof value === 'string' && value.includes(MASK_BULLET);
}


// -------------------- DB-backed settings cache --------------------
// In-memory cache of the StripeSettings singleton row. Re-read on
// demand (invalidateStripeSettingsCache below) — call after every
// mutation (save / test-connection) so the next getStripeClient()
// picks up the new credentials without a dev-server restart.
interface ResolvedStripeSettings {
  mode: 'test' | 'live';
  secretKey: string | null; // resolved plaintext (decrypted) for the active mode
  publishableKey: string | null;
  webhookSecret: string | null;
  appUrl: string | null;
}

let _resolvedCache: ResolvedStripeSettings | null = null;
let _resolvedCacheAt = 0;
const RESOLVED_TTL_MS = 5_000; // 5s — keeps reads fast but picks up edits quickly

/** Invalidate the in-memory cache of resolved Stripe settings.
 *  Call after every saveStripeSettings() / mutation so the next
 *  getStripeClient() reads the fresh DB row. */
export function invalidateStripeSettingsCache(): void {
  _resolvedCache = null;
  _resolvedCacheAt = 0;
  _client = null; // force the SDK client to be reconstructed on next use
}

/** Read the StripeSettings singleton row from the DB and decrypt
 *  the secret keys for the ACTIVE mode. Returns null when no row
 *  exists yet. Never throws — every error degrades to null. */
async function loadResolvedSettings(): Promise<ResolvedStripeSettings | null> {
  const { db } = await import('@/lib/db');
  try {
    const row = await db.stripeSettings.findUnique({ where: { id: 'singleton' } });
    if (!row) return null;
    const mode = (row.mode === 'live' ? 'live' : 'test') as 'test' | 'live';
    const secretEncrypted = mode === 'live' ? row.secretKeyLiveEncrypted : row.secretKeyTestEncrypted;
    const webhookEncrypted = mode === 'live' ? row.webhookSecretLiveEncrypted : row.webhookSecretTestEncrypted;
    const publishable = mode === 'live' ? row.publishableKeyLive : row.publishableKeyTest;

    let secretKey: string | null = null;
    if (secretEncrypted) {
      try {
        secretKey = await decrypt(secretEncrypted);
      } catch {
        secretKey = null;
      }
    }
    let webhookSecret: string | null = null;
    if (webhookEncrypted) {
      try {
        webhookSecret = await decrypt(webhookEncrypted);
      } catch {
        webhookSecret = null;
      }
    }
    return {
      mode,
      secretKey,
      publishableKey: publishable ?? null,
      webhookSecret,
      appUrl: row.appUrl ?? null,
    };
  } catch {
    // Table not yet created, db not reachable, etc. → fall back to env.
    return null;
  }
}

/** Get the resolved Stripe settings (DB → env fallback), with a
 *  5s in-memory cache so it's cheap to call repeatedly. Public so
 *  the admin settings page can read the masked view + the test
 *  connection route can show what it tested with. */
export async function getResolvedStripeSettings(): Promise<ResolvedStripeSettings & {
  source: 'db' | 'env' | 'none';
}> {
  // 1. DB row (admin-configured).
  const now = Date.now();
  if (_resolvedCache && now - _resolvedCacheAt < RESOLVED_TTL_MS) {
    return { ..._resolvedCache, source: 'db' };
  }
  const fromDb = await loadResolvedSettings();
  if (fromDb && (fromDb.secretKey || fromDb.publishableKey || fromDb.webhookSecret)) {
    _resolvedCache = fromDb;
    _resolvedCacheAt = now;
    return { ...fromDb, source: 'db' };
  }
  // 2. Env fallback.
  const envSettings: ResolvedStripeSettings = {
    mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
    secretKey: process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim().length > 0
      ? process.env.STRIPE_SECRET_KEY
      : null,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_PUBLISHABLE_KEY.trim().length > 0
      ? process.env.STRIPE_PUBLISHABLE_KEY
      : null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET.trim().length > 0
      ? process.env.STRIPE_WEBHOOK_SECRET
      : null,
    appUrl: process.env.STRIPE_APP_URL ?? null,
  };
  // If env has no usable secret key either, source is 'none' (the
  // admin UI shows "Stripe is not connected — configure below").
  const hasEnvCreds = Boolean(envSettings.secretKey) || Boolean(envSettings.publishableKey) || Boolean(envSettings.webhookSecret);
  return { ...envSettings, source: hasEnvCreds ? 'env' : 'none' };
}

/** True when Stripe secret key is configured (DB or env). */
export async function isStripeConfiguredAsync(): Promise<boolean> {
  const s = await getResolvedStripeSettings();
  return Boolean(s.secretKey && s.secretKey.trim().length > 0);
}

/** Sync version — checks env vars only. Kept for backwards compat
 *  with callers that haven't been migrated to the async pattern
 *  (e.g. the webhook handler's pre-flight guard). Prefer
 *  isStripeConfiguredAsync() everywhere new. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim().length > 0);
}

let _client: Stripe | null = null;

/** Get the shared Stripe SDK client. Reads the secret key from DB
 *  first, then falls back to env. Throws if neither is configured —
 *  call isStripeConfiguredAsync() first. */
export async function getStripeClient(): Promise<Stripe> {
  const settings = await getResolvedStripeSettings();
  const key = settings.secretKey;
  if (!key) throw new Error('Stripe is not configured. Set credentials in Platform Admin → Stripe Settings or in .env.');
  // If the cache is fresh and the key matches, reuse the SDK client.
  if (_client && _cachedClientKey === key) return _client;
  _client = new Stripe(key, {
    // Pin to a stable API version. Update together with the SDK.
    apiVersion: '2026-08-26.dahlia' as Stripe.LatestApiVersion,
    typescript: true,
    // Surface errors as detailed objects (don't hide fields).
    maxNetworkRetries: 2,
  });
  _cachedClientKey = key;
  return _client;
}
let _cachedClientKey: string | null = null;

/** Public configuration the client can safely see (no secret keys).
 *  Publishable key + app URL + configured flag. */
export async function getPublicStripeConfig(): Promise<{
  configured: boolean;
  publishableKey: string;
  appUrl: string;
  mode: 'test' | 'live';
}> {
  const s = await getResolvedStripeSettings();
  return {
    configured: Boolean(s.secretKey && s.secretKey.trim().length > 0),
    publishableKey: s.publishableKey ?? '',
    appUrl: s.appUrl ?? 'http://localhost:3000',
    mode: s.mode,
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

/** Verify the Stripe webhook signature. Reads the webhook secret from
 *  DB first, then falls back to STRIPE_WEBHOOK_SECRET. Returns the
 *  verified event or null if verification fails (or Stripe isn't
 *  configured). */
export async function verifyStripeWebhook(
  rawBody: Buffer | string,
  signature: string,
): Promise<Stripe.Event | null> {
  const settings = await getResolvedStripeSettings();
  const secret = settings.webhookSecret;
  if (!secret) return null;
  try {
    const stripe = await getStripeClient();
    return await stripe.webhooks.constructEventAsync(
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
 *
 * PRICE-CHANGE DETECTION: when an existing Stripe Price ID is provided
 * AND the corresponding local price (priceMonthly / priceYearly)
 * changed since the last sync, this function retrieves the Stripe
 * Price, compares its `unit_amount` against the locally-configured
 * amount, and — on mismatch — creates a NEW Stripe Price with the
 * updated amount (the OLD Stripe Price is NOT archived — existing
 * subscriptions may still be on it; Stripe keeps them on the original
 * price until they upgrade / cancel / prorate). The local plan row
 * is then updated with the new Stripe Price ID by the caller.
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
    const expectedAmount = (interval === 'monthly' ? plan.priceMonthly : plan.priceYearly) * 100;

    if (existing && existing.trim().length > 0) {
      // PRICE-CHANGE CHECK: retrieve the existing Stripe Price and
      // compare its unit_amount against the locally-configured amount.
      // On mismatch (the admin edited the price), create a NEW Stripe
      // Price with the updated amount. The OLD Stripe Price is kept
      // active — existing Stripe subscriptions on it stay on the
      // original price until they renew / prorate / cancel. New
      // checkouts will use the new Price ID (the local plan row is
      // updated by the caller with the resolved ID).
      try {
        const existingPrice = await stripe.prices.retrieve(existing);
        const existingAmount = existingPrice.unit_amount ?? 0;
        if (existingAmount !== expectedAmount) {
          // Price changed → create a new Stripe Price on the same
          // Product. Reuse the existing Price's `product` so we don't
          // create a duplicate Product.
          const productId =
            typeof existingPrice.product === 'string'
              ? existingPrice.product
              : existingPrice.product && 'id' in existingPrice.product
              ? existingPrice.product.id
              : undefined;
          if (!productId) {
            // Can't resolve product → keep the existing Price ID.
            return existing;
          }
          const stripeInterval: 'month' | 'year' = interval === 'monthly' ? 'month' : 'year';
          const newPrice = await stripe.prices.create({
            unit_amount: expectedAmount,
            currency: plan.currency.toLowerCase(),
            recurring: { interval: stripeInterval },
            product: productId,
            metadata: { planId: plan.planId, interval },
          });
          return newPrice.id;
        }
        // Amount matches → keep the existing Stripe Price ID.
        return existing;
      } catch {
        // Retrieval failed (deleted? permission?) → fall through to
        // the lookup-by-metadata + create branch. The admin can use
        // the explicit "Sync to Stripe" route to surface real errors.
      }
    }

    // Try to find an existing active Stripe Price with matching metadata.
    const list = await stripe.prices.list({ active: true, limit: 100 });
    const match = list.data.find(
      (p) => p.metadata?.planId === plan.planId && p.metadata?.interval === interval,
    );
    if (match) {
      // Verify the matched Price's amount matches the locally-configured
      // amount — if not, create a fresh Price (same logic as above).
      const matchAmount = match.unit_amount ?? 0;
      if (matchAmount === expectedAmount) return match.id;
      // Amount mismatch → create new on the same Product.
      const productId =
        typeof match.product === 'string'
          ? match.product
          : match.product && 'id' in match.product
          ? match.product.id
          : undefined;
      if (productId) {
        const stripeInterval: 'month' | 'year' = interval === 'monthly' ? 'month' : 'year';
        const newPrice = await stripe.prices.create({
          unit_amount: expectedAmount,
          currency: plan.currency.toLowerCase(),
          recurring: { interval: stripeInterval },
          product: productId,
          metadata: { planId: plan.planId, interval },
        });
        return newPrice.id;
      }
    }

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
      unit_amount: expectedAmount,
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
 * IDEMPOTENCY LEDGER — claim-for-processing pattern.
 *
 * Stripe retries webhook events up to 3 days. We MUST NOT process the
 * same `evt_...` twice. The flow is:
 *
 *   1. claimWebhookEventForProcessing({ stripeEventId, eventType, ... })
 *      Tries to insert a row with outcome='processing'. Three outcomes:
 *        - No existing row → insert succeeds → returns 'new' (process now).
 *        - Existing row with outcome='processed' → returns 'processed' (skip).
 *        - Existing row with outcome='error' OR stale 'processing'
 *          (older than 10 min — likely a crashed worker) → re-claim it
 *          (update to 'processing') → returns 'retry' (process again).
 *
 *   2. After the handler dispatch:
 *      markWebhookEventOutcome(stripeEventId, 'processed')  // success
 *      markWebhookEventOutcome(stripeEventId, 'error', '...') // failure
 *
 * This pattern (vs the old "insert with outcome='processed' BEFORE
 * dispatch") lets Stripe retries recover from handler failures —
 * previously, a row was marked 'processed' before the handler ran,
 * so a crash left the row 'processed' and the retry was silently
 * dropped, leaving the DB in a partial state.
 *
 * Lazy-imports `@/lib/db` so this file stays safe to import from
 * server-only contexts without forcing Prisma to load eagerly.
 */
const STALE_PROCESSING_MS = 10 * 60_000; // 10 min — a worker that crashed mid-process

export type WebhookEventClaim = 'new' | 'retry' | 'processed';

export async function claimWebhookEventForProcessing(params: {
  stripeEventId: string;
  eventType: string;
  apiVersion?: string;
  objectId?: string;
}): Promise<WebhookEventClaim> {
  const { db } = await import('@/lib/db');
  try {
    // Try to insert a fresh 'processing' row. If the unique constraint
    // on stripeEventId rejects the insert, fall through to the existing-row
    // branch.
    await db.webhookEvent.create({
      data: {
        stripeEventId: params.stripeEventId,
        eventType: params.eventType,
        apiVersion: params.apiVersion ?? null,
        objectId: params.objectId ?? null,
        outcome: 'processing',
      },
    });
    return 'new';
  } catch (err: unknown) {
    const e = (err ?? {}) as { code?: string; message?: string };
    if (e.code !== 'P2002' && !e.message?.includes('Unique constraint')) {
      // Any other error → conservative: treat as 'processed' so the
      // webhook skips (request still returns 200 to Stripe).
      return 'processed';
    }
    // Unique constraint violation — a row already exists. Look it up.
    try {
      const existing = await db.webhookEvent.findUnique({
        where: { stripeEventId: params.stripeEventId },
        select: { outcome: true, processedAt: true },
      });
      if (!existing) return 'processed'; // race: row vanished → skip
      if (existing.outcome === 'processed') return 'processed'; // already done → skip
      if (existing.outcome === 'error') {
        // Re-claim → re-process on retry.
        await db.webhookEvent.update({
          where: { stripeEventId: params.stripeEventId },
          data: {
            outcome: 'processing',
            errorMessage: null,
            processedAt: new Date(),
          },
        });
        return 'retry';
      }
      if (existing.outcome === 'processing') {
        // Stale in-progress row (worker crashed mid-process). Re-claim
        // only when stale; otherwise skip to avoid double-processing.
        const age = Date.now() - existing.processedAt.getTime();
        if (age > STALE_PROCESSING_MS) {
          await db.webhookEvent.update({
            where: { stripeEventId: params.stripeEventId },
            data: {
              outcome: 'processing',
              errorMessage: null,
              processedAt: new Date(),
            },
          });
          return 'retry';
        }
        return 'processed'; // still being processed by another worker → skip
      }
      return 'processed';
    } catch {
      // Lookup failed → conservative: skip.
      return 'processed';
    }
  }
}

/** Update the outcome of a webhook event row after the handler runs.
 *  Best-effort — never throws. Called with 'processed' on success or
 *  'error' on failure (Stripe will retry). */
export async function markWebhookEventOutcome(
  stripeEventId: string,
  outcome: 'processed' | 'error',
  errorMessage?: string | null,
): Promise<void> {
  const { db } = await import('@/lib/db');
  try {
    await db.webhookEvent.update({
      where: { stripeEventId },
      data: {
        outcome,
        errorMessage: errorMessage ? errorMessage.slice(0, 1000) : null,
        processedAt: new Date(),
      },
    });
    if (outcome === 'processed' || outcome === 'error') {
      // Invalidate the resolved-settings cache when a webhook succeeds
      // so subsequent reads pick up any DB changes (e.g., a Payment
      // row created by the webhook). Best-effort.
      invalidateStripeSettingsCache();
    }
  } catch {
    // best-effort — never throw from an outcome update
  }
}

/**
 * @deprecated Use `claimWebhookEventForProcessing` + `markWebhookEventOutcome`
 *   instead. The new 2-step pattern allows Stripe retries to recover from
 *   handler failures (the old single-step insert marked the row 'processed'
 *   BEFORE dispatch, so retries were silently dropped).
 *
 *   Kept as a backwards-compatible wrapper so callers that haven't migrated
 *   keep working. Calls `claimWebhookEventForProcessing`; returns true only
 *   when the claim is 'new' or 'retry' (i.e. the caller should process the
 *   event). Returns false when the event was already 'processed'.
 */
export async function markWebhookEventProcessed(params: {
  stripeEventId: string;
  eventType: string;
  apiVersion?: string;
  objectId?: string;
  outcome: 'processed' | 'skipped_duplicate' | 'error';
  errorMessage?: string;
}): Promise<boolean> {
  const claim = await claimWebhookEventForProcessing({
    stripeEventId: params.stripeEventId,
    eventType: params.eventType,
    apiVersion: params.apiVersion,
    objectId: params.objectId,
  });
  if (claim === 'processed') return false;
  // 'new' or 'retry' — caller will process. If the caller also passed an
  // outcome, apply it now (for backwards compat with callers that used
  // the old single-step API to record an outcome at the start).
  if (params.outcome && params.outcome !== 'processed') {
    await markWebhookEventOutcome(params.stripeEventId, params.outcome === 'error' ? 'error' : 'processed', params.errorMessage);
  }
  return true;
}

// ============================================================
// ADMIN STRIPE SETTINGS — credential storage + Test Connection.
// ============================================================
// saveStripeSettings: encrypts secret keys (sk_*, whsec_*) and
//   upserts the singleton row. Publishable keys (pk_*) are stored
//   as plaintext. Returns the masked view (safe for the admin UI).
//
// getStripeSettingsForAdmin: returns the masked view + last test
//   result + webhook URL hint. Never returns raw secret values —
//   the admin UI shows masked strings (sk_...xxxx) and only ever
//   sends a fresh plaintext key when rotating.
//
// testStripeConnection: constructs a temporary Stripe client from
//   the provided (or stored) credentials and pings Stripe's
//   /v1/balance endpoint (read-only, no side effects). On success
//   returns account info; on failure returns the Stripe error code
//   + message. Records the outcome on the singleton row so the UI
//   can show the last test result.
// ============================================================

export interface StripeSettingsInput {
  mode: 'test' | 'live';
  // Plaintext credentials from the admin UI. Empty string = "leave
  // unchanged" (the existing encrypted value is kept); null/undefined
  // = "clear" (the field is set to null).
  secretKeyTest?: string;
  secretKeyLive?: string;
  publishableKeyTest?: string;
  publishableKeyLive?: string;
  webhookSecretTest?: string;
  webhookSecretLive?: string;
  appUrl?: string;
}

export interface StripeSettingsView {
  mode: 'test' | 'live';
  secretKeyTestMasked: string; // masked or '' when not configured
  secretKeyLiveMasked: string;
  publishableKeyTest: string; // plaintext (non-secret)
  publishableKeyLive: string;
  webhookSecretTestMasked: string;
  webhookSecretLiveMasked: string;
  appUrl: string;
  lastTestStatus: 'success' | 'error' | null;
  lastTestedAt: string | null;
  lastTestErrorMessage: string | null;
  // Whether each credential is configured (so the UI can show ✓/✗).
  hasSecretKeyTest: boolean;
  hasSecretKeyLive: boolean;
  hasWebhookSecretTest: boolean;
  hasWebhookSecretLive: boolean;
  hasPublishableKeyTest: boolean;
  hasPublishableKeyLive: boolean;
  // The source the active Stripe client resolves to ('db' | 'env' | 'none').
  activeSource: 'db' | 'env' | 'none';
  isConfigured: boolean;
}

const EMPTY_MASKED = '';

/** Read the StripeSettings singleton (or null when no row exists). */
async function readStripeSettingsRow() {
  const { db } = await import('@/lib/db');
  return db.stripeSettings.findUnique({ where: { id: 'singleton' } });
}

/** Decrypt a stored encrypted secret (returns null when ciphertext
 *  is null or decryption fails). */
async function tryDecrypt(ciphertext: string | null | undefined): Promise<string | null> {
  if (!ciphertext) return null;
  try {
    return await decrypt(ciphertext);
  } catch {
    return null;
  }
}

/** Build the safe masked view for the admin UI. Never returns raw
 *  secret values. */
export async function getStripeSettingsForAdmin(): Promise<StripeSettingsView> {
  const row = await readStripeSettingsRow();

  const secretKeyTest = await tryDecrypt(row?.secretKeyTestEncrypted);
  const secretKeyLive = await tryDecrypt(row?.secretKeyLiveEncrypted);
  const webhookSecretTest = await tryDecrypt(row?.webhookSecretTestEncrypted);
  const webhookSecretLive = await tryDecrypt(row?.webhookSecretLiveEncrypted);
  const publishableKeyTest = row?.publishableKeyTest ?? '';
  const publishableKeyLive = row?.publishableKeyLive ?? '';

  const resolved = await getResolvedStripeSettings();

  return {
    mode: (row?.mode === 'live' ? 'live' : 'test'),
    secretKeyTestMasked: secretKeyTest ? maskSecret(secretKeyTest) : EMPTY_MASKED,
    secretKeyLiveMasked: secretKeyLive ? maskSecret(secretKeyLive) : EMPTY_MASKED,
    publishableKeyTest,
    publishableKeyLive,
    webhookSecretTestMasked: webhookSecretTest ? maskSecret(webhookSecretTest) : EMPTY_MASKED,
    webhookSecretLiveMasked: webhookSecretLive ? maskSecret(webhookSecretLive) : EMPTY_MASKED,
    appUrl: row?.appUrl ?? '',
    lastTestStatus: (row?.lastTestStatus === 'success' || row?.lastTestStatus === 'error')
      ? row.lastTestStatus
      : null,
    lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
    lastTestErrorMessage: row?.lastTestErrorMessage ?? null,
    hasSecretKeyTest: Boolean(secretKeyTest),
    hasSecretKeyLive: Boolean(secretKeyLive),
    hasWebhookSecretTest: Boolean(webhookSecretTest),
    hasWebhookSecretLive: Boolean(webhookSecretLive),
    hasPublishableKeyTest: Boolean(publishableKeyTest),
    hasPublishableKeyLive: Boolean(publishableKeyLive),
    activeSource: resolved.source,
    isConfigured: Boolean(resolved.secretKey && resolved.secretKey.trim().length > 0),
  };
}

/** Save (encrypt + upsert) Stripe credentials. Empty-string values
 *  for secret keys mean "leave unchanged" (the existing encrypted
 *  value is preserved); null means "clear". Omitted (undefined)
 *  fields also mean "preserve" — this matters because the frontend
 *  may omit a field entirely from the JSON body when the admin didn't
 *  touch it. Publishable keys are written as plaintext (non-secret).
 *  Returns the masked view. Never returns raw secret values.
 *
 *  MASKED-VALUE REJECTION: any non-empty secret/publishable/webhook
 *  value containing the mask bullet character (•) is rejected with a
 *  thrown Error. This catches the common mistake of copy-pasting the
 *  masked display form (e.g. `sk_test_••••abcd`) back into the input
 *  — which would otherwise be encrypted as the masked string and
 *  silently break every subsequent Stripe API call with
 *  "Invalid API Key provided". */
export async function saveStripeSettings(
  input: StripeSettingsInput,
  editorUserId: string,
): Promise<StripeSettingsView> {
  const { db } = await import('@/lib/db');
  const existing = await readStripeSettingsRow();

  // ---- Masked-value rejection (before any encryption / storage). ----
  // The admin may have copy-pasted the masked form back into the
  // input — reject it with a clear, actionable error.
  const maskedChecks: Array<{ value: string | undefined; label: string }> = [
    { value: input.secretKeyTest, label: 'Secret Key (Test)' },
    { value: input.secretKeyLive, label: 'Secret Key (Live)' },
    { value: input.publishableKeyTest, label: 'Publishable Key (Test)' },
    { value: input.publishableKeyLive, label: 'Publishable Key (Live)' },
    { value: input.webhookSecretTest, label: 'Webhook Secret (Test)' },
    { value: input.webhookSecretLive, label: 'Webhook Secret (Live)' },
  ];
  for (const c of maskedChecks) {
    if (c.value && isMaskedSecretValue(c.value)) {
      throw new Error(
        `${c.label} looks like a masked value (contains the • character). ` +
          `Re-enter the full, real Stripe key — do not copy the masked form.`,
      );
    }
  }

  // ---- Secret keys: encrypt when provided; preserve when empty ----
  // Semantics (NEW, fixes the "Invalid API Key" bug):
  //   - undefined  → preserve (admin omitted the field entirely)
  //   - null       → clear (admin explicitly wants to remove it)
  //   - ''         → preserve (admin left the input empty — "leave unchanged")
  //   - non-empty  → encrypt + store
  // Previously, undefined was treated as "clear", which silently wiped
  // the saved secret every time the admin saved without retyping the
  // key. That made the next Test Connection fall back to env (often
  // empty or wrong) → Stripe returned "Invalid API Key".
  const encryptOrPreserve = async (
    plaintext: string | undefined | null,
    existingEncrypted: string | null | undefined,
  ): Promise<string | null> => {
    if (plaintext === undefined) return existingEncrypted ?? null; // preserve (omitted)
    if (plaintext === null) return null; // clear
    if (plaintext === '') return existingEncrypted ?? null; // preserve (empty input)
    return await encrypt(plaintext);
  };

  const secretKeyTestEncrypted = await encryptOrPreserve(
    input.secretKeyTest,
    existing?.secretKeyTestEncrypted,
  );
  const secretKeyLiveEncrypted = await encryptOrPreserve(
    input.secretKeyLive,
    existing?.secretKeyLiveEncrypted,
  );
  const webhookSecretTestEncrypted = await encryptOrPreserve(
    input.webhookSecretTest,
    existing?.webhookSecretTestEncrypted,
  );
  const webhookSecretLiveEncrypted = await encryptOrPreserve(
    input.webhookSecretLive,
    existing?.webhookSecretLiveEncrypted,
  );

  // ---- Publishable keys: plaintext (non-secret). Empty string
  //      preserves existing; null clears; undefined (omitted) preserves. ----
  const resolvePub = (
    v: string | undefined | null,
    existingVal: string | null,
  ): string | null => {
    if (v === undefined) return existingVal ?? null; // preserve (omitted)
    if (v === null) return null; // clear
    if (v === '') return existingVal ?? null; // preserve (empty input)
    return v;
  };
  const publishableKeyTest = resolvePub(input.publishableKeyTest, existing?.publishableKeyTest ?? null);
  const publishableKeyLive = resolvePub(input.publishableKeyLive, existing?.publishableKeyLive ?? null);

  // ---- App URL: empty string = unset (no preserve semantic — caller
  //      should pass the full URL). ----
  const appUrl = input.appUrl ?? existing?.appUrl ?? null;

  await db.stripeSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      mode: input.mode,
      secretKeyTestEncrypted,
      secretKeyLiveEncrypted,
      webhookSecretTestEncrypted,
      webhookSecretLiveEncrypted,
      publishableKeyTest,
      publishableKeyLive,
      appUrl,
      updatedBy: editorUserId,
    },
    update: {
      mode: input.mode,
      secretKeyTestEncrypted,
      secretKeyLiveEncrypted,
      webhookSecretTestEncrypted,
      webhookSecretLiveEncrypted,
      publishableKeyTest,
      publishableKeyLive,
      appUrl,
      updatedBy: editorUserId,
    },
  });

  // Force the next read to pick up the new credentials.
  invalidateStripeSettingsCache();

  return getStripeSettingsForAdmin();
}

/** Test a Stripe connection by pinging the read-only /v1/balance
 *  endpoint. Uses the currently-configured credentials when
 *  `input` is null/undefined; otherwise constructs a temporary
 *  client from `input` (so the admin can test BEFORE saving).
 *  Records the outcome on the singleton row.
 *
 *  Returns `{ success: true, accountInfo }` on success, or
 *  `{ success: false, code, message }` on failure. Never throws. */
export async function testStripeConnection(
  input?: StripeSettingsInput,
): Promise<
  | { success: true; mode: 'test' | 'live'; accountInfo: { id: string; type: string; country: string; email: string | null; displayName: string | null } }
  | { success: false; mode: 'test' | 'live'; code: string; message: string }
> {
  // Resolve the secret key to test with.
  let secretKey: string | null = null;
  let mode: 'test' | 'live' = 'test';

  if (input) {
    mode = input.mode;
    const candidate = mode === 'live' ? input.secretKeyLive : input.secretKeyTest;
    if (candidate && candidate.trim().length > 0) {
      secretKey = candidate;
    } else {
      // Fall back to the stored value for the chosen mode.
      const row = await readStripeSettingsRow();
      const enc = mode === 'live' ? row?.secretKeyLiveEncrypted : row?.secretKeyTestEncrypted;
      secretKey = await tryDecrypt(enc);
    }
  } else {
    const resolved = await getResolvedStripeSettings();
    secretKey = resolved.secretKey;
    mode = resolved.mode;
  }

  if (!secretKey || secretKey.trim().length === 0) {
    const msg = 'No Stripe secret key is configured for the selected mode. Set the secret key first.';
    await recordTestOutcome(mode, 'error', msg);
    return { success: false, mode, code: 'NOT_CONFIGURED', message: msg };
  }

  // Reject masked values outright — the admin copy-pasted the masked
  // display form (sk_test_••••abcd) instead of the real key. Stripe
  // would reject the masked string as an "Invalid API Key" — better
  // to surface the real cause here with a clear, actionable message.
  if (isMaskedSecretValue(secretKey)) {
    const msg =
      'The provided secret key looks like a masked value (contains the • character). ' +
      'Re-enter the full, real Stripe secret key — do not copy the masked form.';
    await recordTestOutcome(mode, 'error', msg);
    return { success: false, mode, code: 'MASKED_VALUE', message: msg };
  }

  // Basic key-shape validation — sk_test_ / sk_live_ / rk_test_ /
  // rk_live_ (restricted keys also work for read-only calls).
  const keyShapeOk =
    secretKey.startsWith('sk_test_') ||
    secretKey.startsWith('sk_live_') ||
    secretKey.startsWith('rk_test_') ||
    secretKey.startsWith('rk_live_');
  if (!keyShapeOk) {
    const msg = 'The secret key does not look like a Stripe secret key (expected sk_test_… or sk_live_…).';
    await recordTestOutcome(mode, 'error', msg);
    return { success: false, mode, code: 'INVALID_KEY_SHAPE', message: msg };
  }

  // MODE-KEY MISMATCH VALIDATION: verify the key prefix matches the
  // selected Test/Live mode. Without this, the admin could select
  // Live mode but provide a sk_test_ key — the Stripe client would
  // authenticate against the TEST account (since the key is a test
  // key), silently bypassing the live-account check the admin meant
  // to perform. Stripe would happily return account info for the
  // test account, leading the admin to believe the LIVE credentials
  // were validated when they weren't.
  const isTestKey = secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_');
  const isLiveKey = secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_');
  if (mode === 'test' && !isTestKey) {
    const msg =
      'Mode/key mismatch: Test mode is selected but the secret key is a LIVE key ' +
      `(starts with ${secretKey.slice(0, 8)}…). Switch to Live mode or paste a Test key (sk_test_…).`;
    await recordTestOutcome(mode, 'error', msg);
    return { success: false, mode, code: 'MODE_KEY_MISMATCH', message: msg };
  }
  if (mode === 'live' && !isLiveKey) {
    const msg =
      'Mode/key mismatch: Live mode is selected but the secret key is a TEST key ' +
      `(starts with ${secretKey.slice(0, 8)}…). Switch to Test mode or paste a Live key (sk_live_…).`;
    await recordTestOutcome(mode, 'error', msg);
    return { success: false, mode, code: 'MODE_KEY_MISMATCH', message: msg };
  }

  try {
    // Construct a TEMPORARY client (not the cached singleton) so we
    // can test credentials that haven't been saved yet.
    const tempClient = new Stripe(secretKey, {
      apiVersion: '2026-08-26.dahlia' as Stripe.LatestApiVersion,
      typescript: true,
      maxNetworkRetries: 1,
    });
    // /v1/balance is read-only and free of side effects — perfect for
    // testing credentials. It also works with restricted keys that
    // have the "Balance" read permission.
    const balance = await tempClient.balance.retrieve();
    // Resolve the account for richer info (id, country, display name).
    // This call requires the "Settings" read permission, which secret
    // keys always have. Fall back gracefully when restricted keys
    // can't reach it.
    let accountInfo: { id: string; type: string; country: string; email: string | null; displayName: string | null };
    try {
      const acct = await tempClient.accounts.retrieve();
      accountInfo = {
        id: acct.id,
        type: (acct as unknown as { type?: string }).type ?? 'standard',
        country: (acct as unknown as { country?: string }).country ?? '',
        email: (acct as unknown as { email?: string | null }).email ?? null,
        displayName: (acct as unknown as { display_name?: string | null }).display_name ?? null,
      };
    } catch {
      // Restricted key with no Settings read — still a successful
      // test (the secret key authenticates to Stripe).
      accountInfo = {
        id: '(restricted key)',
        type: 'restricted',
        country: '',
        email: null,
        displayName: null,
      };
    }
    const balanceAvailable = balance.available?.[0]?.amount;
    await recordTestOutcome(
      mode,
      'success',
      null,
      `account_id=${accountInfo.id}, available=${balanceAvailable ?? 'n/a'}`,
    );
    return { success: true, mode, accountInfo };
  } catch (err: unknown) {
    const e = (err ?? {}) as { code?: string; message?: string; type?: string };
    const code = e.code ?? e.type ?? 'stripe_error';
    const message = e.message ?? 'Unknown Stripe error';
    await recordTestOutcome(mode, 'error', `${code}: ${message}`);
    return { success: false, mode, code, message };
  }
}

/** Persist the last test-connection outcome on the singleton row.
 *  Best-effort — never throws. */
async function recordTestOutcome(
  mode: 'test' | 'live',
  status: 'success' | 'error',
  errorMessage: string | null,
  _detail?: string,
): Promise<void> {
  try {
    const { db } = await import('@/lib/db');
    await db.stripeSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        mode,
        lastTestStatus: status,
        lastTestedAt: new Date(),
        lastTestErrorMessage: errorMessage,
      },
      update: {
        mode,
        lastTestStatus: status,
        lastTestedAt: new Date(),
        lastTestErrorMessage: errorMessage,
      },
    });
    invalidateStripeSettingsCache();
  } catch {
    // best-effort
  }
}
