// ============================================================
// PATCH /api/comments/bulk-status — Bulk update comment statuses
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- validation ------------------------------------------------

const bulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED', 'SPAM']),
});

// =====================================================================
// PATCH — bulk status update
// =====================================================================

export async function PATCH(request: NextRequest) {
  const id = reqId();

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

    const parsed = bulkStatusSchema.safeParse(body);
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

    const { ids, status } = parsed.data;

    const count = await db.comment.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    return NextResponse.json({ data: { updatedCount: count.count }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[COMMENTS:BULK_STATUS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update comment statuses' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
