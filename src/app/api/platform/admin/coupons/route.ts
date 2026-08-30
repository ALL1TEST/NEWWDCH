import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { listCoupons, createCoupon, type CouponInput } from '@/lib/platform/coupons';
import { logAdminAction } from '@/lib/platform/audit';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  return ok(await listCoupons());
}

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as CouponInput;
  if (!body.code) return fail('VALIDATION_ERROR', 'Coupon code is required.', 400);
  const coupon = await createCoupon(body);
  await logAdminAction({
    userId: auth.user.id,
    action: 'coupon.created',
    resourceType: 'Coupon',
    resourceId: coupon.id,
    details: `${coupon.code} (${coupon.type} ${coupon.value}${coupon.type === 'percent' ? '%' : ` ${coupon.currency}`})`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(coupon);
}
