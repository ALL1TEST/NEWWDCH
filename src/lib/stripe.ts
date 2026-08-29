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
