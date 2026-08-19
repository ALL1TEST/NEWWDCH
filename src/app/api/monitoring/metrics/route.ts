// ============================================================
// GET  /api/monitoring/metrics  — Query SystemMetric for charts
// POST /api/monitoring/metrics  — Record a new metric
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const VALID_METRIC_TYPES = new Set([
  'cpu', 'ram', 'disk', 'network_in', 'network_out',
  'requests', 'response_time', 'db_queries', 'cache_hit_ratio',
  'queue_throughput', 'ai_usage',
]);
const SORTABLE = new Set(['createdAt', 'value', 'metricType']);

// =====================================================================
// GET — query metrics for charts
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number(sp.get('pageSize')) || 100));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'desc' ? 'desc' : 'asc';
    const type = sp.get('type') || undefined;
    const siteId = sp.get('siteId') || undefined;
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');

    const where: Record<string, unknown> = {};
    if (type && VALID_METRIC_TYPES.has(type)) where.metricType = type;
    if (siteId) where.siteId = siteId;
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.systemMetric.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.systemMetric.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[MONITORING:METRICS:QUERY] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to query metrics' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — record a new metric
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  try {
    const body = await request.json();
    const { metricType, value, unit, labels, siteId } = body;

    if (!metricType || typeof metricType !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'metricType (string) is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }
    if (typeof value !== 'number' || !isFinite(value)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'value (number) is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const metric = await db.systemMetric.create({
      data: {
        metricType,
        value,
        unit: typeof unit === 'string' ? unit : null,
        labels: labels ? JSON.stringify(labels) : null,
        siteId: typeof siteId === 'string' ? siteId : null,
      },
    });

    return NextResponse.json({ data: metric, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[MONITORING:METRICS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to record metric' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
