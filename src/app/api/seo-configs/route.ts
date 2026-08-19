// ============================================================
// GET /api/seo-configs — List SEO configs
// POST /api/seo-configs — Create SEO config
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

const seoConfigCreateSchema = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  metaTitle: z.string().max(70).optional().or(z.literal('')),
  metaDescription: z.string().max(160).optional().or(z.literal('')),
  ogTitle: z.string().max(100).optional().or(z.literal('')),
  ogDescription: z.string().max(200).optional().or(z.literal('')),
  ogImageId: z.string().optional().or(z.literal('')),
  canonicalUrl: z.string().optional().or(z.literal('')),
  robots: z.string().optional().or(z.literal('')),
  structuredData: z.string().optional().or(z.literal('')),
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 25));
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const resourceType = searchParams.get('resourceType');

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (resourceType) where.resourceType = resourceType;

    const orderBy: Record<string, string> = {};
    orderBy[sort] = order;

    const [items, total] = await Promise.all([
      db.seoConfig.findMany({
        where,
        include: { ogImage: { select: { id: true, filename: true, url: true, thumbnailUrl: true } } },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.seoConfig.count({ where }),
    ]);

    const duration = Date.now() - startTime;
    return NextResponse.json({
      data: items,
      meta: { requestId, timestamp, duration, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
    });
  } catch (error) {
    console.error(`[SEO_CONFIGS:LIST] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SEO configs' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId, timestamp } },
        { status: 400 },
      );
    }

    const result = seoConfigCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: result.error.issues[0]?.message ?? 'Invalid input data', details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) }, meta: { requestId, timestamp } },
        { status: 400 },
      );
    }

    const data = result.data;
    const siteId = request.nextUrl.searchParams.get('siteId');
    const item = await db.seoConfig.create({
      data: {
        siteId: siteId || undefined,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        metaTitle: data.metaTitle === '' ? null : (data.metaTitle ?? null),
        metaDescription: data.metaDescription === '' ? null : (data.metaDescription ?? null),
        ogTitle: data.ogTitle === '' ? null : (data.ogTitle ?? null),
        ogDescription: data.ogDescription === '' ? null : (data.ogDescription ?? null),
        ogImageId: data.ogImageId === '' ? null : (data.ogImageId ?? null),
        canonicalUrl: data.canonicalUrl === '' ? null : (data.canonicalUrl ?? null),
        robots: data.robots === '' ? null : (data.robots ?? null),
        structuredData: data.structuredData === '' ? null : (data.structuredData ?? null),
      },
      include: { ogImage: { select: { id: true, filename: true, url: true, thumbnailUrl: true } } },
    });

    const duration = Date.now() - startTime;
    return NextResponse.json({ data: item, meta: { requestId, timestamp, duration } }, { status: 201 });
  } catch (error) {
    console.error(`[SEO_CONFIGS:CREATE] ${requestId} - Error:`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create SEO config' }, meta: { requestId, timestamp } },
      { status: 500 },
    );
  }
}
