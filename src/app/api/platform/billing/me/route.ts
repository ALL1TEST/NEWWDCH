import { NextRequest } from 'next/server';
import { requireAuth, ok } from '@/lib/platform/platform-auth';
import { getClientBilling } from '@/lib/platform/platform-data';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  return ok(getClientBilling(auth.user.email));
}
