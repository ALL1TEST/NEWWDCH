import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { clientChangePlan } from '@/lib/platform/platform-data';
import { ensurePlanAssignable } from '@/lib/platform/subscription-data';
import type { PlanId } from '@/lib/platform/platform-data';

// The canonical plan catalog. New plans created via Platform Admin are
// not auto-added here; they're checked dynamically against the PlanConfig
// table via ensurePlanAssignable() below.
const VALID: PlanId[] = ['free', 'plus', 'pro', 'max'];

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const body = await request.json().catch(() => ({}));
  const planId = body.planId as PlanId | undefined;
  if (!planId || !VALID.includes(planId)) {
    return fail('VALIDATION_ERROR', 'A valid planId (free|plus|pro|max) is required.', 400);
  }
  // Refuse to switch to an inactive plan.
  const assignable = await ensurePlanAssignable(planId);
  if (!assignable.ok) {
    return fail('PLAN_NOT_AVAILABLE', assignable.reason ?? 'Plan is not available.', 403);
  }
  const state = await clientChangePlan(auth.user, planId);
  if (!state) {
    // Either no DB subscription row could be created, or the user tried to
    // switch to a paid plan directly (which requires /api/billing/checkout).
    return fail(
      'CHECKOUT_REQUIRED',
      'Paid plans must be subscribed via /api/billing/checkout (Stripe). Free plans can be selected directly.',
      402,
    );
  }
  return ok(state);
}
