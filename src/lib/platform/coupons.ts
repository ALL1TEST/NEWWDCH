// ============================================================
// COUPONS — server-side promo-code validation.
// ============================================================
// Coupon validation MUST happen server-side. The Client Billing /
// Checkout flow calls validateCoupon(code, planId, email) — the same
// function the admin relies on. The client cannot obtain a different
// price by manipulating the frontend.
// ============================================================

import { db } from '@/lib/db';
import {
  isStripeConfiguredAsync,
  getStripeClient,
  clearStripeCouponMirror,
} from '@/lib/stripe';

export type CouponType = 'percent' | 'fixed';

export interface CouponRow {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  currency: string;
  applicablePlans: string[]; // empty = all plans
  startsAt: string | null;
  expiresAt: string | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  active: boolean;
  timesRedeemed: number;
  createdAt: string;
}

export interface CouponInput {
  code: string;
  type?: CouponType;
  value?: number;
  currency?: string;
  applicablePlans?: string[];
  startsAt?: string | null;
  expiresAt?: string | null;
  maxRedemptions?: number | null;
  perCustomerLimit?: number | null;
  active?: boolean;
}

export interface CouponValidation {
  ok: boolean;
  coupon: CouponRow | null;
  discountAmount: number; // in major currency units
  finalPrice: number; // in major currency units (after discount)
  currency: string;
  message: string;
}

