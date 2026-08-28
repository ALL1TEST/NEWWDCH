import { NextRequest } from 'next/server';
import { requirePlatformAdmin, ok } from '@/lib/platform/platform-auth';
import { runHealthChecks } from '@/lib/platform/system-health';

// GET /api/platform/admin/system-health
// Runs REAL platform infrastructure checks (DB query, filesystem
// probe, persisted provider/SMTP state, ErrorLog + SystemMetric
// reads) and returns the full diagnostic snapshot consumed by the
// System Health page. The same checker powers the Overview summary
// (via getOverview → getSystemHealth) so the two views never disagree.
export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  return ok(await runHealthChecks());
}

// POST /api/platform/admin/system-health
// Explicit "Refresh checks" trigger. Re-runs the same live checks
// (and records a fresh history snapshot if the per-minute throttle
// has elapsed). The frontend uses this when the operator clicks the
// "Refresh checks" button so the action is unmistakably a real re-run
// rather than a cache hit.
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;
  return ok(await runHealthChecks());
}
