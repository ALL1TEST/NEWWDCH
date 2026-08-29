import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok } from '@/lib/platform/platform-auth';
import { getOverview } from '@/lib/platform/platform-data';
import { getSystemHealthSummary } from '@/lib/platform/system-health';

// ============================================================
// PLATFORM ADMIN → OVERVIEW (Dashboard).
// ============================================================
// `getOverview()` is now async + DB-backed (Task 78-D) — reads the
// live User + Subscription + Payment tables for totalCustomers /
// activeSubscriptions / mrr / planDistribution / statusCounts /
// recentCustomers / recentPayments / alerts. The Dashboard now
// always agrees with the Customers / Subscriptions / Payments pages
// (same rows, same counts, same MRR).
//
// The real, live health summary is composed here at the route level
// (server-only, imports fs + db via system-health) so the System
// Health summary on Overview can never disagree with the dedicated
// System Health page — both come from the same checker.
//
// NOTE: `getOverview()` now ALSO returns real recentPayments (from
// the Payment table), so the route-level overlay that Task 75 added
// is no longer needed — it's already in `overview.recentPayments`.
// The route just overlays `systemHealth`.
// ============================================================

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  const overview = await getOverview();
  const systemHealth = await getSystemHealthSummary();
  return ok({ ...overview, systemHealth });
}
