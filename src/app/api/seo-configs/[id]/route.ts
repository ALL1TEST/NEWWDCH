// ============================================================
// GET /api/seo-configs/[id] — Get single SEO config
// PATCH /api/seo-configs/[id] — Update SEO config (upsert by resource)
// DELETE /api/seo-configs/[id] — Delete SEO config
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';

const seoConfigUpdateSchema = z.object({
  metaTitle: z.string().max(70).optional().or(z.literal('')),
  metaDescription: z.string().max(160).optional().or(z.literal('')),
  ogTitle: z.string().max(100).optional().or(z.literal('')),
  ogDescription: z.string().max(200).optional().or(z.literal('')),
  ogImageId: z.string().optional().or(z.literal('')),
  canonicalUrl: z.string().optional().or(z.literal('')),
  robots: z.string().optional().or(z.literal('')),
  structuredData: z.string().optional().or(z.literal('')),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    const { id } = await context.params;
    const item = await db.seoConfig.findUnique({
      where: { id },
      include: { ogImage: { select: { id: true, filename: true, url: true, thumbnailUrl: true } } },
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'SEO config not found' }, meta: { requestId, timestamp } },
        { status: 404 },
      );
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({ data: item, meta: { requestId, timestamp, duration } });
  } catch (error) {
    console.error(`[SEO_CONFIGS:GET] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SEO config' }, meta: { requestId, timestamp } },
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
    const existing = await db.seoConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'SEO config not found' }, meta: { requestId, timestamp } },
        { status: 404 },
      );
    }

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId, timestamp } },
        { status: 400 },
      );
    }

    const result = seoConfigUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: result.error.issues[0]?.message ?? 'Invalid input data', details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId, timestamp } },
        { status: 400 },
      );
    }

    const data = result.data;
    const updateData: Record<string, unknown> = {};
    if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle === '' ? null : data.metaTitle;
    if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription === '' ? null : data.metaDescription;
    if (data.ogTitle !== undefined) updateData.ogTitle = data.ogTitle === '' ? null : data.ogTitle;
    if (data.ogDescription !== undefined) updateData.ogDescription = data.ogDescription === '' ? null : data.ogDescription;
    if (data.ogImageId !== undefined) updateData.ogImageId = data.ogImageId === '' ? null : data.ogImageId;
    if (data.canonicalUrl !== undefined) updateData.canonicalUrl = data.canonicalUrl === '' ? null : data.canonicalUrl;
    if (data.robots !== undefined) updateData.robots = data.robots === '' ? null : data.robots;
    if (data.structuredData !== undefined) updateData.structuredData = data.structuredData === '' ? null : data.structuredData;

    const item = await db.seoConfig.update({
      where: { id }, data: updateData,
      include: { ogImage: { select: { id: true, filename: true, url: true, thumbnailUrl: true } } },
    });
    const duration = Date.now() - startTime;
    return NextResponse.json({ data: item, meta: { requestId, timestamp, duration } });
  } catch (error) {
    console.error(`[SEO_CONFIGS:UPDATE] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update SEO config' }, meta: { requestId, timestamp } },
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
    const existing = await db.seoConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'SEO config not found' }, meta: { requestId, timestamp } },
        { status: 404 },
      );
    }

    await db.seoConfig.delete({ where: { id } });
    const duration = Date.now() - startTime;
    return NextResponse.json({ data: { id, deleted: true }, meta: { requestId, timestamp, duration } });
  } catch (error) {
    console.error(`[SEO_CONFIGS:DELETE] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete SEO config' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
