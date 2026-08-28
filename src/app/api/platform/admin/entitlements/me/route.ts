import { NextRequest } from 'next/server';
import { requireAuth, ok } from '@/lib/platform/platform-auth';
import { listEntitlementsForUser, type EntitlementUser } from '@/lib/platform/entitlements';

// Returns the set of entitlements the current user has access to. Used by
// the client to COSMETICALLY hide nav items — the authoritative check is
// hasFeature() enforced server-side on each feature route.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const user: EntitlementUser = {
    id: auth.user.id,
    email: auth.user.email,
    role: auth.user.role,
    billingMode: auth.user.billingMode,
  };
  const entitlements = await listEntitlementsForUser(user);
  return ok({ entitlements, billingMode: auth.user.billingMode });
}
