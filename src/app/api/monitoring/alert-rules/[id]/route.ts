// ============================================================
// PATCH  /api/monitoring/alert-rules/[id]  — Update alert rule
// DELETE /api/monitoring/alert-rules/[id]  — Delete alert rule
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const VALID_SEVERITY = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const VALID_CONDITION = new Set(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']);
const VALID_CHANNELS = new Set(['IN_APP', 'EMAIL', 'WEBHOOK', 'SLACK', 'DISCORD', 'TELEGRAM']);

const UPDATABLE_FIELDS = new Set([
  'name', 'description', 'metricType', 'condition', 'threshold',
  'durationSec', 'severity', 'channels', 'cooldownSec', 'isActive', 'siteId',
]);

// =====================================================================
// PATCH — update alert rule
// =====================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = reqId();

  try {
    const { id: ruleId } = await params;
    const body = await request.json();

    const existing = await db.alertRule.findUnique({ where: { id: ruleId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Alert rule not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    const data: Record<string, unknown> = { updatedAt: new Date() };

    for (const [key, value] of Object.entries(body)) {
      if (!UPDATABLE_FIELDS.has(key)) continue;

      if (key === 'severity' && !VALID_SEVERITY.has(value as string)) continue;
      if (key === 'condition' && !VALID_CONDITION.has(value as string)) continue;
      if (key === 'channels') {
        if (Array.isArray(value)) {
          const filtered = value.filter((c: string) => VALID_CHANNELS.has(c));
          data.channels = JSON.stringify(filtered.length > 0 ? filtered : ['IN_APP']);
        }
        continue;
      }
      if (key === 'isActive') {
        data.isActive = Boolean(value);
        continue;
      }

      data[key] = value;
    }

    const updated = await db.alertRule.update({
      where: { id: ruleId },
      data,
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MONITORING:ALERT_RULES:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update alert rule' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — delete alert rule
// =====================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = reqId();

  try {
    const { id: ruleId } = await params;

    const existing = await db.alertRule.findUnique({ where: { id: ruleId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Alert rule not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Cascade deletes related alerts
    await db.alertRule.delete({ where: { id: ruleId } });

    return NextResponse.json({ data: { deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MONITORING:ALERT_RULES:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete alert rule' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
