// ============================================================
// GET /api/platform/admin/notifications/unread-count
//   Returns the count of UNREAD persisted notifications for the
//   platform admin. Also runs the periodic platform-scan (idempotent
//   via dedupeKey) so the bell always reflects the latest past-due
//   subs / failed payments / new customers.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';
import { getUnreadNotificationCount, scanPlatformForNotifications } from '@/lib/notifications';

function reqId(): string {
  return `req_platnotif_uc_${Math.random().toString(36).slice(2, 10)}`;
}

export async function GET(request: NextRequest) {
  const id = reqId();
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  try {
    // Best-effort: scan first so any new past-due / failed / new-customer
    // event shows up in the count immediately. Idempotent.
    await scanPlatformForNotifications();
    const count = await getUnreadNotificationCount();
    return NextResponse.json({ data: { count }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[PLATFORM:NOTIFICATIONS:UNREAD_COUNT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch unread count' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
