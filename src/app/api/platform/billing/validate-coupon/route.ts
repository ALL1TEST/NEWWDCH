import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { validateCoupon } from '@/lib/platform/coupons';
import { getPlanConfigSync } from '@/lib/platform/plan-config';

// Client-facing coupon validation for checkout. Server-authoritative —
// the same validation the admin relies on. The client cannot obtain a
// different price by manipulating the frontend.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { code?: string; planId?: string };
  const { code, planId } = body;
  if (!code || !planId) return fail('VALIDATION_ERROR', 'code and planId are required.', 400);
  const plan = getPlanConfigSync(planId);
  const basePrice = plan.priceMonthly;
  const result = await validateCoupon(code, planId, basePrice, auth.user.email);
  return ok(result);
}
