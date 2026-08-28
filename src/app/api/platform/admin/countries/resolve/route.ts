import { NextRequest } from 'next/server';
import { requireAuth, ok, fail } from '@/lib/platform/platform-auth';
import { resolvePrice } from '@/lib/platform/country-pricing';

// Server-determined price for a plan in the caller's country. The client
// cannot change currency in the frontend to obtain a different price —
// the server is the authority.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const planId = request.nextUrl.searchParams.get('planId');
  const countryCode = request.nextUrl.searchParams.get('country');
  if (!planId) return fail('VALIDATION_ERROR', 'planId query param is required.', 400);
  const resolved = await resolvePrice(planId, countryCode);
  return ok(resolved);
}
