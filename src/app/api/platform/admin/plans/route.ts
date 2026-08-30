import { NextRequest } from 'next/server';
import {
  requirePlatformAdmin,
  requireOwner,
  ok,
  fail,
  getClientIp,
} from '@/lib/platform/platform-auth';
import {
  getPlanConfigsSync,
  ensureHydrated,
  createPlanConfig,
  type PlanConfigInput,
} from '@/lib/platform/plan-config';
import { validatePlanConfigInput } from '@/lib/platform/subscription-data';
import { logAdminAction } from '@/lib/platform/audit';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  await ensureHydrated();
  return ok(getPlanConfigsSync());
}

// Create a new plan. Owner-only — same privilege level as the PUT
// /plans/[planId] mutation. The new plan is appended to the same
// shared plan-config cache the Client Billing page reads, so it
// appears on the Client Billing page (as an "other plan" the client
// can switch to) on the next read. planId must be unique.
export async function POST(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => ({}))) as PlanConfigInput & {
    planId?: string;
    name?: string;
  };
  const planId = (body.planId ?? '').trim().toLowerCase();
  const name = (body.name ?? '').trim();
  if (!planId || !name) {
    return fail('VALIDATION_ERROR', 'planId and name are required.', 400);
  }
  // Reject duplicate planId — the singleton cache is keyed by planId.
  const existing = getPlanConfigsSync().find((p) => p.planId === planId);
  if (existing) {
    return fail('CONFLICT', `A plan with id "${planId}" already exists.`, 409);
  }
  // Validate the input — surfaces clear errors for invalid prices, negative
  // limits (except -1), invalid intervals / currencies / feature keys.
  const errors = validatePlanConfigInput(body);
  if (errors.length > 0) {
    return fail('VALIDATION_ERROR', errors.join(' '), 400);
  }
  try {
    const created = await createPlanConfig({
      planId,
      name,
      priceMonthly: body.priceMonthly,
      priceYearly: body.priceYearly,
      currency: body.currency,
      interval: body.interval,
      isFree: body.isFree,
      freePlanDurationDays: body.freePlanDurationDays,
      stripePriceIdMonthly: body.stripePriceIdMonthly,
      stripePriceIdYearly: body.stripePriceIdYearly,
      active: body.active,
      features: body.features,
      entitlements: body.entitlements,
      limits: body.limits,
      badgeVariant: body.badgeVariant ?? planId,
      sortOrder: body.sortOrder,
    });
    await logAdminAction({
      userId: auth.user.id,
      action: 'plan.create',
      resourceType: 'PlanConfig',
      resourceId: planId,
      details: `${created.name}: ${created.priceMonthly} ${created.currency}/mo, features=${created.features.length}, entitlements=${created.entitlements.length}`,
      ipAddress: getClientIp(request) ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return ok(created, { status: 201 });
  } catch (err) {
    return fail(
      'SERVER_ERROR',
      err instanceof Error ? err.message : 'Unable to create plan.',
      500,
    );
  }
}
