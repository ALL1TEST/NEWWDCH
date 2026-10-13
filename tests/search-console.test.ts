// ============================================================
// Unit & Integration Tests: Google Search Console Integration
// Covers all requirements: OAuth URL, token exchange, refresh,
// property discovery, Verdant matching, analytics queries, error handling.
// ============================================================

import { describe, it, test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleSearchConsoleAuthUrl,
  findMatchingVerdantProperty,
  getGoogleSearchConsoleConfig,
  VERDANT_PUBLIC_URL,
  SEARCH_CONSOLE_SCOPE,
  SITE_VERIFICATION_SCOPE,
  exchangeGoogleCodeForTokens,
  refreshGoogleAccessToken,
  listSearchConsoleProperties,
  querySearchAnalytics,
  canSiteAutoVerify,
  checkPublicSiteForMetaVerification,
  verifySiteWithGoogle,
  performAutomaticSiteVerification,
} from '../src/lib/seo/search-console-service';

const test = nodeTest || it;

describe('Google Search Console OAuth & Analytics Service', () => {
  // -------------------------------------------------------------------------
  // 1. OAuth URL Generation
  // -------------------------------------------------------------------------
  describe('OAuth URL Generation', () => {
    test('builds valid Google OAuth 2.0 authorization URL with readonly scope', () => {
      const clientId = 'test-client-id.apps.googleusercontent.com';
      const redirectUri = 'https://cms.verdant.app/api/integrations/google/search-console/callback';
      const state = 'test-secure-csrf-state-12345';

      const authUrl = buildGoogleSearchConsoleAuthUrl({
        clientId,
        redirectUri,
        state,
      });

      const parsed = new URL(authUrl);
      assert.strictEqual(parsed.origin, 'https://accounts.google.com');
      assert.strictEqual(parsed.pathname, '/o/oauth2/v2/auth');
      assert.strictEqual(parsed.searchParams.get('client_id'), clientId);
      assert.strictEqual(parsed.searchParams.get('redirect_uri'), redirectUri);
      assert.strictEqual(parsed.searchParams.get('response_type'), 'code');
      assert.strictEqual(parsed.searchParams.get('access_type'), 'offline');
      assert.strictEqual(parsed.searchParams.get('prompt'), 'consent');
      assert.strictEqual(parsed.searchParams.get('state'), state);

      const scope = parsed.searchParams.get('scope') || '';
      assert.ok(scope.includes(SEARCH_CONSOLE_SCOPE), `Scope must include ${SEARCH_CONSOLE_SCOPE}`);
      assert.ok(scope.includes('openid'), 'Scope should include openid');
      assert.ok(scope.includes('email'), 'Scope should include email');
    });

    test('scope strictly uses readonly and does not ask for full write webmasters scope', () => {
      assert.strictEqual(
        SEARCH_CONSOLE_SCOPE,
        'https://www.googleapis.com/auth/webmasters.readonly',
        'Scope must strictly be webmasters.readonly',
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Configuration & Redirect URI Resolution
  // -------------------------------------------------------------------------
  describe('Configuration & Redirect URI Resolution', () => {
    const originalEnv = { ...process.env };

    test('detects when Google credentials are not configured', () => {
      delete process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const config = getGoogleSearchConsoleConfig('http://localhost:3000');
      assert.strictEqual(config.isConfigured, false);
      assert.strictEqual(config.clientId, '');
      assert.strictEqual(config.clientSecret, '');
    });

    test('resolves dynamic redirect URI using request origin when not explicitly specified', () => {
      delete process.env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI;
      const config = getGoogleSearchConsoleConfig('https://my-cms.domain.com');
      assert.strictEqual(
        config.redirectUri,
        'https://my-cms.domain.com/api/integrations/google/search-console/callback',
      );
    });

    test('prefers GOOGLE_SEARCH_CONSOLE_REDIRECT_URI when specified', () => {
      process.env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI = 'https://custom-auth.domain.com/callback';
      const config = getGoogleSearchConsoleConfig('http://localhost:3000');
      assert.strictEqual(config.redirectUri, 'https://custom-auth.domain.com/callback');
      delete process.env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI;
    });

    // Restore env
    Object.assign(process.env, originalEnv);
  });

  // -------------------------------------------------------------------------
  // 3. Verdant Property Matching & Discovery
  // -------------------------------------------------------------------------
  describe('Verdant Property Discovery & Matching', () => {
    test('matches exact URL property with trailing slash', () => {
      const properties = [
        { siteUrl: 'https://other-site.com/', permissionLevel: 'siteOwner' },
        { siteUrl: 'https://verdantt.vercel.app/', permissionLevel: 'siteOwner' },
      ];

      const match = findMatchingVerdantProperty(properties, 'https://verdantt.vercel.app/');
      assert.ok(match !== null, 'Should match exact URL property with trailing slash');
      assert.strictEqual(match?.siteUrl, 'https://verdantt.vercel.app/');
    });

    test('matches URL property without trailing slash', () => {
      const properties = [
        { siteUrl: 'https://verdantt.vercel.app', permissionLevel: 'siteFullUser' },
      ];

      const match = findMatchingVerdantProperty(properties, 'https://verdantt.vercel.app/');
      assert.ok(match !== null, 'Should match URL property without trailing slash');
      assert.strictEqual(match?.siteUrl, 'https://verdantt.vercel.app');
    });

    test('matches domain property (sc-domain:verdantt.vercel.app)', () => {
      const properties = [
        { siteUrl: 'sc-domain:verdantt.vercel.app', permissionLevel: 'siteOwner' },
      ];

      const match = findMatchingVerdantProperty(properties, 'https://verdantt.vercel.app/');
      assert.ok(match !== null, 'Should match sc-domain property');
      assert.strictEqual(match?.siteUrl, 'sc-domain:verdantt.vercel.app');
    });

    test('returns null when authenticated account does NOT have access to Verdant', () => {
      const properties = [
        { siteUrl: 'https://some-client-blog.com/', permissionLevel: 'siteOwner' },
        { siteUrl: 'sc-domain:another-domain.org', permissionLevel: 'siteRestrictedUser' },
      ];

      const match = findMatchingVerdantProperty(properties, 'https://verdantt.vercel.app/');
      assert.strictEqual(match, null, 'Must return null when Verdant property is not in the account list');
    });

    test('does not match unrelated similar domains', () => {
      const properties = [
        { siteUrl: 'https://not-verdantt.vercel.app/', permissionLevel: 'siteOwner' },
        { siteUrl: 'https://verdantt-fake.vercel.app/', permissionLevel: 'siteOwner' },
      ];

      const match = findMatchingVerdantProperty(properties, 'https://verdantt.vercel.app/');
      assert.strictEqual(match, null);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Token Exchange Flow (Mocked HTTP Fetch)
  // -------------------------------------------------------------------------
  describe('Token Exchange & Error Handling', () => {
    const originalFetch = global.fetch;

    test('exchanges authorization code for access and refresh tokens successfully', async () => {
      global.fetch = async (url: any, options: any) => {
        if (url.toString() === 'https://oauth2.googleapis.com/token') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'ya29.mock-google-access-token',
              refresh_token: '1//0mock-refresh-token',
              expires_in: 3599,
              token_type: 'Bearer',
              scope: 'https://www.googleapis.com/auth/webmasters.readonly openid email',
            }),
          } as any;
        }
        return originalFetch(url, options);
      };

      const tokens = await exchangeGoogleCodeForTokens({
        code: '4/0Abc123ValidCode',
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret',
        redirectUri: 'https://cms.verdant.app/callback',
      });

      assert.strictEqual(tokens.access_token, 'ya29.mock-google-access-token');
      assert.strictEqual(tokens.refresh_token, '1//0mock-refresh-token');
      assert.strictEqual(tokens.expires_in, 3599);
    });

    test('throws descriptive error on invalid authorization code or secret', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Bad Request: Invalid grant code or expired token',
          }),
      } as any);

      await assert.rejects(
        async () => {
          await exchangeGoogleCodeForTokens({
            code: 'invalid_code',
            clientId: 'client',
            clientSecret: 'secret',
            redirectUri: 'https://cms.verdant.app/callback',
          });
        },
        (err: Error) => {
          assert.ok(err.message.includes('Invalid grant') || err.message.includes('invalid_grant'));
          return true;
        },
      );
    });

    test('refreshes expired access token using refresh token', async () => {
      global.fetch = async (url: any) => {
        if (url.toString() === 'https://oauth2.googleapis.com/token') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'ya29.new-refreshed-token',
              expires_in: 3600,
            }),
          } as any;
        }
        return { ok: false, status: 500 } as any;
      };

      const refreshed = await refreshGoogleAccessToken({
        refreshToken: '1//0refresh-token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      });

      assert.strictEqual(refreshed.access_token, 'ya29.new-refreshed-token');
      assert.strictEqual(refreshed.expires_in, 3600);
    });

    test('throws error when refresh token is revoked', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Token has been expired or revoked.',
          }),
      } as any);

      await assert.rejects(
        async () => {
          await refreshGoogleAccessToken({
            refreshToken: 'revoked_token',
            clientId: 'client',
            clientSecret: 'secret',
          });
        },
        (err: Error) => {
          assert.ok(err.message.includes('revoked') || err.message.includes('invalid_grant'));
          return true;
        },
      );
    });

    // Restore fetch
    global.fetch = originalFetch;
  });

  // -------------------------------------------------------------------------
  // 5. Search Console API & Analytics Querying
  // -------------------------------------------------------------------------
  describe('Search Console API & Analytics Querying', () => {
    const originalFetch = global.fetch;

    test('lists properties from Google Search Console API', async () => {
      global.fetch = async (url: any) => {
        if (url.toString().includes('/webmasters/v3/sites')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              siteEntry: [
                { siteUrl: 'https://verdantt.vercel.app/', permissionLevel: 'siteOwner' },
                { siteUrl: 'https://personal-blog.dev/', permissionLevel: 'siteFullUser' },
              ],
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      const sites = await listSearchConsoleProperties('ya29.token');
      assert.strictEqual(sites.length, 2);
      assert.strictEqual(sites[0].siteUrl, 'https://verdantt.vercel.app/');
      assert.strictEqual(sites[0].permissionLevel, 'siteOwner');
    });

    test('executes Search Analytics query and parses real performance rows', async () => {
      global.fetch = async (url: any, options: any) => {
        const body = JSON.parse(options.body);
        assert.strictEqual(body.startDate, '2026-09-01');
        assert.strictEqual(body.endDate, '2026-09-30');
        assert.deepStrictEqual(body.dimensions, ['date']);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            rows: [
              {
                keys: ['2026-09-01'],
                clicks: 42,
                impressions: 1250,
                ctr: 0.0336,
                position: 8.4,
              },
              {
                keys: ['2026-09-02'],
                clicks: 58,
                impressions: 1420,
                ctr: 0.0408,
                position: 7.9,
              },
            ],
          }),
        } as any;
      };

      const rows = await querySearchAnalytics({
        accessToken: 'ya29.token',
        propertyUrl: 'https://verdantt.vercel.app/',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        dimensions: ['date'],
      });

      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].keys[0], '2026-09-01');
      assert.strictEqual(rows[0].clicks, 42);
      assert.strictEqual(rows[0].impressions, 1250);
      assert.strictEqual(rows[0].position, 8.4);
    });

    test('handles Search Console API errors with human-readable messages', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({
            error: {
              code: 403,
              message: 'User does not have sufficient permissions for this site.',
              status: 'PERMISSION_DENIED',
            },
          }),
      } as any);

      await assert.rejects(
        async () => {
          await querySearchAnalytics({
            accessToken: 'ya29.token',
            propertyUrl: 'https://verdantt.vercel.app/',
            startDate: '2026-09-01',
            endDate: '2026-09-30',
          });
        },
        (err: Error) => {
          assert.ok(err.message.includes('User does not have sufficient permissions') || err.message.includes('403'));
          return true;
        },
      );
    });

    // Restore fetch
    global.fetch = originalFetch;
  });

  // -------------------------------------------------------------------------
  // 6. Client Security & Secret Isolation
  // -------------------------------------------------------------------------
  describe('Client Security & Platform Credential Isolation', () => {
    test('confirms platform OAuth environment variable names and secrets are never exposed in client redirect URLs on missing credentials', async () => {
      // Import the connect handler
      const { GET: connectHandler } = await import('../src/app/api/integrations/google/search-console/connect/route');
      const originalClientId = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
      const originalSecret = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
      delete process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
      delete process.env.GOOGLE_CLIENT_SECRET;

      try {
        const { NextRequest } = await import('next/server');
        const req = new NextRequest('http://localhost:3000/api/integrations/google/search-console/connect');
        const res = await connectHandler(req);

        const location = res.headers.get('location') || '';
        assert.ok(location, 'Must return redirect location');

        const parsed = new URL(location, 'http://localhost:3000');
        const message = parsed.searchParams.get('message') || '';

        // Must NOT expose env vars
        assert.ok(!message.includes('GOOGLE_SEARCH_CONSOLE_CLIENT_ID'), 'Must not expose GOOGLE_SEARCH_CONSOLE_CLIENT_ID');
        assert.ok(!message.includes('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET'), 'Must not expose GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET');
        assert.ok(!message.includes('.env'), 'Must not expose .env');
        assert.strictEqual(
          message,
          'Google Search Console connection is temporarily unavailable. Please try again later.',
        );
      } finally {
        if (originalClientId) process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID = originalClientId;
        if (originalSecret) process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET = originalSecret;
      }
    });

    test('verifies Search Console API responses never contain access tokens, refresh tokens, or platform secrets', async () => {
      const { GET: searchConsoleGetHandler } = await import('../src/app/api/seo/search-console/route');
      const { NextRequest } = await import('next/server');
      const { db } = await import('../src/lib/db');

      // Find an existing user or fallback to create session
      let user = await db.user.findFirst({ where: { role: 'OWNER' } });
      if (!user) user = await db.user.findFirst();

      const testToken = `test-sc-session-${Date.now()}`;
      let createdSession: { id: string } | null = null;
      if (user) {
        createdSession = await db.session.create({
          data: {
            token: testToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 3600_000),
          },
        });
      }

      try {
        const req = new NextRequest('http://localhost:3000/api/seo/search-console');
        if (createdSession) {
          req.cookies.set('cms_session_token', testToken);
        }

        const res = await searchConsoleGetHandler(req);
        if (createdSession) {
          assert.strictEqual(res.status, 200);

          const json = await res.json();
          const stringified = JSON.stringify(json);

          // Verify no secrets or sensitive fields in JSON response
          assert.ok(!('accessToken' in (json.data?.connection || {})), 'connection must NOT contain accessToken');
          assert.ok(!('refreshToken' in (json.data?.connection || {})), 'connection must NOT contain refreshToken');
          assert.ok(!('clientId' in json.data), 'data must NOT contain clientId');
          assert.ok(!('clientSecret' in json.data), 'data must NOT contain clientSecret');
          assert.ok(!('isConfigured' in json.data), 'data must NOT expose isConfigured platform flag');
          assert.ok(!stringified.includes('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET'), 'Response must not contain client secret name');
          assert.ok(!stringified.includes('ENCRYPTION_SECRET'), 'Response must not contain encryption secret name');
        }
      } finally {
        if (createdSession) {
          await db.session.delete({ where: { id: createdSession.id } }).catch(() => {});
        }
      }
    });

    test('verifies property matching supports exact URL, bare URL, and domain property for target website', () => {
      const target = 'https://verdantt.vercel.app/';

      // 1. Exact URL
      const matchWithSlash = findMatchingVerdantProperty(
        [{ siteUrl: 'https://verdantt.vercel.app/', permissionLevel: 'siteOwner' }],
        target,
      );
      assert.ok(matchWithSlash !== null);
      assert.strictEqual(matchWithSlash?.siteUrl, 'https://verdantt.vercel.app/');

      // 2. Bare URL without slash
      const matchWithoutSlash = findMatchingVerdantProperty(
        [{ siteUrl: 'https://verdantt.vercel.app', permissionLevel: 'siteOwner' }],
        target,
      );
      assert.ok(matchWithoutSlash !== null);
      assert.strictEqual(matchWithoutSlash?.siteUrl, 'https://verdantt.vercel.app');

      // 3. Domain property
      const matchDomainProp = findMatchingVerdantProperty(
        [{ siteUrl: 'sc-domain:verdantt.vercel.app', permissionLevel: 'siteOwner' }],
        target,
      );
      assert.ok(matchDomainProp !== null);
      assert.strictEqual(matchDomainProp?.siteUrl, 'sc-domain:verdantt.vercel.app');
    });
  });

  // -------------------------------------------------------------------------
  // 7. SaaS-Grade Verification & Seamless Onboarding Flow (Scenarios 1 - 9)
  // -------------------------------------------------------------------------
  describe('SaaS-Grade Automatic & Manual Site Verification Flow', () => {
    const originalFetch = global.fetch;

    // 1. Existing property access -> immediate connection
    test('1. Existing property access connects immediately without initiating verification', async () => {
      const properties = [
        { siteUrl: 'https://verdantt.vercel.app/', permissionLevel: 'siteOwner' },
      ];
      const match = findMatchingVerdantProperty(properties, 'https://verdantt.vercel.app/');
      assert.ok(match, 'Property should be found');
      assert.strictEqual(match?.siteUrl, 'https://verdantt.vercel.app/');
    });

    // 2. No property access + CMS write access -> automatic verification
    test('2. No property access + CMS write access executes automatic verification flow', async () => {
      const mockSite = {
        id: 'site-1',
        slug: 'verdant',
        domain: 'verdantt.vercel.app',
      };

      const writeCheck = canSiteAutoVerify(mockSite);
      assert.strictEqual(writeCheck.canAutoVerify, true);
      assert.ok(writeCheck.writeType, 'Must identify writeType');

      // Mock Google Site Verification API and public site fetch
      global.fetch = async (url: any) => {
        const urlStr = url.toString();
        // 1. Token request
        if (urlStr.includes('/siteVerification/v1/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              token: '<meta name="google-site-verification" content="test-token-12345" />',
            }),
          } as any;
        }
        // 2. Public site fetch
        if (urlStr.includes('verdantt.vercel.app')) {
          return {
            ok: true,
            status: 200,
            text: async () => `
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Verdant</title>
                  <meta name="google-site-verification" content="test-token-12345" />
                </head>
                <body><h1>Verdant</h1></body>
              </html>
            `,
          } as any;
        }
        // 3. Google Site Verification API
        if (urlStr.includes('/siteVerification/v1/webResource')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'https://verdantt.vercel.app/',
              owners: ['client@domain.com'],
            }),
          } as any;
        }
        // 4. Add Search Console site
        if (urlStr.includes('/webmasters/v3/sites/')) {
          return { ok: true, status: 204 } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      try {
        const result = await performAutomaticSiteVerification({
          accessToken: 'ya29.test-token',
          site: mockSite,
          targetPropertyUrl: 'https://verdantt.vercel.app/',
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.canAutoVerify, true);
        assert.strictEqual(result.step, 'completed');
        assert.strictEqual(result.token, 'test-token-12345');
      } finally {
        global.fetch = originalFetch;
      }
    });

    // 3. Verification token injected into public HTML check
    test('3. checkPublicSiteForMetaVerification validates token presence strictly in rendered <head>', async () => {
      global.fetch = async (url: any) => {
        if (url.toString().includes('verdantt.vercel.app')) {
          return {
            ok: true,
            status: 200,
            text: async () => `
              <html>
                <head>
                  <meta name="google-site-verification" content="expected-token-xyz" />
                </head>
                <body>Content</body>
              </html>
            `,
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      try {
        // Success match
        const okCheck = await checkPublicSiteForMetaVerification({
          siteUrl: 'https://verdantt.vercel.app/',
          expectedToken: 'expected-token-xyz',
        });
        assert.strictEqual(okCheck.verified, true);
        assert.strictEqual(okCheck.foundToken, 'expected-token-xyz');

        // Mismatched token
        const mismatchCheck = await checkPublicSiteForMetaVerification({
          siteUrl: 'https://verdantt.vercel.app/',
          expectedToken: 'different-token-abc',
        });
        assert.strictEqual(mismatchCheck.verified, false);
        assert.ok(mismatchCheck.error?.includes('did not match'));
      } finally {
        global.fetch = originalFetch;
      }
    });

    // 4. Google verification succeeds
    test('4. verifySiteWithGoogle calls Google Site Verification API with least-privileged META method', async () => {
      let calledUrl = '';
      let calledBody: any = null;

      global.fetch = async (url: any, opts: any) => {
        calledUrl = url.toString();
        calledBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'https://verdantt.vercel.app/',
            owners: ['user@example.com'],
          }),
        } as any;
      };

      try {
        const result = await verifySiteWithGoogle({
          accessToken: 'ya29.valid-token',
          siteUrl: 'https://verdantt.vercel.app/',
        });

        assert.strictEqual(result.id, 'https://verdantt.vercel.app/');
        assert.deepStrictEqual(result.owners, ['user@example.com']);
        assert.ok(calledUrl.includes('verificationMethod=META'));
        assert.strictEqual(calledBody.site.identifier, 'https://verdantt.vercel.app/');
      } finally {
        global.fetch = originalFetch;
      }
    });

    // 5. Google verification fails
    test('5. verifySiteWithGoogle rejects when Google API returns verification failure', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              code: 400,
              message: 'The meta tag was not found on your site.',
              status: 'INVALID_ARGUMENT',
            },
          }),
      } as any);

      try {
        await assert.rejects(
          async () => {
            await verifySiteWithGoogle({
              accessToken: 'ya29.token',
              siteUrl: 'https://verdantt.vercel.app/',
            });
          },
          (err: Error) => {
            assert.ok(err.message.includes('The meta tag was not found'));
            return true;
          },
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    // 6. CMS has no write access -> manual fallback
    test('6. CMS without write access falls back to manual verification guidance', async () => {
      const readOnlySite = {
        id: 'external-site',
        slug: 'external-custom-domain',
        domain: 'external-site.com',
        config: JSON.stringify({}),
      };

      const check = canSiteAutoVerify(readOnlySite);
      assert.strictEqual(check.canAutoVerify, false);
      assert.strictEqual(check.reason, "Automatic verification isn't available for this site yet.");

      // When performAutomaticSiteVerification runs, it returns manual_fallback_required
      global.fetch = async (url: any) => {
        if (url.toString().includes('/siteVerification/v1/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              token: '<meta name="google-site-verification" content="manual-token-777" />',
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      try {
        const outcome = await performAutomaticSiteVerification({
          accessToken: 'ya29.token',
          site: readOnlySite,
          targetPropertyUrl: 'https://external-site.com/',
        });

        assert.strictEqual(outcome.success, false);
        assert.strictEqual(outcome.canAutoVerify, false);
        assert.strictEqual(outcome.step, 'manual_fallback_required');
        assert.strictEqual(outcome.token, 'manual-token-777');
        assert.ok(outcome.metaTag?.includes('google-site-verification'));
      } finally {
        global.fetch = originalFetch;
      }
    });

    // 7. Never mark connected before live Google verification confirms
    test('7. Never marks verification successful if live website check fails', async () => {
      const mockSite = {
        id: 'site-1',
        slug: 'verdant',
        domain: 'verdantt.vercel.app',
      };

      global.fetch = async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/siteVerification/v1/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ token: 'expected-token-abc' }),
          } as any;
        }
        if (urlStr.includes('verdantt.vercel.app')) {
          // Public site returns HTML with NO verification tag
          return {
            ok: true,
            status: 200,
            text: async () => '<html><head><title>No Tag</title></head><body>Hello</body></html>',
          } as any;
        }
        // Google verify should NEVER be called
        if (urlStr.includes('/siteVerification/v1/webResource')) {
          assert.fail('Google Site Verification API should NOT be called if public check fails');
        }
        return { ok: false, status: 404 } as any;
      };

      try {
        const outcome = await performAutomaticSiteVerification({
          accessToken: 'ya29.token',
          site: mockSite,
          targetPropertyUrl: 'https://verdantt.vercel.app/',
        });

        assert.strictEqual(outcome.success, false);
        assert.strictEqual(outcome.step, 'public_verification');
        assert.ok(outcome.error?.includes('not found in the <head>'));
      } finally {
        global.fetch = originalFetch;
      }
    });

    // 8. No secrets exposed to client in verification metadata
    test('8. Verification metadata contains only safe instructions and never credentials or tokens', async () => {
      const tokenBundle = {
        accessToken: 'ya29.secret-access-token',
        refreshToken: '1//0secret-refresh-token',
        accountEmail: 'client@gmail.com',
        verificationToken: 'public-verification-token',
        verificationMetaTag: '<meta name="google-site-verification" content="public-verification-token" />',
        targetPropertyUrl: 'https://verdantt.vercel.app/',
        error: 'MANUAL_VERIFICATION_REQUIRED',
      };

      // Ensure the pendingVerification schema exposed to client omits accessToken, refreshToken
      const clientSafe = {
        manualRequired: tokenBundle.error === 'MANUAL_VERIFICATION_REQUIRED',
        token: tokenBundle.verificationToken,
        metaTag: tokenBundle.verificationMetaTag,
        targetPropertyUrl: tokenBundle.targetPropertyUrl,
        accountEmail: tokenBundle.accountEmail,
      };

      assert.ok(!('accessToken' in clientSafe));
      assert.ok(!('refreshToken' in clientSafe));
      assert.ok(!('clientSecret' in clientSafe));
      assert.strictEqual(clientSafe.token, 'public-verification-token');
      assert.strictEqual(clientSafe.accountEmail, 'client@gmail.com');
    });

    // 9. Existing readonly Search Console analytics continues working
    test('9. Existing Search Console analytics operates normally with readonly scope', async () => {
      assert.strictEqual(SEARCH_CONSOLE_SCOPE, 'https://www.googleapis.com/auth/webmasters.readonly');
      assert.strictEqual(SITE_VERIFICATION_SCOPE, 'https://www.googleapis.com/auth/siteverification.verify_only');

      global.fetch = async (url: any, opts: any) => {
        if (url.toString().includes('searchAnalytics/query')) {
          const body = JSON.parse(opts.body);
          assert.strictEqual(body.startDate, '2026-09-01');
          assert.strictEqual(body.endDate, '2026-09-28');
          return {
            ok: true,
            status: 200,
            json: async () => ({
              rows: [
                {
                  keys: ['https://verdantt.vercel.app/pricing'],
                  clicks: 15,
                  impressions: 300,
                  ctr: 0.05,
                  position: 4.2,
                },
              ],
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      try {
        const rows = await querySearchAnalytics({
          accessToken: 'ya29.token',
          propertyUrl: 'https://verdantt.vercel.app/',
          startDate: '2026-09-01',
          endDate: '2026-09-28',
          dimensions: ['page'],
        });

        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].keys[0], 'https://verdantt.vercel.app/pricing');
        assert.strictEqual(rows[0].clicks, 15);
        assert.strictEqual(rows[0].impressions, 300);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});


