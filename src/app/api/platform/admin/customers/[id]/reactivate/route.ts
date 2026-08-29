import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { reactivateCustomer, getCustomer } from '@/lib/platform/platform-data';
import { logAdminAction } from '@/lib/platform/audit';

// ============================================================
// PLATFORM ADMIN → REACTIVATE CUSTOMER.
// ============================================================
// Sets User.status = 'ACTIVE' (the customer can sign in again). Best
// effort: if the user's Subscription was 'cancelled', set it back to
// 'active' so the customer regains plan access immediately. (Use the
// dedicated /cancel route to cancel billing — reactivating does NOT
// re-subscribe a previously-cancelled-and-finalized subscription.)
//
// `reactivateCustomer` is async + DB-backed (Task 78-D): writes the
// User row (and best-effort the Subscription row) + best-effort
// in-memory audit. The route then writes the canonical DB AuditLog
// row via `logAdminAction`.
// ============================================================

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const updated = await reactivateCustomer(id, auth.user.email);
  if (!updated) return fail('NOT_FOUND', 'Customer not found.', 404);
  await logAdminAction({
    userId: auth.user.id,
    action: 'customer.reactivated',
    resourceType: 'Customer',
    resourceId: id,
    details: `${updated.name} (${updated.email})`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(await getCustomer(id));
}
