// ============================================================
// GET /api/integrations/google/search-console/callback
// Handles Google OAuth 2.0 authorization code exchange and Search Console property verification
// Securely encrypts tokens server-side; credentials never exposed to client
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import {
  getGoogleSearchConsoleConfig,
  exchangeGoogleCodeForTokens,
  getGoogleUserInfo,
  listSearchConsoleProperties,
  findMatchingVerdantProperty,
  syncRealSearchConsoleData,
  performAutomaticSiteVerification,
  VERDANT_PUBLIC_URL,
} from '@/lib/seo/search-console-service';
import { resolveSiteBaseUrl } from '@/lib/seo/url-utils';

export const dynamic = 'force-dynamic';

function publicOrigin(request: NextRequest): string {
  const protoHeader = request.headers.get('x-forwarded-proto');
  const proto = protoHeader ? protoHeader.split(',')[0].trim() : 'http';
  const hostHeader = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const host = hostHeader ? hostHeader.split(',')[0].trim() : null;
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const isDevOrLocalhost =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    process.env.NODE_ENV !== 'production';
  const sp = request.nextUrl.searchParams;

  const code = sp.get('code');
  const state = sp.get('state');
  const error = sp.get('error');

  const redirectBase = new URL('/#/seo', origin);
  redirectBase.searchParams.set('tab', 'search-console');

  const createRedirectResponse = (targetUrl: URL) => {
    const res = NextResponse.redirect(targetUrl, 302);
    res.cookies.delete('g_sc_oauth_state');
    res.cookies.delete('g_sc_site_id');
    return res;
  };

  // 1. Handle user cancellation or OAuth error
  if (error) {
    if (isDevOrLocalhost) {
      console.log(`[Search Console OAuth] failure reason: OAuth error from Google: ${error}`);
    }
    const errorMsg =
      error === 'access_denied'
        ? 'Google Search Console access was cancelled or denied by user.'
        : 'Google Search Console connection was not authorized.';
    redirectBase.searchParams.set('error', error);
    redirectBase.searchParams.set('message', errorMsg);
    return createRedirectResponse(redirectBase);
  }

  // 2. Anti-CSRF state validation
  const storedState = request.cookies.get('g_sc_oauth_state')?.value;
  if (!state || !storedState || state !== storedState) {
    if (isDevOrLocalhost) {
      console.log(`[Search Console OAuth] failure reason: Invalid or expired OAuth state token`);
    }
    redirectBase.searchParams.set('error', 'invalid_state');
    redirectBase.searchParams.set('message', 'Invalid or expired OAuth session state. Please try connecting again.');
    return createRedirectResponse(redirectBase);
  }

  if (!code) {
    if (isDevOrLocalhost) {
      console.log(`[Search Console OAuth] failure reason: Missing code parameter in callback`);
    }
    redirectBase.searchParams.set('error', 'missing_code');
    redirectBase.searchParams.set('message', 'Authorization code not provided by Google.');
    return createRedirectResponse(redirectBase);
  }

  const config = getGoogleSearchConsoleConfig(origin);
  if (!config.isConfigured) {
    const missing: string[] = [];
    if (!config.clientId) missing.push('GOOGLE_SEARCH_CONSOLE_CLIENT_ID (or GOOGLE_CLIENT_ID)');
    if (!config.clientSecret) missing.push('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET (or GOOGLE_CLIENT_SECRET)');
    const failureReason = `Missing required environment variables: ${missing.join(', ')}`;

    if (isDevOrLocalhost) {
      console.log(`[Search Console OAuth] credentials configured: false`);
      console.log(`[Search Console OAuth] redirect URI: ${config.redirectUri}`);
      console.log(`[Search Console OAuth] failure reason: ${failureReason}`);
    } else {
      console.error(
        '[SEO:SC:CALLBACK] Google Search Console platform credentials not configured on server (missing GOOGLE_SEARCH_CONSOLE_CLIENT_ID / GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET).',
      );
    }
    redirectBase.searchParams.set('error', 'unavailable');
    redirectBase.searchParams.set(
      'message',
      'Google Search Console connection is temporarily unavailable. Please try again later.',
    );
    return createRedirectResponse(redirectBase);
  }

  try {
    // 3. Exchange authorization code for tokens
    const tokens = await exchangeGoogleCodeForTokens({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    // 4. Retrieve authenticated user identity
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // 5. Query Search Console API for accessible properties
    const properties = await listSearchConsoleProperties(tokens.access_token);

    // 6. Resolve target site and property URL from CMS configuration
    const siteIdFromCookie = request.cookies.get('g_sc_site_id')?.value;
    let site = null;
    if (siteIdFromCookie) {
      site = await db.site.findUnique({ where: { id: siteIdFromCookie } });
    }
    if (!site) {
      site = await db.site.findFirst({
        where: {
          OR: [{ slug: 'verdant' }, { domain: 'verdantt.vercel.app' }, { status: 'ACTIVE' }],
        },
        orderBy: { updatedAt: 'desc' },
      });
    }
    const siteId = site?.id || undefined;

    let targetPropertyUrl = VERDANT_PUBLIC_URL;
    if (site) {
      const resolved = resolveSiteBaseUrl(site);
      if (resolved) {
        targetPropertyUrl = resolved.endsWith('/') ? resolved : `${resolved}/`;
      }
    }

    // 7. Match target site against the user's accessible Search Console properties
    let matchingProperty = findMatchingVerdantProperty(properties, targetPropertyUrl);

    // Case: Authenticated Google account has NO access to the target property
    if (!matchingProperty) {
      console.log(
        `[SEO:SC:CALLBACK] Account "${userInfo.email}" has no verified access to target property "${targetPropertyUrl}". Initiating verification flow...`,
      );

      // Perform automatic verification if CMS has write access
      const verifyResult = await performAutomaticSiteVerification({
        accessToken: tokens.access_token,
        site,
        targetPropertyUrl,
      });

      if (verifyResult.success) {
        console.log(
          `[SEO:SC:CALLBACK] Automatic website verification succeeded for "${targetPropertyUrl}"!`,
        );
        // Refresh properties list to get confirmed entry
        const refreshedProperties = await listSearchConsoleProperties(tokens.access_token).catch(() => []);
        matchingProperty =
          findMatchingVerdantProperty(refreshedProperties, targetPropertyUrl) || {
            siteUrl: targetPropertyUrl,
            permissionLevel: 'siteOwner',
          };
      } else if (!verifyResult.canAutoVerify) {
        // CMS does not have write access to public site -> Provide manual verification fallback
        console.log(
          `[SEO:SC:CALLBACK] CMS cannot auto-verify "${targetPropertyUrl}": ${verifyResult.error}. Providing manual verification fallback.`,
        );

        const tokenBundle = {
          accessToken: tokens.access_token,
          accountEmail: userInfo.email,
          scope: tokens.scope,
          error: 'MANUAL_VERIFICATION_REQUIRED',
          verificationToken: verifyResult.token,
          verificationMetaTag: verifyResult.metaTag,
          targetPropertyUrl,
        };
        const encryptedBundle = await encrypt(JSON.stringify(tokenBundle));
        const encryptedRefreshToken = tokens.refresh_token ? await encrypt(tokens.refresh_token) : null;
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        const existing = await db.searchConsoleConnection.findFirst({
          where: siteId ? { siteId } : {},
        });

        if (existing) {
          await db.searchConsoleConnection.update({
            where: { id: existing.id },
            data: {
              status: 'DISCONNECTED',
              accessToken: encryptedBundle,
              refreshToken: encryptedRefreshToken ?? existing.refreshToken,
              expiresAt,
              siteUrl: targetPropertyUrl,
            },
          });
        } else {
          await db.searchConsoleConnection.create({
            data: {
              siteId,
              siteUrl: targetPropertyUrl,
              status: 'DISCONNECTED',
              accessToken: encryptedBundle,
              refreshToken: encryptedRefreshToken,
              expiresAt,
            },
          });
        }

        redirectBase.searchParams.set('error', 'manual_verification_required');
        redirectBase.searchParams.set('account', userInfo.email);
        redirectBase.searchParams.set('property', targetPropertyUrl);
        redirectBase.searchParams.set('token', verifyResult.token || '');
        redirectBase.searchParams.set(
          'message',
          "Automatic verification isn't available for this site yet.",
        );
        return createRedirectResponse(redirectBase);
      } else {
        // Verification was attempted but failed (e.g. public page did not confirm or Google rejected)
        console.warn(
          `[SEO:SC:CALLBACK] Website verification failed at step [${verifyResult.step}]: ${verifyResult.error}`,
        );

        const tokenBundle = {
          accountEmail: userInfo.email,
          scope: tokens.scope,
          error: 'VERIFICATION_FAILED',
          verificationError: verifyResult.error,
          verificationToken: verifyResult.token,
          verificationMetaTag: verifyResult.metaTag,
          targetPropertyUrl,
        };
        const encryptedBundle = await encrypt(JSON.stringify(tokenBundle));
        const existing = await db.searchConsoleConnection.findFirst({
          where: siteId ? { siteId } : {},
        });

        if (existing) {
          await db.searchConsoleConnection.update({
            where: { id: existing.id },
            data: {
              status: 'DISCONNECTED',
              accessToken: encryptedBundle,
              siteUrl: targetPropertyUrl,
            },
          });
        } else {
          await db.searchConsoleConnection.create({
            data: {
              siteId,
              siteUrl: targetPropertyUrl,
              status: 'DISCONNECTED',
              accessToken: encryptedBundle,
            },
          });
        }

        redirectBase.searchParams.set('error', 'verification_failed');
        redirectBase.searchParams.set('account', userInfo.email);
        redirectBase.searchParams.set('property', targetPropertyUrl);
        redirectBase.searchParams.set(
          'message',
          verifyResult.error || 'Website verification could not be completed.',
        );
        return createRedirectResponse(redirectBase);
      }
    }

    // Case: Property verified successfully!
    const verifiedPropertyUrl = matchingProperty.siteUrl;

    const tokenBundle = {
      accessToken: tokens.access_token,
      accountEmail: userInfo.email,
      property: verifiedPropertyUrl,
      permissionLevel: matchingProperty.permissionLevel,
      scope: tokens.scope,
    };

    const encryptedAccessToken = await encrypt(JSON.stringify(tokenBundle));
    const encryptedRefreshToken = tokens.refresh_token ? await encrypt(tokens.refresh_token) : null;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existing = await db.searchConsoleConnection.findFirst({
      where: siteId ? { siteId } : {},
    });

    let connectionId: string;

    if (existing) {
      const updated = await db.searchConsoleConnection.update({
        where: { id: existing.id },
        data: {
          siteUrl: verifiedPropertyUrl,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? existing.refreshToken,
          expiresAt,
          status: 'CONNECTED',
          lastSyncAt: new Date(),
        },
      });
      connectionId = updated.id;
    } else {
      const created = await db.searchConsoleConnection.create({
        data: {
          siteId,
          siteUrl: verifiedPropertyUrl,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          status: 'CONNECTED',
          lastSyncAt: new Date(),
        },
      });
      connectionId = created.id;
    }

    // 8. Initial real Search Console data sync
    try {
      await syncRealSearchConsoleData(connectionId);
    } catch (syncErr: any) {
      console.warn(`[SEO:SC:INITIAL_SYNC_WARN] ${syncErr.message}`);
    }

    redirectBase.searchParams.set('success', 'connected');
    redirectBase.searchParams.set('account', userInfo.email);
    redirectBase.searchParams.set('property', verifiedPropertyUrl);

    return createRedirectResponse(redirectBase);
  } catch (err: any) {
    if (isDevOrLocalhost) {
      console.log(`[Search Console OAuth] failure reason: ${err?.message || 'Unexpected callback failure'}`);
    }
    console.error('[SEO:SC:CALLBACK_ERROR]', err);
    redirectBase.searchParams.set('error', 'unavailable');
    redirectBase.searchParams.set(
      'message',
      'Google Search Console connection is temporarily unavailable. Please try again later.',
    );
    return createRedirectResponse(redirectBase);
  }
}
