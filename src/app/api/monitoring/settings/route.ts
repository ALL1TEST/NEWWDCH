// ============================================================
// GET   /api/monitoring/settings  — Get all monitor settings as key-value
// PATCH /api/monitoring/settings  — Update monitor settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// =====================================================================
// GET — all settings
// =====================================================================

export async function GET(_request: NextRequest) {
  const id = reqId();

  try {
    const settings = await db.monitorSetting.findMany({
      orderBy: { key: 'asc' },
    });

    // Convert to key-value map
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json({
      data: {
        settings: settingsMap,
        items: settings,
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:SETTINGS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch monitor settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update settings (accepts { settings: { key: value, ... } })
// =====================================================================

export async function PATCH(request: NextRequest) {
  const id = reqId();

  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'settings (object) is required' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const entries = Object.entries(settings as Record<string, string>);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'settings must not be empty' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Upsert each setting
    const results = await Promise.all(
      entries.map(([key, value]) =>
        db.monitorSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        }),
      ),
    );

    return NextResponse.json({
      data: { updated: results.length, settings: results },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:SETTINGS:PATCH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update monitor settings' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
