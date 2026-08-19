// ============================================================
// GET  /api/monitoring/alert-rules  — List all alert rules
// POST /api/monitoring/alert-rules  — Create a new alert rule
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

// =====================================================================
// GET — list alert rules
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const isActive = sp.get('isActive');
    const siteId = sp.get('siteId') || undefined;

    const where: Record<string, unknown> = {};
    if (isActive !== null && isActive !== undefined && isActive !== '') where.isActive = isActive === 'true';
    if (siteId) where.siteId = siteId;

    const items = await db.alertRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: items, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MONITORING:ALERT_RULES:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch alert rules' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create alert rule
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  try {
    const body = await request.json();
    const { name, description, metricType, condition, threshold, durationSec, severity, channels, cooldownSec, siteId } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'name (non-empty string) is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }
    if (!metricType || typeof metricType !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'metricType (string) is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }
    if (!condition || !VALID_CONDITION.has(condition)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'condition must be gt, gte, lt, lte, eq, or neq' }, meta: { requestId: id } },
        { status: 400 },
      );
    }
    if (typeof threshold !== 'number') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'threshold (number) is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const validSeverity = severity && VALID_SEVERITY.has(severity) ? severity : 'HIGH';

    // Validate channels
    let parsedChannels: string[] = ['IN_APP'];
    if (Array.isArray(channels)) {
      parsedChannels = channels.filter((c: string) => VALID_CHANNELS.has(c));
      if (parsedChannels.length === 0) parsedChannels = ['IN_APP'];
    }

    const rule = await db.alertRule.create({
      data: {
        name: name.trim(),
        description: typeof description === 'string' ? description : '',
        metricType,
        condition,
        threshold,
        durationSec: typeof durationSec === 'number' ? durationSec : 60,
        severity: validSeverity,
        channels: JSON.stringify(parsedChannels),
        cooldownSec: typeof cooldownSec === 'number' ? cooldownSec : 300,
        siteId: typeof siteId === 'string' ? siteId : null,
      },
    });

    return NextResponse.json({ data: rule, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[MONITORING:ALERT_RULES:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create alert rule' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
