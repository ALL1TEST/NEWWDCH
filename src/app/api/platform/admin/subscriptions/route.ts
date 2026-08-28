import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok } from '@/lib/platform/platform-auth';
import { listSubscriptions } from '@/lib/platform/platform-data';
import type { PlanId, SubscriptionStatus } from '@/lib/platform/platform-data';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') as SubscriptionStatus | 'all' | null) ?? 'all';
  const planId = (searchParams.get('planId') as PlanId | 'all' | null) ?? 'all';
  return ok(listSubscriptions({ status, planId }));
}
