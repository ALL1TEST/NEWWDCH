// ============================================================
// PATCH  /api/monitoring/alerts/[id]  — Acknowledge, resolve, or snooze
// DELETE /api/monitoring/alerts/[id]  — Delete an alert
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const VALID_ACTIONS = new Set(['acknowledge', 'resolve', 'snooze']);

// =====================================================================
// PATCH — update alert
// =====================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = reqId();

  try {
    const { id: alertId } = await params;
    const body = await request.json();
    const { action, userId, snoozeUntil } = body;

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'action must be acknowledge, resolve, or snooze' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const existing = await db.alert.findUnique({ where: { id: alertId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Alert not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};

    if (action === 'acknowledge') {
      if (existing.status !== 'TRIGGERED' && existing.status !== 'SNOOZED') {
        return NextResponse.json(
          { error: { code: 'CONFLICT', message: `Cannot acknowledge alert with status ${existing.status}` }, meta: { requestId: id } },
          { status: 409 },
        );
      }
      updateData.status = 'ACKNOWLEDGED';
      updateData.acknowledgedById = typeof userId === 'string' ? userId : null;
      updateData.acknowledgedAt = new Date();
    } else if (action === 'resolve') {
      if (existing.status === 'RESOLVED') {
        return NextResponse.json(
          { error: { code: 'CONFLICT', message: 'Alert is already resolved' }, meta: { requestId: id } },
          { status: 409 },
        );
      }
      updateData.status = 'RESOLVED';
      updateData.resolvedById = typeof userId === 'string' ? userId : null;
      updateData.resolvedAt = new Date();
    } else if (action === 'snooze') {
      if (existing.status !== 'TRIGGERED' && existing.status !== 'ACKNOWLEDGED') {
        return NextResponse.json(
          { error: { code: 'CONFLICT', message: `Cannot snooze alert with status ${existing.status}` }, meta: { requestId: id } },
          { status: 409 },
        );
      }
      updateData.status = 'SNOOZED';
      // Default snooze: 1 hour from now
      updateData.updatedAt = new Date();
      // Store snoozeUntil in channels JSON field as metadata
      try {
        const meta = JSON.parse(existing.channels || '[]');
        if (Array.isArray(meta)) {
          updateData.channels = JSON.stringify([...meta, { _snoozedUntil: snoozeUntil || new Date(Date.now() + 3600_000).toISOString() }]);
        }
      } catch { /* ignore parse error */ }
    }

    const updated = await db.alert.update({
      where: { id: alertId },
      data: updateData,
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MONITORING:ALERTS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update alert' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — delete alert
// =====================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = reqId();

  try {
    const { id: alertId } = await params;

    const existing = await db.alert.findUnique({ where: { id: alertId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Alert not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.alert.delete({ where: { id: alertId } });

    return NextResponse.json({ data: { deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MONITORING:ALERTS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete alert' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
