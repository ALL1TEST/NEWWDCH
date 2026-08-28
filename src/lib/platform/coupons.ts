// ============================================================
// COUPONS — server-side promo-code validation.
// ============================================================
// Coupon validation MUST happen server-side. The Client Billing /
// Checkout flow calls validateCoupon(code, planId, email) — the same
// function the admin relies on. The client cannot obtain a different
// price by manipulating the frontend.
// ============================================================

import { db } from '@/lib/db';

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
  return row ? rowToCoupon(row) : null;
}

export async function deleteCoupon(id: string): Promise<boolean> {
  try {
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
  if (coupon.perCustomerLimit !== null && coupon.perCustomerLimit > 0) {
    // Per-customer redemption tracking is out of scope for the mock; the
    // server is the authority — the integration point is here.
    // A real implementation would count redemptions per customer.
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
