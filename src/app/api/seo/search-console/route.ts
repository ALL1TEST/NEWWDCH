// ============================================================
// GET    /api/seo/search-console       — Connection status + stats summary
// POST   /api/seo/search-console       — Connect (save tokens)
// PATCH  /api/seo/search-console       — Update connection / sync
// DELETE /api/seo/search-console       — Disconnect
// Credentials and secrets are never returned to client
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';
import { decrypt, encrypt } from '@/lib/encryption';
import {
  syncRealSearchConsoleData,
  VERDANT_PUBLIC_URL,
} from '@/lib/seo/search-console-service';
import { resolveSiteBaseUrl } from '@/lib/seo/url-utils';

// ---------- validation ------------------------------------------------

const connectSchema = z.object({
  siteUrl: z.string().trim().optional(),
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

/**
 * Resolves the configured target site URL from the CMS database
 */
async function resolveCmsTargetSiteUrl(siteFilter: Record<string, unknown>): Promise<string> {
  let siteRecord = null;
  if (siteFilter.siteId && typeof siteFilter.siteId === 'string') {
    siteRecord = await db.site.findUnique({ where: { id: siteFilter.siteId } });
  }
  if (!siteRecord) {
    siteRecord = await db.site.findFirst({
      where: {
        OR: [{ slug: 'verdant' }, { domain: 'verdantt.vercel.app' }, { status: 'ACTIVE' }],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
  if (siteRecord) {
    const resolved = resolveSiteBaseUrl(siteRecord);
    if (resolved) {
      return resolved.endsWith('/') ? resolved : `${resolved}/`;
    }
  }
  return VERDANT_PUBLIC_URL;
}

// =====================================================================
// GET — connection status + stats summary
// =====================================================================

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);
    const targetSiteUrl = await resolveCmsTargetSiteUrl(siteFilter);

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
        data: {
          connected: false,
          connection: null,
          targetSiteUrl,
          stats: [],
        },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Decrypt token bundle to read metadata (without exposing credentials to client)
    let accountEmail: string | null = null;
    let verifiedProperty: string | null = connection.siteUrl || targetSiteUrl;
    let propertyAccessible = true;
    let statusMessage: string | null = null;
    let pendingVerification: {
      manualRequired: boolean;
      token?: string;
      metaTag?: string;
      targetPropertyUrl?: string;
      accountEmail?: string;
      error?: string;
    } | null = null;

    if (connection.accessToken) {
      try {
        const decrypted = await decrypt(connection.accessToken);
        const parsed = JSON.parse(decrypted);
        accountEmail = parsed.accountEmail || null;
        if (parsed.property) verifiedProperty = parsed.property;
        if (parsed.error === 'PROPERTY_NOT_ACCESSIBLE') {
          propertyAccessible = false;
          statusMessage = 'Google account connected, but this account does not have access to the configured Search Console property.';
        } else if (parsed.error === 'MANUAL_VERIFICATION_REQUIRED') {
          propertyAccessible = false;
          statusMessage = "Automatic verification isn't available for this site yet.";
          pendingVerification = {
            manualRequired: true,
            token: parsed.verificationToken,
            metaTag: parsed.verificationMetaTag,
            targetPropertyUrl: parsed.targetPropertyUrl || targetSiteUrl,
            accountEmail: parsed.accountEmail,
          };
        } else if (parsed.error === 'VERIFICATION_FAILED') {
          propertyAccessible = false;
          statusMessage = parsed.verificationError || 'Website verification could not be completed.';
          pendingVerification = {
            manualRequired: false,
            token: parsed.verificationToken,
            metaTag: parsed.verificationMetaTag,
            targetPropertyUrl: parsed.targetPropertyUrl || targetSiteUrl,
            accountEmail: parsed.accountEmail,
            error: parsed.verificationError,
          };
        }
      } catch {
        // legacy non-json token
      }
    }

    // Compute effective status
    let effectiveStatus = connection.status;
    if (connection.status === 'DISCONNECTED' && !propertyAccessible) {
      if (pendingVerification?.manualRequired) {
        effectiveStatus = 'MANUAL_VERIFICATION_REQUIRED' as any;
      } else if (pendingVerification) {
        effectiveStatus = 'VERIFICATION_FAILED' as any;
      } else {
        effectiveStatus = 'PROPERTY_NOT_ACCESSIBLE' as any;
      }
    }

    const isConnected = connection.status === 'CONNECTED' && propertyAccessible;

    // Compute summary from real stats
    const totalClicks = connection.stats.reduce((sum, s) => sum + s.clicks, 0);
    const totalImpressions = connection.stats.reduce((sum, s) => sum + s.impressions, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition =
      connection.stats.length > 0
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
        connected: isConnected,
        targetSiteUrl,
        pendingVerification,
        connection: {
          id: connection.id,
          siteUrl: verifiedProperty,
          accountEmail,
          status: effectiveStatus,
          statusMessage,
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
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        body = JSON.parse(text);
      }
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
    const targetSiteUrl = await resolveCmsTargetSiteUrl(siteFilter);

    const existing = await db.searchConsoleConnection.findFirst({ where: siteFilter });
    if (existing) {
      return NextResponse.json(
        { error: { code: 'ALREADY_CONNECTED', message: 'A Search Console connection already exists for this site' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 409 },
      );
    }

    const connection = await db.searchConsoleConnection.create({
      data: {
        siteUrl: parsed.data.siteUrl || targetSiteUrl,
        accessToken: parsed.data.accessToken ? await encrypt(parsed.data.accessToken) : null,
        refreshToken: parsed.data.refreshToken ? await encrypt(parsed.data.refreshToken) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        status: 'CONNECTED',
        siteId: (siteFilter.siteId as string) || undefined,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: connection.id,
          siteUrl: connection.siteUrl,
          status: connection.status,
          createdAt: connection.createdAt,
        },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      },
      { status: 201 },
    );
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
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
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

    const sp = new URL(request.url).searchParams;
    if (sp.get('action') === 'sync') {
      try {
        const syncResult = await syncRealSearchConsoleData(existing.id);
        const updated = await db.searchConsoleConnection.findUnique({
          where: { id: existing.id },
          select: {
            id: true,
            siteUrl: true,
            status: true,
            lastSyncAt: true,
          },
        });

        return NextResponse.json({
          data: {
            ...updated,
            syncResult,
          },
          meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
        });
      } catch (syncErr: any) {
        console.error(`[SEO:SC:SYNC_ERROR] ${id} —`, syncErr);
        return NextResponse.json(
          {
            error: {
              code: 'SYNC_FAILED',
              message: 'Failed to sync with Google Search Console API',
            },
            meta: { requestId: id, timestamp: new Date().toISOString() },
          },
          { status: 502 },
        );
      }
    }

    let body: unknown = {};
    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        body = JSON.parse(text);
      }
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
    if (d.accessToken !== undefined) updateData.accessToken = await encrypt(d.accessToken);
    if (d.refreshToken !== undefined) updateData.refreshToken = await encrypt(d.refreshToken);
    if (d.expiresAt !== undefined) updateData.expiresAt = new Date(d.expiresAt);
    if (d.status !== undefined) updateData.status = d.status;

    const connection = await db.searchConsoleConnection.update({
      where: { id: existing.id },
      data: updateData,
      select: {
        id: true,
        siteUrl: true,
        status: true,
        lastSyncAt: true,
      },
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
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
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

    // Delete child records and connection cleanly
    await db.searchConsoleStat.deleteMany({ where: { connectionId: existing.id } });
    await db.searchConsoleQuery.deleteMany({ where: { connectionId: existing.id } });
    await db.searchConsolePage.deleteMany({ where: { connectionId: existing.id } });
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
