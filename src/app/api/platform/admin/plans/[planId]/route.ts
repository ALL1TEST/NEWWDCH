import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { savePlanConfig, getPlanConfigSync, type PlanConfigInput } from '@/lib/platform/plan-config';
import { logAdminAction } from '@/lib/platform/audit';

// Owner-only: editing plan pricing / features / entitlements / limits is
// a sensitive mutation. PLATFORM_ADMIN can view (GET on /plans) but only
// OWNER can change pricing. This propagates to the Client Billing page
// and to MRR via the shared plan-config cache.
export async function PUT(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const planId = request.nextUrl.pathname.split('/').filter(Boolean).pop()!;
  const body = (await request.json().catch(() => ({}))) as PlanConfigInput;
  if (!planId) return fail('VALIDATION_ERROR', 'planId is required.', 400);
  const before = getPlanConfigSync(planId);
  const updated = await savePlanConfig(planId, body);
  if (!updated) return fail('NOT_FOUND', 'Plan not found.', 404);
  const priceChanged =
    before.priceMonthly !== updated.priceMonthly || before.priceYearly !== updated.priceYearly;
  await logAdminAction({
    userId: auth.user.id,
    action: priceChanged ? 'plan.price_changed' : 'plan.update',
    resourceType: 'PlanConfig',
    resourceId: planId,
    // Never log secrets — only safe human-readable details.
    details: `${updated.name}: ${before.priceMonthly}→${updated.priceMonthly} ${updated.currency}/mo, features=${updated.features.length}, entitlements=${updated.entitlements.length}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(updated);
}
