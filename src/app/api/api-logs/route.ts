// ============================================================
// GET /api/api-logs — List API logs (admin)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

function reqId() { return 'req_' + nanoid(8); }

const SORTABLE = new Set(['createdAt', 'method', 'statusCode', 'duration', 'path', 'ipAddress']);

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(sp.get('pageSize')) || 50));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';

    const method = sp.get('method');
    const statusCode = sp.get('statusCode');
    const path = sp.get('path')?.trim();
    const apiKeyId = sp.get('apiKeyId');
    const siteId = sp.get('siteId');
    const ipAddress = sp.get('ipAddress')?.trim();
    const search = sp.get('search')?.trim();
    const dateFrom = sp.get('dateFrom');
    const dateTo = sp.get('dateTo');

    const where: Record<string, unknown> = {};

    if (method) where.method = method.toUpperCase();
    if (statusCode) {
      if (statusCode === '2xx') {
        where.statusCode = { gte: 200, lt: 300 };
      } else if (statusCode === '4xx') {
        where.statusCode = { gte: 400, lt: 500 };
      } else if (statusCode === '5xx') {
        where.statusCode = { gte: 500, lt: 600 };
      } else {
        const code = parseInt(statusCode, 10);
        if (!isNaN(code)) {
          if (code >= 200 && code < 300) where.statusCode = { gte: 200, lt: 300 };
          else if (code >= 400 && code < 500) where.statusCode = { gte: 400, lt: 500 };
          else if (code >= 500) where.statusCode = { gte: 500 };
          else where.statusCode = code;
        }
      }
    }
    if (path) where.path = { contains: path };
    if (apiKeyId) where.apiKeyId = apiKeyId;
    if (siteId) where.siteId = siteId;
    if (ipAddress) where.ipAddress = { contains: ipAddress };
    if (search) {
      where.OR = [
        { path: { contains: search } },
        { errorMessage: { contains: search } },
        { ipAddress: { contains: search } },
      ];
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.createdAt = dateFilter;
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.apiLog.findMany({
        where,
        include: {
          apiKey: { select: { id: true, name: true, keyPrefix: true, type: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.apiLog.count({ where }),
    ]);

    // Aggregate stats
    const stats = await db.apiLog.aggregate({
      _count: true,
      _avg: { duration: true },
      _sum: { requestSize: true, responseSize: true },
      where: dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        },
      } : undefined,
    });

    const errorCount = await db.apiLog.count({
      where: { ...where, statusCode: { gte: 400 } } as Record<string, unknown>,
    });

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        stats: {
          totalRequests: stats._count,
          avgDuration: Math.round(stats._avg.duration ?? 0),
          totalRequestSize: stats._sum.requestSize ?? 0,
          totalResponseSize: stats._sum.responseSize ?? 0,
          errorCount,
          successRate: stats._count > 0 ? Math.round((stats._count - errorCount) / stats._count * 1000) / 10 : 100,
        },
      },
    });
  } catch (error) {
    console.error(`[API_LOGS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch API logs' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
