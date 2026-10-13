// ============================================================
// GET /api/integrations/google/search-console/connect
// Initiates the server-side Google OAuth 2.0 flow for Search Console
// Platform credentials are configured server-side and never exposed to the client
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId } from '@/lib/utils';
import {
  getGoogleSearchConsoleConfig,
  buildGoogleSearchConsoleAuthUrl,
} from '@/lib/seo/search-console-service';

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
  const config = getGoogleSearchConsoleConfig(origin);
  const isDevOrLocalhost =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    process.env.NODE_ENV !== 'production';

  // If platform OAuth credentials are missing, log technical error server-side
  // and show the client a generic unavailable message without exposing secrets or env var names.
  if (!config.isConfigured) {
    const missing: string[] = [];
    if (!config.clientId) missing.push('GOOGLE_SEARCH_CONSOLE_CLIENT_ID (or GOOGLE_CLIENT_ID)');
    if (!config.clientSecret) missing.push('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET (or GOOGLE_CLIENT_SECRET)');
    const failureReason = `Missing required environment variables: ${missing.join(', ')}`;

    if (isDevOrLocalhost) {
      console.log(`[Search Console OAuth] credentials configured: false`);
      console.log(`[Search Console OAuth] redirect URI: ${config.redirectUri}`);
      console.log(`[Search Console OAuth] authorization URL generated: false`);
      console.log(`[Search Console OAuth] failure reason: ${failureReason}`);
    } else {
      console.error(
        '[SEO:SC:CONNECT] Google Search Console platform credentials not configured on server (missing GOOGLE_SEARCH_CONSOLE_CLIENT_ID / GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET).',
      );
    }

    const errorUrl = new URL('/#/seo', origin);
    errorUrl.searchParams.set('tab', 'search-console');
    errorUrl.searchParams.set('error', 'unavailable');
    errorUrl.searchParams.set(
      'message',
      'Google Search Console connection is temporarily unavailable. Please try again later.',
    );
    return NextResponse.redirect(errorUrl, 302);
  }

  // Anti-CSRF state token
  const state = `sc_${generateRequestId()}${generateRequestId()}`;

  // Check if caller requests switching account or selecting specific account
  const isSwitch =
    request.nextUrl.searchParams.get('prompt') === 'select_account' ||
    request.nextUrl.searchParams.get('switch') === 'true';

  let authUrl = '';
  try {
    authUrl = buildGoogleSearchConsoleAuthUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      prompt: isSwitch ? 'consent select_account' : 'consent',
    });
  } catch (err: any) {
    const failureReason = err?.message || 'Failed to generate OAuth URL';
    if (isDevOrLocalhost) {
      console.log(`[Search Console OAuth] credentials configured: true`);
      console.log(`[Search Console OAuth] redirect URI: ${config.redirectUri}`);
      console.log(`[Search Console OAuth] authorization URL generated: false`);
      console.log(`[Search Console OAuth] failure reason: ${failureReason}`);
    }
    const errorUrl = new URL('/#/seo', origin);
    errorUrl.searchParams.set('tab', 'search-console');
    errorUrl.searchParams.set('error', 'unavailable');
    errorUrl.searchParams.set(
      'message',
      'Google Search Console connection is temporarily unavailable. Please try again later.',
    );
    return NextResponse.redirect(errorUrl, 302);
  }

  if (isDevOrLocalhost) {
    console.log(`[Search Console OAuth] credentials configured: true`);
    console.log(`[Search Console OAuth] redirect URI: ${config.redirectUri}`);
    console.log(`[Search Console OAuth] authorization URL generated: true`);
  }

  const response = NextResponse.redirect(authUrl, 302);

  // Store anti-CSRF state in short-lived httpOnly cookie
  response.cookies.set('g_sc_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  // Track siteId if provided by CMS client session
  const siteId = request.nextUrl.searchParams.get('siteId');
  if (siteId) {
    response.cookies.set('g_sc_site_id', siteId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    });
  }

  return response;
}