function rowToCoupon(r: {
  id: string;
  code: string;
  type: string;
  value: number;
  currency: string;
  applicablePlans: string;
  startsAt: string | null;
  expiresAt: string | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  active: boolean;
  timesRedeemed: number;
  createdAt: Date;
}): CouponRow {
  let applicablePlans: string[] = [];
  try {
    applicablePlans = JSON.parse(r.applicablePlans || '[]');
  } catch {
    applicablePlans = [];
  }
  return {
    id: r.id,
    code: r.code,
    type: (r.type === 'fixed' ? 'fixed' : 'percent') as CouponType,
    value: r.value,
    currency: r.currency,
    applicablePlans,
    startsAt: r.startsAt,
    expiresAt: r.expiresAt,
    maxRedemptions: r.maxRedemptions,
    perCustomerLimit: r.perCustomerLimit,
    active: r.active,
    timesRedeemed: r.timesRedeemed,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listCoupons(): Promise<CouponRow[]> {
  const rows = await db.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(rowToCoupon);
}

export async function getCoupon(code: string): Promise<CouponRow | null> {
  const row = await db.coupon.findUnique({ where: { code } });
  return row ? rowToCoupon(row) : null;
}

export async function createCoupon(input: CouponInput): Promise<CouponRow> {
  const row = await db.coupon.create({
    data: {
      code: input.code.toUpperCase(),
      type: input.type ?? 'percent',
      value: input.value ?? 0,
      currency: input.currency ?? 'CHF',
      applicablePlans: JSON.stringify(input.applicablePlans ?? []),
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      maxRedemptions: input.maxRedemptions ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
      active: input.active ?? true,
    },
  });
  return rowToCoupon(row);
}

export async function updateCoupon(id: string, input: CouponInput): Promise<CouponRow | null> {
  // Fetch the existing row BEFORE the update so we can invalidate the Stripe
  // mirror (using the OLD mirror IDs) when a material field changes or the
  // coupon is deactivated. Without this, stale Stripe Coupons would keep
  // applying the old discount at checkout.
  const existing = await db.coupon.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return null;

  const row = await db.coupon
    .update({
      where: { id },
      data: {
        code: input.code ? input.code.toUpperCase() : undefined,
        type: input.type,
        value: input.value,
        currency: input.currency,
        applicablePlans: input.applicablePlans ? JSON.stringify(input.applicablePlans) : undefined,
        startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
        expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt ? new Date(input.expiresAt) : null,
        maxRedemptions: input.maxRedemptions,
        perCustomerLimit: input.perCustomerLimit,
        active: input.active,
      },
    })
    .catch(() => null);
  if (!row) return null;

  // Invalidate the Stripe mirror if any material field changed OR the coupon
  // was deactivated. Best-effort — swallow Stripe errors (the local row is
  // still authoritative; next checkout will re-create a fresh mirror).
  const materialChanged =
    input.value !== undefined ||
    input.type !== undefined ||
    input.currency !== undefined ||
    input.expiresAt !== undefined ||
    input.maxRedemptions !== undefined;
  const deactivated = input.active === false;
  const hasMirror = Boolean(existing.stripeCouponId || existing.stripePromotionCodeId);
  if ((materialChanged || deactivated) && hasMirror && (await isStripeConfiguredAsync())) {
    try {
      const stripe = await getStripeClient();
      await clearStripeCouponMirror(
        stripe,
        existing.stripeCouponId,
        existing.stripePromotionCodeId,
      );
    } catch {
      // best-effort — mirror cleanup is not authoritative
    }
    await db.coupon
      .update({
        where: { id },
        data: { stripeCouponId: null, stripePromotionCodeId: null },
      })
      .catch(() => null);
  }

  return rowToCoupon(row);
}

export async function deleteCoupon(id: string): Promise<boolean> {
  try {
    // Fetch the existing row so we can invalidate the Stripe mirror before
    // deleting the local row (after delete, the mirror IDs are gone and
    // would leak as orphan Stripe Coupons/Promotion Codes).
    const existing = await db.coupon.findUnique({ where: { id } });
    if (
      existing &&
      (await isStripeConfiguredAsync()) &&
      (existing.stripeCouponId || existing.stripePromotionCodeId)
    ) {
      try {
        const stripe = await getStripeClient();
        await clearStripeCouponMirror(
          stripe,
          existing.stripeCouponId,
          existing.stripePromotionCodeId,
        );
      } catch {
        // best-effort — proceed with the local delete regardless
      }
    }
    await db.coupon.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

/** Validate a coupon against a plan + price + customer. Server-authoritative. */
export async function validateCoupon(
  code: string,
  planId: string,
  basePrice: number,
  customerEmail: string,
): Promise<CouponValidation> {
  const coupon = await getCoupon(code.trim());
  if (!coupon) {
    return { ok: false, coupon: null, discountAmount: 0, finalPrice: basePrice, currency: 'CHF', message: 'Coupon not found.' };
  }
  if (!coupon.active) {
    return { ok: false, coupon, discountAmount: 0, finalPrice: basePrice, currency: coupon.currency, message: 'Coupon is inactive.' };
  }
  const now = new Date();
  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return { ok: false, coupon, discountAmount: 0, finalPrice: basePrice, currency: coupon.currency, message: 'Coupon is not active yet.' };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return { ok: false, coupon, discountAmount: 0, finalPrice: basePrice, currency: coupon.currency, message: 'Coupon has expired.' };
  }
  if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes(planId)) {
    return { ok: false, coupon, discountAmount: 0, finalPrice: basePrice, currency: coupon.currency, message: 'Coupon does not apply to this plan.' };
  }
  if (coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions) {
    return { ok: false, coupon, discountAmount: 0, finalPrice: basePrice, currency: coupon.currency, message: 'Coupon redemption limit reached.' };
  }
  // Per-customer redemption limit enforcement. Counts the number of
  // CouponRedemption rows already written for this (coupon, user) pair —
  // the Stripe webhook writes one row per confirmed checkout. If the count
  // has reached the limit, refuse to apply the coupon again.
  if (coupon.perCustomerLimit !== null && coupon.perCustomerLimit > 0 && customerEmail) {
    const user = await db.user.findUnique({
      where: { email: customerEmail },
      select: { id: true },
    });
    if (user) {
      const count = await db.couponRedemption.count({
        where: { couponId: coupon.id, userId: user.id },
      });
      if (count >= coupon.perCustomerLimit) {
        return {
          ok: false,
          coupon,
          discountAmount: 0,
          finalPrice: basePrice,
          currency: coupon.currency,
          message: 'Coupon redemption limit reached for this account.',
        };
      }
    }
  }

  let discount = 0;
  if (coupon.type === 'percent') {
    discount = Math.round(basePrice * Math.min(coupon.value, 100) / 100);
  } else {
    discount = Math.min(coupon.value, basePrice);
  }
  const finalPrice = Math.max(0, basePrice - discount);
  return {
    ok: true,
    coupon,
    discountAmount: discount,
    finalPrice,
    currency: coupon.currency,
    message: `Coupon applied: ${coupon.value}${coupon.type === 'percent' ? '%' : ` ${coupon.currency}`} off.`,
  };
}

/** Increment redemption count after a successful checkout. */
export async function redeemCoupon(code: string): Promise<void> {
  try {
    await db.coupon.update({ where: { code }, data: { timesRedeemed: { increment: 1 } } });
  } catch {
    // ignore
  }
}
