// ============================================================
// POST /api/settings/batch — Batch upsert settings (alias)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { batchUpsertSettings } from '@/lib/settings-service';
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
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input data' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const result = await batchUpsertSettings(parsed.data.settings);

    return NextResponse.json({ data: result, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SETTINGS:BATCH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
