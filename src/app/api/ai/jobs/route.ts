'use server';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ApiResponse, ApiError } from '@/shared/types';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + crypto.randomUUID().slice(0, 8);
}

function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, meta: { requestId: reqId(), timestamp: new Date().toISOString(), ...meta } } satisfies ApiResponse<T>);
}

function err(message: string, status = 400, code = 'VALIDATION_ERROR') {
  return NextResponse.json({ error: { code, message }, meta: { requestId: reqId(), timestamp: new Date().toISOString() } } satisfies ApiError, { status });
}

const SORTABLE = new Set(['createdAt', 'updatedAt', 'title', 'type', 'status', 'priority', 'durationMs', 'costUsd']);

// =====================================================================
// GET — list jobs
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const status = sp.get('status')?.trim();
    const type = sp.get('type')?.trim();

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.aiJob.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          provider: { select: { id: true, name: true, kind: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      db.aiJob.count({ where }),
    ]);

    return NextResponse.json({
      data: { data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`[AI/JOBS:LIST] ${id} —`, error);
    return err('Failed to fetch AI jobs', 500, 'INTERNAL_ERROR');
  }
}
