// ============================================================
// Error Logs API
// GET    /api/monitoring/error-logs  — List error logs (paginated, filtered)
// POST   /api/monitoring/error-logs  — Create a new error log
// PATCH  /api/monitoring/error-logs  — Resolve an error log
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const VALID_SEVERITY = new Set(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'FATAL']);
const SORTABLE = new Set(['createdAt', 'updatedAt', 'severity', 'module', 'exception']);

// =====================================================================
// GET — list error logs
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const severity = sp.get('severity') || undefined;
    const moduleFilter = sp.get('module') || undefined;
    const isResolved = sp.get('isResolved');
    const siteId = sp.get('siteId') || undefined;
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');

    const where: Record<string, unknown> = {};
    if (severity && VALID_SEVERITY.has(severity)) where.severity = severity;
    if (moduleFilter) where.module = { contains: moduleFilter };
    if (isResolved !== null && isResolved !== undefined && isResolved !== '') where.isResolved = isResolved === 'true';
    if (siteId) where.siteId = siteId;
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.errorLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      db.errorLog.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[MONITORING:ERROR_LOGS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch error logs' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create error log
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  try {
    const body = await request.json();
    const { exception, message, stackTrace, module, url, httpMethod, userId, ipAddress, userAgent, severity, environment, siteId } = body;

    if (!exception || typeof exception !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'exception (string) is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const validSeverity = VALID_SEVERITY.has(severity) ? severity : 'ERROR';

    const errorLog = await db.errorLog.create({
      data: {
        exception,
        message: typeof message === 'string' ? message : '',
        stackTrace: typeof stackTrace === 'string' ? stackTrace : null,
        module: typeof module === 'string' ? module : '',
        url: typeof url === 'string' ? url : null,
        httpMethod: typeof httpMethod === 'string' ? httpMethod : null,
        userId: typeof userId === 'string' ? userId : null,
        ipAddress: typeof ipAddress === 'string' ? ipAddress : null,
        userAgent: typeof userAgent === 'string' ? userAgent : null,
        severity: validSeverity,
        environment: typeof environment === 'string' ? environment : 'production',
        siteId: typeof siteId === 'string' ? siteId : null,
      },
    });

    return NextResponse.json({ data: errorLog, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[MONITORING:ERROR_LOGS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create error log' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — resolve error log
// =====================================================================

export async function PATCH(request: NextRequest) {
  const id = reqId();

  try {
    const body = await request.json();
    const { errorId, resolvedById } = body;

    if (!errorId || typeof errorId !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'errorId (string) is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const existing = await db.errorLog.findUnique({ where: { id: errorId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Error log not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    if (existing.isResolved) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'Error log is already resolved' }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    const updated = await db.errorLog.update({
      where: { id: errorId },
      data: {
        isResolved: true,
        resolvedById: typeof resolvedById === 'string' ? resolvedById : null,
        resolvedAt: new Date(),
      },
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MONITORING:ERROR_LOGS:RESOLVE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve error log' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
