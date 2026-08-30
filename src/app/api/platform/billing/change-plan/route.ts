import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { clientChangePlan } from '@/lib/platform/platform-data';
import { ensurePlanAssignable } from '@/lib/platform/subscription-data';

// The canonical plan catalog is dynamic — read from the PlanConfig table.
// Custom plans created via Platform Admin must flow through this route
// just like the canonical free/plus/pro/max ids. Validation is done
// against the DB via `ensurePlanAssignable`, not a hardcoded whitelist.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const body = await request.json().catch(() => ({}));
  const planId = String(body.planId ?? '');
  if (!planId) {
    return fail('VALIDATION_ERROR', 'A valid planId is required.', 400);
  }
  // Refuse to switch to an inactive or non-existent plan.
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
