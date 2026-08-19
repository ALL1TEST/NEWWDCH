// ============================================================
// GET  /api/settings           — Get all settings (merged with defaults)
// POST /api/settings           — Batch upsert settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import {
  getAllSettings,
  batchUpsertSettings,
  SETTINGS_CATEGORIES,
} from '@/lib/settings-service';
import { nanoid } from 'nanoid';

function reqId() { return 'req_' + nanoid(8); }

const batchSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1).max(255),
    value: z.string(),
    type: z.string().optional(),
    category: z.string().optional(),
  })).min(1),
});

// =====================================================================
// GET — all settings merged with defaults
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const category = sp.get('category') || undefined;
    const scope = sp.get('scope') || undefined;

    const items = await getAllSettings({ category, scope });

    return NextResponse.json({ data: items, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SETTINGS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — batch upsert with audit logging
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  try {
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input data' },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const result = await batchUpsertSettings(parsed.data.settings);

    return NextResponse.json(
      { data: result, meta: { requestId: id } },
      { status: 200 },
    );
  } catch (error) {
    console.error(`[SETTINGS:BATCH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
