// ============================================================
// GET /api/settings/export — Export all settings as JSON
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { exportSettings } from '@/lib/settings-service';

function reqId() { return 'req_' + nanoid(8); }

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const includeSensitive = sp.get('sensitive') === 'true';
    const category = sp.get('category') || undefined;

    const result = await exportSettings({ includeSensitive, category });

    return NextResponse.json(
      { data: result, meta: { requestId: id } },
      { headers: { 'Content-Disposition': 'attachment; filename="settings-export.json"' } },
    );
  } catch (error) {
    console.error(`[SETTINGS:EXPORT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to export settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
