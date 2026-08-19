// ============================================================
// GET /api/settings/[id] — Get single setting
// PATCH /api/settings/[id] — Upsert setting by key
// DELETE /api/settings/[id] — Delete setting
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settingUpdateSchema } from '@/lib/validators';
import { generateRequestId } from '@/lib/utils';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    const { id } = await context.params;
    const item = await db.setting.findFirst({ where: { OR: [{ id }, { key: id }] } });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Setting not found' }, meta: { requestId, timestamp } },
        { status: 404 },
      );
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({ data: item, meta: { requestId, timestamp, duration } });
  } catch (error) {
    console.error(`[SETTINGS:GET] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch setting' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    const { id } = await context.params;

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId, timestamp } },
        { status: 400 },
      );
    }

    const result = settingUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: result.error.issues[0]?.message ?? 'Invalid input data', details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId, timestamp } },
        { status: 400 },
      );
    }

    const existing = await db.setting.findFirst({ where: { OR: [{ id }, { key: id }] } });

    let item;
    if (existing) {
      item = await db.setting.update({ where: { id: existing.id }, data: { value: result.data.value } });
    } else {
      item = await db.setting.create({ data: { key: id, value: result.data.value } });
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({ data: item, meta: { requestId, timestamp, duration } });
  } catch (error) {
    console.error(`[SETTINGS:UPDATE] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update setting' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    const { id } = await context.params;
    const existing = await db.setting.findFirst({ where: { OR: [{ id }, { key: id }] } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Setting not found' }, meta: { requestId, timestamp } },
        { status: 404 },
      );
    }

    await db.setting.delete({ where: { id: existing.id } });
    const duration = Date.now() - startTime;
    return NextResponse.json({ data: { id: existing.id, deleted: true }, meta: { requestId, timestamp, duration } });
  } catch (error) {
    console.error(`[SETTINGS:DELETE] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete setting' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
