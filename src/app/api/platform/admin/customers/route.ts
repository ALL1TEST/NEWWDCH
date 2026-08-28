import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok } from '@/lib/platform/platform-auth';
import { listCustomers } from '@/lib/platform/platform-data';
import type { PlanId, SubscriptionStatus } from '@/lib/platform/platform-data';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? undefined;
  const planId = (searchParams.get('planId') as PlanId | 'all' | null) ?? 'all';
  const status = (searchParams.get('status') as SubscriptionStatus | 'all' | null) ?? 'all';
  return ok(listCustomers({ search, planId, status }));
}
