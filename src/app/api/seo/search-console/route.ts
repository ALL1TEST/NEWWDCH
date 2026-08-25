// ============================================================
// GET    /api/seo/search-console       — Connection status + stats summary
// POST   /api/seo/search-console       — Connect (save tokens)
// PATCH  /api/seo/search-console       — Update connection / sync
// DELETE /api/seo/search-console       — Disconnect
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- validation ------------------------------------------------

const connectSchema = z.object({
  siteUrl: z.string().min(1, 'Site URL is required').trim(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

const updateSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(['CONNECTED', 'DISCONNECTED', 'EXPIRED']).optional(),
});

// =====================================================================
// GET — connection status + stats summary
// =====================================================================

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);

    const connection = await db.searchConsoleConnection.findFirst({
      where: siteFilter,
      include: {
        stats: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    if (!connection) {
      return NextResponse.json({
        data: { connected: false, connection: null, stats: [] },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Compute summary from recent stats
    const totalClicks = connection.stats.reduce((sum, s) => sum + s.clicks, 0);
    const totalImpressions = connection.stats.reduce((sum, s) => sum + s.impressions, 0);
    // CTR = clicks / impressions (as a fraction, e.g. 0.039 = 3.9%)
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    // Average position = mean of daily positions
    const avgPosition = connection.stats.length > 0
      ? connection.stats.reduce((sum, s) => sum + s.position, 0) / connection.stats.length
      : 0;

    const summary = {
      totalClicks,
      totalImpressions,
      averageCtr: Math.round(avgCtr * 100) / 100,
      averagePosition: Math.round(avgPosition * 100) / 100,
    };

    return NextResponse.json({
      data: {
        connected: connection.status === 'CONNECTED',
        connection: {
          id: connection.id,
          siteUrl: connection.siteUrl,
          status: connection.status,
          lastSyncAt: connection.lastSyncAt,
          createdAt: connection.createdAt,
        },
        summary,
      },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:SC:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch Search Console data' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — connect
// =====================================================================

export async function POST(request: NextRequest) {
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

    const parsed = connectSchema.safeParse(body);
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

    // Check if connection already exists for this site
    const existing = await db.searchConsoleConnection.findFirst({ where: siteFilter });
    if (existing) {
      return NextResponse.json(
        { error: { code: 'ALREADY_CONNECTED', message: 'A Search Console connection already exists for this site' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 409 },
      );
    }

    const connection = await db.searchConsoleConnection.create({
      data: {
        siteUrl: parsed.data.siteUrl,
        accessToken: parsed.data.accessToken,
        refreshToken: parsed.data.refreshToken,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        status: 'CONNECTED',
        siteId: siteFilter.siteId || undefined,
      },
    });

    return NextResponse.json({ data: connection, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } }, { status: 201 });
  } catch (error) {
    console.error(`[SEO:SC:POST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create Search Console connection' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update / sync
// =====================================================================

export async function PATCH(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);

    const existing = await db.searchConsoleConnection.findFirst({ where: siteFilter });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No Search Console connection found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

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
    const updateData: Record<string, unknown> = {};
    if (d.accessToken !== undefined) updateData.accessToken = d.accessToken;
    if (d.refreshToken !== undefined) updateData.refreshToken = d.refreshToken;
    if (d.expiresAt !== undefined) updateData.expiresAt = new Date(d.expiresAt);
    if (d.status !== undefined) updateData.status = d.status;

    // If this is a sync request, update lastSyncAt
    const sp = new URL(request.url).searchParams;
    if (sp.get('action') === 'sync') {
      updateData.lastSyncAt = new Date();
    }

    const connection = await db.searchConsoleConnection.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({ data: connection, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } });
  } catch (error) {
    console.error(`[SEO:SC:PATCH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update Search Console connection' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — disconnect
// =====================================================================

export async function DELETE(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);

    const existing = await db.searchConsoleConnection.findFirst({ where: siteFilter });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No Search Console connection found' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }

    await db.searchConsoleConnection.delete({ where: { id: existing.id } });

    return NextResponse.json({
      data: { id: existing.id, disconnected: true },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:SC:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to disconnect Search Console' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
