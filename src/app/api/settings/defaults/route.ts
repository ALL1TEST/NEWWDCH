// ============================================================
// GET /api/settings/defaults — Get default values for all settings
// ============================================================

import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { SETTINGS_CATEGORIES } from '@/lib/settings-service';

function reqId() { return 'req_' + nanoid(8); }

export async function GET() {
  const id = reqId();

  try {
    const defaults: Record<string, string> = {};
    for (const cat of SETTINGS_CATEGORIES) {
      for (const field of cat.fields) {
        defaults[field.key] = field.defaultValue;
      }
    }

    return NextResponse.json({ data: defaults, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SETTINGS:DEFAULTS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch defaults' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
