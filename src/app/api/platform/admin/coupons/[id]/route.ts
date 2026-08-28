import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { updateCoupon, deleteCoupon, type CouponInput } from '@/lib/platform/coupons';
import { logAdminAction } from '@/lib/platform/audit';

export async function PATCH(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const body = (await request.json().catch(() => ({}))) as CouponInput;
  const updated = await updateCoupon(id, body);
  if (!updated) return fail('NOT_FOUND', 'Coupon not found.', 404);
  await logAdminAction({
    userId: auth.user.id,
    action: 'coupon.updated',
    resourceType: 'Coupon',
    resourceId: id,
    details: `${updated.code} active=${updated.active}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(updated);
}

export async function DELETE(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const deleted = await deleteCoupon(id);
  if (!deleted) return fail('NOT_FOUND', 'Coupon not found.', 404);
  await logAdminAction({
    userId: auth.user.id,
    action: 'coupon.deleted',
    resourceType: 'Coupon',
    resourceId: id,
    details: 'Coupon deleted',
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok({ deleted: true });
}
