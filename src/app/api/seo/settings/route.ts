// ============================================================
// GET   /api/seo/settings — Get SEO settings (upsert default)
// PATCH /api/seo/settings — Update SEO settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  autoRedirectsOnSlugChange: z.boolean(),
});

// =====================================================================
// GET — upsert and return settings
// =====================================================================

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);
    const siteId = request.nextUrl.searchParams.get('siteId') || undefined;

    // Find existing or create default
    let setting = await db.seoSetting.findFirst({ where: siteFilter });

    if (!setting) {
      setting = await db.seoSetting.create({
        data: {
          autoRedirectsOnSlugChange: true,
          siteId,
        },
      });
    }

    return NextResponse.json({
      data: setting,
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:SETTINGS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SEO settings' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);
    const siteId = request.nextUrl.searchParams.get('siteId') || undefined;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { requestId: id, timestamp: new Date().toISOString() },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;

    // Find or create
    let setting = await db.seoSetting.findFirst({ where: siteFilter });

    if (setting) {
      setting = await db.seoSetting.update({
        where: { id: setting.id },
        data: { autoRedirectsOnSlugChange: d.autoRedirectsOnSlugChange },
      });
    } else {
      setting = await db.seoSetting.create({
        data: {
          autoRedirectsOnSlugChange: d.autoRedirectsOnSlugChange,
          siteId,
        },
      });
    }

    return NextResponse.json({
      data: setting,
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:SETTINGS:PATCH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update SEO settings' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
