import { NextRequest } from 'next/server';
import { requireAuth, ok } from '@/lib/platform/platform-auth';
import { getClientBillingAsync } from '@/lib/platform/platform-data';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  // Async path: prefers DB Subscription row over the legacy in-memory
  // customer. Returns the full ClientBillingState with billingInterval,
  // currentPeriodEnd, trialEnd, freeTrialExpiresAt, stripeSubscriptionId, etc.
  return ok(await getClientBillingAsync(auth.user));
}
