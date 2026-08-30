// ============================================================
// /api/platform/admin/notifications/[id]
//
// PATCH  — toggle read state. Body: { isRead: boolean }
//   When true, marks the notification as read. When false, marks it
//   unread (so admins can "snooze" a notification back to the unread
//   state for follow-up later).
// DELETE — permanently remove the single notification row.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';
import {
  markNotificationRead,
  markNotificationUnread,
  deleteNotification,
} from '@/lib/notifications';
import { z } from 'zod/v4';

function reqId(): string {
  return `req_platnotif_id_${Math.random().toString(36).slice(2, 10)}`;
}

const patchSchema = z.object({
  isRead: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = reqId();
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  const { id: notifId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }
    if (parsed.data.isRead) {
      await markNotificationRead(notifId);
    } else {
      await markNotificationUnread(notifId);
    }
    return NextResponse.json({ data: { id: notifId, isRead: parsed.data.isRead }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[PLATFORM:NOTIFICATIONS:PATCH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update notification' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = reqId();
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  const { id: notifId } = await params;

  try {
    await deleteNotification(notifId);
    return NextResponse.json({ data: { id: notifId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[PLATFORM:NOTIFICATIONS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete notification' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
