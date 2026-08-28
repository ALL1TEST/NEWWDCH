import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { getPlanConfigsSync, ensureHydrated } from '@/lib/platform/plan-config';
import { logAdminAction } from '@/lib/platform/audit';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  await ensureHydrated();
  return ok(getPlanConfigsSync());
}
