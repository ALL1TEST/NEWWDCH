import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import {
  savePlanConfig,
  deletePlanConfig,
  getPlanConfigSync,
  type PlanConfigInput,
} from '@/lib/platform/plan-config';
import { validatePlanConfigInput } from '@/lib/platform/subscription-data';
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

  // Validate the patch — surfaces clear errors for invalid prices / limits /
  // currencies / intervals / entitlement keys.
  const errors = validatePlanConfigInput(body);
  if (errors.length > 0) {
    return fail('VALIDATION_ERROR', errors.join(' '), 400);
  }

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

/**
 * DELETE a plan config. Owner-only.
 *
 * Refuses when:
 *   - It's the last remaining plan (platform must always have at least one).
 *   - Active subscriptions reference this planId — they must be migrated first
 *     (or the plan can be marked inactive instead of deleted, which preserves
 *     historical subscription records).
 *
 * This is the safe way to remove the legacy "Enterprise" stub — but only after
 * the migration has confirmed no live subscriptions point to it.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const planId = request.nextUrl.pathname.split('/').filter(Boolean).pop()!;
  if (!planId) return fail('VALIDATION_ERROR', 'planId is required.', 400);

  const before = getPlanConfigSync(planId);
  const result = await deletePlanConfig(planId);
  if (!result.ok) {
    return fail('DELETE_REFUSED', result.reason ?? 'Unable to delete plan.', 409);
  }
  await logAdminAction({
    userId: auth.user.id,
    action: 'plan.delete',
    resourceType: 'PlanConfig',
    resourceId: planId,
    details: `${before.name} (${planId})`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok({ deleted: true, planId });
}
