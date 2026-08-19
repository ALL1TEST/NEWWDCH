// ============================================================
// GET /api/seo/robots  — Get robots.txt content for site
// PUT /api/seo/robots  — Save robots.txt content
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

const putSchema = z.object({
  content: z.string().min(1, 'Content is required').max(50000, 'Content must be 50000 characters or less'),
});

// =====================================================================
// GET — get robots.txt (upsert if not exists)
// =====================================================================

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);

    let robots = await db.robotsTxt.findFirst({ where: siteFilter });

    // Upsert if not exists
    if (!robots) {
      robots = await db.robotsTxt.create({
        data: { siteId: siteFilter.siteId || undefined },
      });
    }

    return NextResponse.json({
      data: robots,
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:ROBOTS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch robots.txt' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PUT — save robots.txt content
// =====================================================================

export async function PUT(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const parsed = putSchema.safeParse(body);
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

    const siteFilter = await getSiteWhere(request);

    // Find existing or create
    let robots = await db.robotsTxt.findFirst({ where: siteFilter });

    let result;
    if (robots) {
      result = await db.robotsTxt.update({
        where: { id: robots.id },
        data: { content: parsed.data.content },
      });
    } else {
      result = await db.robotsTxt.create({
        data: { content: parsed.data.content, siteId: siteFilter.siteId || undefined },
      });
    }

    return NextResponse.json({
      data: result,
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:ROBOTS:PUT] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save robots.txt' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
