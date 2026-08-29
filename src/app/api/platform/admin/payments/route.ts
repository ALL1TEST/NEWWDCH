import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok, fail } from '@/lib/platform/platform-auth';
import { listPayments } from '@/lib/platform/platform-data';
import type { PaymentStatus } from '@/lib/platform/platform-data';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') as PaymentStatus | 'all' | null) ?? 'all';
  const search = searchParams.get('search') ?? undefined;
  // listPayments is async — it queries the real Payment table (joined to
  // User + Subscription) instead of the old in-memory mock array.
  try {
    return ok(await listPayments({ status, search }));
  } catch (err) {
    // Log the real error server-side; return a generic message to the
    // client (don't leak Prisma internals / SQL fragments).
    console.error('[payments] listPayments error:', err);
    return fail('PAYMENTS_QUERY_ERROR', 'Could not load payments. Please retry.', 500);
  }
}
