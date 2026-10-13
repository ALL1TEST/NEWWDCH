// ============================================================
// POST /api/seo/search-console/verify
// Performs live public verification & Google confirmation for Search Console
// Used for manual fallback flow or retrying site verification
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';
import { decrypt, encrypt } from '@/lib/encryption';
import {
  checkPublicSiteForMetaVerification,
  verifySiteWithGoogle,
  addSearchConsoleSite,
  syncRealSearchConsoleData,
  getGoogleSearchConsoleConfig,
  refreshGoogleAccessToken,
  VERDANT_PUBLIC_URL,
} from '@/lib/seo/search-console-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);
    const connection = await db.searchConsoleConnection.findFirst({
      where: siteFilter,
    });

    if (!connection || !connection.accessToken) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'No pending Google Search Console connection found. Please connect your Google account first.',
          },
        },
        { status: 404 },
      );
    }

    // Decrypt stored token bundle
    let decryptedData: any = {};
    try {
      const raw = await decrypt(connection.accessToken);
      decryptedData = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: 'CORRUPT_SESSION',
            message: 'Invalid session credentials. Please reconnect Google Search Console.',
          },
        },
        { status: 400 },
      );
    }

    const targetPropertyUrl = connection.siteUrl || decryptedData.targetPropertyUrl || VERDANT_PUBLIC_URL;
    const expectedToken = decryptedData.verificationToken;

    if (!expectedToken) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_VERIFICATION_TOKEN',
            message: 'No verification token was found for this site. Please reconnect to generate a new token.',
          },
        },
        { status: 400 },
      );
    }

    // 1. Verify that the LIVE PUBLIC WEBSITE contains the exact token in <head>
    const publicCheck = await checkPublicSiteForMetaVerification({
      siteUrl: targetPropertyUrl,
      expectedToken,
    });

    if (!publicCheck.verified) {
      return NextResponse.json(
        {
          error: {
            code: 'PUBLIC_VERIFICATION_FAILED',
            message: publicCheck.error || 'The verification meta tag could not be found on the live public website.',
            details: {
              targetPropertyUrl,
              expectedToken,
              foundToken: publicCheck.foundToken,
            },
          },
        },
        { status: 422 },
      );
    }

    // 2. Ensure we have a valid access token (refresh if needed)
    let accessToken = decryptedData.accessToken;
    if (connection.expiresAt && connection.expiresAt.getTime() - Date.now() < 300_000 && connection.refreshToken) {
      const config = getGoogleSearchConsoleConfig();
      if (config.isConfigured) {
        try {
          const decryptedRefresh = await decrypt(connection.refreshToken);
          const refreshed = await refreshGoogleAccessToken({
            refreshToken: decryptedRefresh,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
          });
          accessToken = refreshed.access_token;
          decryptedData.accessToken = accessToken;
        } catch (refreshErr) {
          console.warn('[SEO:SC:VERIFY_REFRESH_WARN]', refreshErr);
        }
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          error: {
            code: 'AUTH_EXPIRED',
            message: 'Google authorization session expired. Please reconnect your Google account.',
          },
        },
        { status: 401 },
      );
    }

    // 3. Call Google Site Verification API
    let googleResult: any;
    try {
      googleResult = await verifySiteWithGoogle({
        accessToken,
        siteUrl: targetPropertyUrl,
      });
    } catch (googleErr: any) {
      return NextResponse.json(
        {
          error: {
            code: 'GOOGLE_VERIFICATION_REJECTED',
            message: googleErr?.message || 'Google rejected the verification request.',
          },
        },
        { status: 400 },
      );
    }

    // 4. Register property with Search Console API
    await addSearchConsoleSite({
      accessToken,
      siteUrl: targetPropertyUrl,
    });

    // 5. Update connection to CONNECTED
    const updatedBundle = {
      accessToken,
      accountEmail: decryptedData.accountEmail || 'Connected Google Account',
      property: targetPropertyUrl,
      permissionLevel: 'siteOwner',
      scope: decryptedData.scope,
      verifiedVia: 'META',
      verifiedAt: new Date().toISOString(),
      owners: googleResult.owners || [],
    };

    const encryptedAccessToken = await encrypt(JSON.stringify(updatedBundle));

    await db.searchConsoleConnection.update({
      where: { id: connection.id },
      data: {
        siteUrl: targetPropertyUrl,
        accessToken: encryptedAccessToken,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
      },
    });

    // 6. Initial real Search Console data sync
    try {
      await syncRealSearchConsoleData(connection.id);
    } catch (syncErr: any) {
      console.warn(`[SEO:SC:VERIFY_SYNC_WARN] ${syncErr.message}`);
    }

    return NextResponse.json({
      data: {
        connected: true,
        verified: true,
        property: targetPropertyUrl,
        accountEmail: decryptedData.accountEmail || null,
        message: 'Google Search Console verified and connected successfully.',
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    });
  } catch (err: any) {
    console.error(`[SEO:SC:VERIFY_ERROR] ${requestId} —`, err);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: err?.message || 'Unexpected error verifying Google Search Console connection.',
        },
      },
      { status: 500 },
    );
  }
}
