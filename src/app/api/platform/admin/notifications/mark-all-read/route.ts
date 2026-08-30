// ============================================================
// POST /api/platform/admin/notifications/mark-all-read
//   Marks ALL persisted notifications as read. Returns the count
//   of rows actually updated.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';
import { markAllNotificationsRead } from '@/lib/notifications';

function reqId(): string {
  return `req_platnotif_mar_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: NextRequest) {
  const id = reqId();
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  try {
    // Body is irrelevant for mark-all-read — accept empty body.
    await request.json().catch(() => null);
    const updated = await markAllNotificationsRead();
    return NextResponse.json({
      data: { updated },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[PLATFORM:NOTIFICATIONS:MARK_ALL_READ] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to mark all notifications as read' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
