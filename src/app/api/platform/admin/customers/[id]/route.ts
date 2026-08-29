import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail } from '@/lib/platform/platform-auth';
import { getCustomer, suspendCustomer, reactivateCustomer, changeCustomerPlan } from '@/lib/platform/platform-data';
import type { PlanId } from '@/lib/platform/platform-data';

// ============================================================
// PLATFORM ADMIN → CUSTOMER DETAIL + GENERIC PATCH DISPATCHER.
// ============================================================
// GET    /api/platform/admin/customers/[id]
//   Returns the CustomerDetail (real DB user + sub + payments) or 404.
//
// PATCH  /api/platform/admin/customers/[id]   { action, ... }
//   Generic dispatcher for suspend / reactivate / change-plan. The
//   dedicated routes (/suspend, /reactivate, /change-plan, /cancel)
//   are the canonical paths the Platform Admin UI calls; this PATCH
//   remains for parity with the legacy contract.
//
// `id` is the User.id (NOT the legacy mock cus_ id). `getCustomer` is
// async DB-backed (Task 78-D) — awaits the live User + Subscription +
// Payment rows and returns the SAME CustomerDetail shape the UI
// consumes (only the data source switched from mock to real DB).
// ============================================================

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const customer = await getCustomer(id);
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
    const c = await suspendCustomer(id, auth.user.email);
    if (!c) return fail('NOT_FOUND', 'Customer not found', 404);
    return ok(await getCustomer(id));
  }
  if (action === 'reactivate') {
    const c = await reactivateCustomer(id, auth.user.email);
    if (!c) return fail('NOT_FOUND', 'Customer not found', 404);
    return ok(await getCustomer(id));
  }
  if (action === 'change-plan') {
    const planId = body.planId as PlanId | undefined;
    if (!planId) return fail('VALIDATION_ERROR', 'planId is required', 400);
    const c = await changeCustomerPlan(id, planId, auth.user.email);
    if (!c) return fail('NOT_FOUND', 'Customer not found', 404);
    return ok(await getCustomer(id));
  }
  return fail('VALIDATION_ERROR', 'Unknown action', 400);
}
