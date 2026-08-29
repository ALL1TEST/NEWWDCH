import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { upsertOverride, deleteOverride, listOverrides } from '@/lib/platform/usage-limits';
import { logAdminAction } from '@/lib/platform/audit';
import { ENTITLEMENT_KEYS } from '@/lib/platform/plan-config';

// Per-customer feature override — grants or revokes a single entitlement
// for a customer WITHOUT changing their plan (e.g. "Beta + Automation
// enabled until 2025-12-31"). Enforced server-side via hasFeature().
export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  // id here is the customer id; we need the email for overrides (keyed by email).
  // NOTE: getCustomer is async (Task 78-D) — awaits the real DB user + sub.
  const { getCustomer } = await import('@/lib/platform/platform-data');
  const customer = await getCustomer(id);
  if (!customer) return fail('NOT_FOUND', 'Customer not found.', 404);
  return ok({ overrides: await listOverrides(customer.email), available: [...ENTITLEMENT_KEYS] });
}

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const body = (await request.json().catch(() => ({}))) as {
    feature?: string;
    granted?: boolean;
    grantedUntil?: string | null;
    reason?: string | null;
    action?: 'set' | 'delete';
  };
  if (!body.feature) return fail('VALIDATION_ERROR', 'feature is required.', 400);
  const { getCustomer } = await import('@/lib/platform/platform-data');
  const customer = await getCustomer(id);
  if (!customer) return fail('NOT_FOUND', 'Customer not found.', 404);

  if (body.action === 'delete') {
    await deleteOverride(customer.email, body.feature);
    await logAdminAction({
      userId: auth.user.id,
      action: 'customer.override_removed',
      resourceType: 'CustomerEntitlementOverride',
      resourceId: id,
      details: `${customer.email}: ${body.feature} override removed`,
      ipAddress: getClientIp(request) ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return ok({ overrides: await listOverrides(customer.email), available: [...ENTITLEMENT_KEYS] });
  }

  await upsertOverride({
    customerEmail: customer.email,
    feature: body.feature,
    granted: body.granted ?? true,
    grantedUntil: body.grantedUntil ?? null,
    reason: body.reason ?? null,
    createdBy: auth.user.email,
  });
  await logAdminAction({
    userId: auth.user.id,
    action: body.granted === false ? 'customer.feature_revoked' : 'customer.feature_granted',
    resourceType: 'CustomerEntitlementOverride',
    resourceId: id,
    details: `${customer.email}: ${body.feature} ${body.granted === false ? 'revoked' : 'granted'}${body.grantedUntil ? ` until ${body.grantedUntil}` : ''}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok({ overrides: await listOverrides(customer.email), available: [...ENTITLEMENT_KEYS] });
}
