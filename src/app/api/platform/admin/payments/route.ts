import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok } from '@/lib/platform/platform-auth';
import { listPayments } from '@/lib/platform/platform-data';
import type { PaymentStatus } from '@/lib/platform/platform-data';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') as PaymentStatus | 'all' | null) ?? 'all';
  const search = searchParams.get('search') ?? undefined;
  return ok(listPayments({ status, search }));
}
