// ============================================================
// POST /api/settings/reset — Reset settings to defaults
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { resetCategoryToDefaults, resetAllSettings } from '@/lib/settings-service';
import { nanoid } from 'nanoid';

function reqId() { return 'req_' + nanoid(8); }

const resetSchema = z.object({
  category: z.string().optional(),
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

    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid input data' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const result = parsed.data.category
      ? await resetCategoryToDefaults(parsed.data.category)
      : await resetAllSettings();

    return NextResponse.json({ data: result, meta: { requestId: id } });
  } catch (error) {
    console.error(`[SETTINGS:RESET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to reset settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
