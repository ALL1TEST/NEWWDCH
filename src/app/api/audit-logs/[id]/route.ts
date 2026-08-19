// ============================================================
// GET /api/audit-logs/[id] — Get single audit log (read-only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    const { id } = await context.params;
    const item = await db.auditLog.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Audit log not found' }, meta: { requestId, timestamp } },
        { status: 404 },
      );
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({ data: item, meta: { requestId, timestamp, duration } });
  } catch (error) {
    console.error(`[AUDIT_LOGS:GET] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit log' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
