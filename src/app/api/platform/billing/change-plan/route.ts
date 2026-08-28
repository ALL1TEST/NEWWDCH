import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { clientChangePlan } from '@/lib/platform/platform-data';
import type { PlanId } from '@/lib/platform/platform-data';

const VALID: PlanId[] = ['beta', 'pro', 'max'];

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const body = await request.json().catch(() => ({}));
  const planId = body.planId as PlanId | undefined;
  if (!planId || !VALID.includes(planId)) {
    return fail('VALIDATION_ERROR', 'A valid planId (beta|pro|max) is required.', 400);
  }
  const state = clientChangePlan(auth.user, planId);
  if (!state) return fail('NOT_FOUND', 'No customer record for this account (or plan unavailable).', 404);
  return ok(state);
}
