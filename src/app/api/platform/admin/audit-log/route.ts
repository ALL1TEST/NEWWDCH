import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok } from '@/lib/platform/platform-auth';
import { getAuditLog } from '@/lib/platform/platform-data';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? 50);
  return ok(getAuditLog(limit));
}
