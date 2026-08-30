import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { suspendCustomer, getCustomer } from '@/lib/platform/platform-data';
import { logAdminAction } from '@/lib/platform/audit';

// ============================================================
// PLATFORM ADMIN → SUSPEND CUSTOMER.
// ============================================================
// Sets User.status = 'SUSPENDED' (the customer can no longer sign in
// or use gated features). The user's Subscription row is NOT touched
// — billing continues to run; only login is blocked. To cancel the
// billing too, use the dedicated /cancel route (Task 78-E).
//
// `suspendCustomer` is async + DB-backed (Task 78-D): writes the
// User row + best-effort in-memory audit. The route then writes the
// canonical DB AuditLog row via `logAdminAction`.
// ============================================================

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const updated = await suspendCustomer(id, auth.user.email);
  if (!updated) return fail('NOT_FOUND', 'Customer not found.', 404);
  await logAdminAction({
    userId: auth.user.id,
    action: 'customer.suspended',
    resourceType: 'Customer',
    resourceId: id,
    details: `${updated.name} (${updated.email})`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  return ok(await getCustomer(id));
}
