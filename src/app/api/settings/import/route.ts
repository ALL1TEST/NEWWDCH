// ============================================================
// POST /api/settings/import — Import settings from JSON
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { importSettings } from '@/lib/settings-service';
import { nanoid } from 'nanoid';

function reqId() { return 'req_' + nanoid(8); }

const importSchema = z.object({
  settings: z.record(z.object({
    value: z.string(),
    type: z.string().optional(),
    category: z.string().optional(),
  })),
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

    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid import data' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const result = await importSettings(parsed.data.settings);

    return NextResponse.json({ data: result, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SETTINGS:IMPORT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to import settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
