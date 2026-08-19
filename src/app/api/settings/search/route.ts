// ============================================================
// GET /api/settings/search — Search UI-visible settings only
// Excludes operational categories owned by other modules
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { searchSettingDefs } from '@/lib/settings-service';

function reqId() { return 'req_' + nanoid(8); }

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const query = sp.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json({ data: [], meta: { requestId: id } });
    }

    // Only search UI-visible categories (visibleOnly defaults to true)
    const results = searchSettingDefs(query, { visibleOnly: true });

    return NextResponse.json({ data: results, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SETTINGS:SEARCH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to search settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
