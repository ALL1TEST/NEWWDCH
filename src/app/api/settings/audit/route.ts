// ============================================================
// GET /api/settings/audit — Get settings change audit log
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getAuditLog } from '@/lib/settings-service';

function reqId() { return 'req_' + nanoid(8); }

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const category = sp.get('category') || undefined;
    const key = sp.get('key') || undefined;
    const page = Number(sp.get('page') ?? '1');
    const pageSize = Number(sp.get('pageSize') ?? '25');

    const result = await getAuditLog({ category, key, page, pageSize });

    return NextResponse.json({ data: result.items, meta: { requestId: id, pagination: result.pagination } });
  } catch (error) {
    console.error(`[SETTINGS:AUDIT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit log' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
