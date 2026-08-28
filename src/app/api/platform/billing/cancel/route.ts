import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { clientCancelSubscription } from '@/lib/platform/platform-data';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const state = clientCancelSubscription(auth.user);
  if (!state) return fail('NOT_FOUND', 'No customer record for this account.', 404);
  return ok(state);
}
