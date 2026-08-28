// ============================================================
// PLATFORM ADMIN NOTIFICATIONS — derived, unified event feed.
// ============================================================
// GET    /api/platform/admin/notifications
//   Query:  type=<INFO|SUCCESS|WARNING|ERROR|ACTION_REQUIRED>
//           isRead=<true|false>
//           page=<1-based, default 1>
//           pageSize=<1..100, default 25>
//   Returns: { data: PlatformEvent[], meta: { pagination: { page, pageSize, total, totalPages } } }
//
// POST   /api/platform/admin/notifications     { notificationIds: string[] }
//   Mark-as-read no-op. The platform event feed is DERIVED from
//   platform-data.ts (customers, payments, subscriptions, audit
//   log, alerts) on every request — there is no persisted
//   Notification row to mutate. Returns 200 OK with `{ updated: 0 }`
//   so the Client Notifications UI's mutation flow can be reused
//   verbatim. In a real implementation, persist read-state in a
//   separate `platform_event_read` table keyed by event id + admin
//   user id; the derived feed would then left-join that table.
//
// DELETE /api/platform/admin/notifications
//   Delete-all no-op (same rationale: derived, not persisted).
//   Returns 200 OK.
//
// Auth: requirePlatformAdmin — accepts PLATFORM_ADMIN or OWNER
// (the file calls this "platform admin OR owner"; the helper is
// named requirePlatformAdmin in platform-auth.ts). This is the
// same guard the rest of /api/platform/admin/* uses.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';
import {
  getPlatformEvents,
  type PlatformEvent,
} from '@/lib/platform/platform-data';
import type { NotificationType, PaginationMeta } from '@/shared/types';

const VALID_TYPES = new Set<NotificationType>([
  'INFO',
  'SUCCESS',
  'WARNING',
  'ERROR',
  'ACTION_REQUIRED',
]);

function reqId(): string {
  return `req_platnotif_${Math.random().toString(36).slice(2, 10)}`;
}

// =====================================================================
// GET — list (paginated + filtered)
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));

    const rawType = sp.get('type');
    const type =
      rawType && VALID_TYPES.has(rawType as NotificationType)
        ? (rawType as NotificationType)
        : undefined;

    const rawIsRead = sp.get('isRead');
    const isRead =
      rawIsRead === 'true' ? true : rawIsRead === 'false' ? false : undefined;

    // Derive fresh on every call — no caching, no persistence.
    let list: PlatformEvent[] = getPlatformEvents();
    if (type) list = list.filter((e) => e.type === type);
    if (isRead !== undefined) list = list.filter((e) => e.isRead === isRead);

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const data = list.slice(start, start + pageSize);

    const pagination: PaginationMeta = {
      page: safePage,
      pageSize,
      total,
      totalPages,
    };

    return NextResponse.json({
      data,
      meta: { requestId: id, pagination },
    });
  } catch (error) {
    console.error(`[PLATFORM:NOTIFICATIONS:LIST] ${id} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch platform notifications',
        },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — mark-as-read (no-op, derived feed)
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  // Body is accepted for API parity with /api/notifications but is
  // ignored — there is no persisted row to update.
  try {
    await request.json().catch(() => null);
  } catch {
    // swallow — body is irrelevant for a no-op
  }

  return NextResponse.json({
    data: {
      updated: 0,
      note: 'Platform events are derived fresh on each request — read-state is not persisted. See route header comment for the production design.',
    },
    meta: { requestId: id },
  });
}

// =====================================================================
// DELETE — delete-all (no-op, derived feed)
// =====================================================================

export async function DELETE(request: NextRequest) {
  const id = reqId();
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  return NextResponse.json({
    data: {
      deleted: 0,
      note: 'Platform events are derived fresh on each request — there is nothing to delete. See route header comment for the production design.',
    },
    meta: { requestId: id },
  });
}
