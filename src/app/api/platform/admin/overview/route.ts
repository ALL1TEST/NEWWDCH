import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok } from '@/lib/platform/platform-auth';
import { getOverview } from '@/lib/platform/platform-data';
import { getSystemHealthSummary } from '@/lib/platform/system-health';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  // getOverview() is sync + client-bundle-safe; the real, live health
  // summary is composed here at the route level (server-only) so the
  // System Health summary on Overview can never disagree with the
  // dedicated System Health page — both come from the same checker.
  const overview = getOverview();
  const systemHealth = await getSystemHealthSummary();
  return ok({ ...overview, systemHealth });
}
