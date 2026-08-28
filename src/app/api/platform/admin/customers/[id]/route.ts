import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail } from '@/lib/platform/platform-auth';
import { getCustomer, suspendCustomer, reactivateCustomer, changeCustomerPlan } from '@/lib/platform/platform-data';
import type { PlanId } from '@/lib/platform/platform-data';

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const customer = getCustomer(id);
  if (!customer) return fail('NOT_FOUND', 'Customer not found', 404);
  return ok(customer);
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as string | undefined;
  if (action === 'suspend') {
    const c = suspendCustomer(id, auth.user.email);
    if (!c) return fail('NOT_FOUND', 'Customer not found', 404);
    return ok(getCustomer(id));
  }
  if (action === 'reactivate') {
    const c = reactivateCustomer(id, auth.user.email);
    if (!c) return fail('NOT_FOUND', 'Customer not found', 404);
    return ok(getCustomer(id));
  }
  if (action === 'change-plan') {
    const planId = body.planId as PlanId | undefined;
    if (!planId) return fail('VALIDATION_ERROR', 'planId is required', 400);
    const c = changeCustomerPlan(id, planId, auth.user.email);
    if (!c) return fail('NOT_FOUND', 'Customer not found', 404);
    return ok(getCustomer(id));
  }
  return fail('VALIDATION_ERROR', 'Unknown action', 400);
}
