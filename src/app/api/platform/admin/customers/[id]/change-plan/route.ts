import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { changeCustomerPlan, getCustomer, type PlanId } from '@/lib/platform/platform-data';
import { logAdminAction } from '@/lib/platform/audit';

const VALID: PlanId[] = ['beta', 'pro', 'max'];

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const body = (await request.json().catch(() => ({}))) as { planId?: PlanId };
  const planId = body.planId;
  if (!planId || !VALID.includes(planId)) {
    return fail('VALIDATION_ERROR', 'A valid planId (beta|pro|max) is required.', 400);
  }
  const before = getCustomer(id);
  const updated = changeCustomerPlan(id, planId, auth.user.email);
  if (!updated) return fail('NOT_FOUND', 'Customer not found.', 404);
  await logAdminAction({
    userId: auth.user.id,
    action: 'customer.plan_changed',
    resourceType: 'Customer',
    resourceId: id,
    details: `${updated.name}: ${before?.planId ?? '?'}→${planId}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(getCustomer(id));
}
