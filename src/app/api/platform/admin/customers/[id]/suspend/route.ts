import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { suspendCustomer, getCustomer } from '@/lib/platform/platform-data';
import { logAdminAction } from '@/lib/platform/audit';

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const id = request.nextUrl.pathname.split('/').filter(Boolean).at(-2)!;
  const updated = suspendCustomer(id, auth.user.email);
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
  return ok(getCustomer(id));
}
