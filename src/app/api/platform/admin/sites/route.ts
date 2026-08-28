import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok } from '@/lib/platform/platform-auth';
import { listSites } from '@/lib/platform/platform-data';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  return ok(listSites());
}
