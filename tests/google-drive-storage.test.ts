// ============================================================
// Unit Tests: Google Drive Backup Storage Provider
// Covers:
// 1. Invalid credentials (missing clientId, clientSecret, or refreshToken)
// 2. Google OAuth token refresh invalid_client error
// 3. Google OAuth token refresh invalid_grant error (expired/revoked refresh token)
// 4. Token refresh network errors
// 5. Insufficient OAuth scopes error from Google Drive API
// 6. Google Drive API disabled / accessNotConfigured error
// 7. Google Drive API permission denied (403)
// 8. Google Drive API unauthorized (401)
// 9. Google Drive API folder not found (404)
// 10. Successful connection when both token refresh and Drive API ping succeed
// 11. Ensuring storage is never claimed connected when Drive API ping fails
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { GoogleDriveStorageProvider } from '../src/lib/backup/providers/google-drive.ts';

describe('GoogleDriveStorageProvider Connection Validation Suite', () => {
  const originalFetch = globalThis.fetch;

  function restoreFetch() {
    globalThis.fetch = originalFetch;
  }

  // -------------------------------------------------------------------------
  // 1. Missing credentials checks
  // -------------------------------------------------------------------------
  it('fails when Client ID is missing or empty', async () => {
    const provider = new GoogleDriveStorageProvider({
      clientId: '',
      clientSecret: 'secret_123',
      refreshToken: '1//refresh_token_abc',
    });

    const result = await provider.testConnection();
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('Client ID'));
  });

  it('fails when Client Secret is missing or empty', async () => {
    const provider = new GoogleDriveStorageProvider({
      clientId: 'client_123.apps.googleusercontent.com',
      clientSecret: '',
      refreshToken: '1//refresh_token_abc',
    });

    const result = await provider.testConnection();
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('Client Secret'));
  });

  it('fails when Refresh Token is missing or empty', async () => {
    const provider = new GoogleDriveStorageProvider({
      clientId: 'client_123.apps.googleusercontent.com',
      clientSecret: 'secret_123',
      refreshToken: '  ',
    });

    const result = await provider.testConnection();
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('Refresh Token'));
  });

  // -------------------------------------------------------------------------
  // 2. Google OAuth token refresh errors: invalid_client
  // -------------------------------------------------------------------------
  it('returns actionable error for invalid_client from Google token endpoint', async () => {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({
            error: 'invalid_client',
            error_description: 'The OAuth client was not found.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'invalid_client_id.apps.googleusercontent.com',
        clientSecret: 'wrong_secret',
        refreshToken: '1//valid_refresh_token',
      });

      const result = await provider.testConnection();
      assert.strictEqual(result.success, false);
      assert.ok(
        result.message.includes('Client ID or Client Secret is invalid'),
        `Expected message to mention invalid Client ID/Secret, got: "${result.message}"`
      );
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 3. Google OAuth token refresh errors: invalid_grant (expired/revoked token)
  // -------------------------------------------------------------------------
  it('returns actionable error for invalid_grant (expired or revoked token)', async () => {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Token has been expired or revoked.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'valid_client.apps.googleusercontent.com',
        clientSecret: 'valid_secret',
        refreshToken: '1//expired_refresh_token',
      });

      const result = await provider.testConnection();
      assert.strictEqual(result.success, false);
      assert.ok(
        result.message.includes('expired, revoked, or invalid'),
        `Expected message to mention expired/revoked token, got: "${result.message}"`
      );
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 4. Token refresh network error
  // -------------------------------------------------------------------------
  it('handles network failure reaching Google OAuth endpoint', async () => {
    globalThis.fetch = async () => {
      throw new Error('fetch failed: connect ECONNREFUSED');
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'valid_client.apps.googleusercontent.com',
        clientSecret: 'valid_secret',
        refreshToken: '1//refresh_token',
      });

      const result = await provider.testConnection();
      assert.strictEqual(result.success, false);
      assert.ok(
        result.message.includes('Network error connecting to Google OAuth endpoint'),
        `Expected network error message, got: "${result.message}"`
      );
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 5. Drive API: Insufficient Scopes
  // -------------------------------------------------------------------------
  it('identifies insufficient scopes when token refresh succeeds but Drive API rejects scope', async () => {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'valid_access_token_mock', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('googleapis.com/drive/v3/files')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'Request had insufficient authentication scopes.',
              status: 'PERMISSION_DENIED',
              errors: [{ message: 'Insufficient Permission', domain: 'global', reason: 'insufficientPermissions' }],
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'valid_client.apps.googleusercontent.com',
        clientSecret: 'valid_secret',
        refreshToken: '1//refresh_token_without_drive_scope',
      });

      const result = await provider.testConnection();
      assert.strictEqual(result.success, false);
      assert.ok(
        result.message.includes('Insufficient OAuth scopes'),
        `Expected insufficient scopes error, got: "${result.message}"`
      );
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 6. Drive API: API Disabled in Google Cloud Console
  // -------------------------------------------------------------------------
  it('identifies disabled Google Drive API and instructs user to enable it', async () => {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'valid_access_token_mock' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('googleapis.com/drive/v3/files')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message:
                'Google Drive API has not been used in project 123456 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=123456 then retry.',
              status: 'PERMISSION_DENIED',
              errors: [{ message: 'Access Not Configured', domain: 'usageLimits', reason: 'accessNotConfigured' }],
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'valid_client.apps.googleusercontent.com',
        clientSecret: 'valid_secret',
        refreshToken: '1//valid_refresh_token',
      });

      const result = await provider.testConnection();
      assert.strictEqual(result.success, false);
      assert.ok(
        result.message.includes('Google Drive API is not enabled in your Google Cloud Project'),
        `Expected API disabled error, got: "${result.message}"`
      );
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 7. Drive API: Permission Denied (403)
  // -------------------------------------------------------------------------
  it('identifies general permission denied on Google Drive API', async () => {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'valid_access_token_mock' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('googleapis.com/drive/v3/files')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'The user does not have sufficient permissions for this file.',
              status: 'PERMISSION_DENIED',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'valid_client.apps.googleusercontent.com',
        clientSecret: 'valid_secret',
        refreshToken: '1//valid_refresh_token',
      });

      const result = await provider.testConnection();
      assert.strictEqual(result.success, false);
      assert.ok(
        result.message.includes('Google Drive permission denied'),
        `Expected permission denied error, got: "${result.message}"`
      );
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 8. Drive API: Folder Not Found (404)
  // -------------------------------------------------------------------------
  it('identifies when target folder ID does not exist in Google Drive', async () => {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'valid_access_token_mock' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // General list ping succeeds
      if (urlStr.includes('pageSize=1&fields=files(id)')) {
        return new Response(JSON.stringify({ files: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Target folder ping returns 404
      if (urlStr.includes('/nonexistent_folder_xyz')) {
        return new Response(
          JSON.stringify({ error: { code: 404, message: 'File not found' } }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'valid_client.apps.googleusercontent.com',
        clientSecret: 'valid_secret',
        refreshToken: '1//valid_refresh_token',
        folderId: 'nonexistent_folder_xyz',
      });

      const result = await provider.testConnection();
      assert.strictEqual(result.success, false);
      assert.ok(
        result.message.includes('Target Google Drive folder ID "nonexistent_folder_xyz" was not found'),
        `Expected folder not found error, got: "${result.message}"`
      );
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 9. Drive API: Success case (root)
  // -------------------------------------------------------------------------
  it('succeeds and claims connected only when real token exchange and Drive API call succeed', async () => {
    let tokenEndpointCalled = false;
    let driveApiCalled = false;

    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        tokenEndpointCalled = true;
        // Verify Client ID, Client Secret, and Refresh Token are used together in request body
        const bodyStr = init?.body?.toString() || '';
        assert.ok(bodyStr.includes('client_id=my_client_id.apps.googleusercontent.com'));
        assert.ok(bodyStr.includes('client_secret=my_client_secret'));
        assert.ok(bodyStr.includes('refresh_token=1%2F%2Fmy_refresh_token'));
        assert.ok(bodyStr.includes('grant_type=refresh_token'));

        return new Response(
          JSON.stringify({ access_token: 'super_secret_access_token_123', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('googleapis.com/drive/v3/files')) {
        driveApiCalled = true;
        assert.strictEqual(init?.headers && (init.headers as any).Authorization, 'Bearer super_secret_access_token_123');
        return new Response(
          JSON.stringify({ files: [{ id: 'file_1' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'my_client_id.apps.googleusercontent.com',
        clientSecret: 'my_client_secret',
        refreshToken: '1//my_refresh_token',
        folderId: 'root',
      });

      const result = await provider.testConnection();
      assert.strictEqual(tokenEndpointCalled, true);
      assert.strictEqual(driveApiCalled, true);
      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('Connected to Google Drive (Drive root)'));
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 10. Requirement 6: Does NOT claim storage is connected when Drive API fails
  // -------------------------------------------------------------------------
  it('never claims connected if Drive API ping fails after token refresh', async () => {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'fresh_token_abc' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('googleapis.com/drive/v3/files')) {
        return new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'client_abc',
        clientSecret: 'secret_abc',
        refreshToken: '1//token_abc',
      });

      const result = await provider.testConnection();
      assert.strictEqual(result.success, false);
      assert.ok(!result.message.includes('Connected to Google Drive'));
      assert.ok(result.message.includes('Google Drive API returned HTTP 500'));
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 11. Real Google Drive Upload Operation
  // -------------------------------------------------------------------------
  it('performs real Google Drive upload with multipart metadata and folder destination', async () => {
    let uploadEndpointCalled = false;
    let uploadedBodyText = '';

    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'test_drive_access_token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('upload/drive/v3/files')) {
        uploadEndpointCalled = true;
        if (init?.body && Buffer.isBuffer(init.body)) {
          uploadedBodyText = init.body.toString('utf-8');
        }
        return new Response(
          JSON.stringify({ id: 'drive_file_id_999', name: 'backup-2026.zip' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    const testFilePath = join(process.cwd(), '.tmp-test-backup.txt');
    writeFileSync(testFilePath, 'backup content test payload');

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'client_abc',
        clientSecret: 'secret_abc',
        refreshToken: '1//token_abc',
        folderId: 'target_folder_123',
      });

      const res = await provider.upload(testFilePath, 'backup-2026.zip');
      assert.strictEqual(uploadEndpointCalled, true);
      assert.strictEqual(res.remotePath, 'drive_file_id_999');
      assert.ok(res.size > 0);
      assert.ok(res.checksum.length > 0);
      assert.ok(uploadedBodyText.includes('target_folder_123'), 'Uploaded multipart body must specify destination folder');
      assert.ok(uploadedBodyText.includes('backup-2026.zip'), 'Uploaded multipart body must specify filename');
    } finally {
      if (existsSync(testFilePath)) unlinkSync(testFilePath);
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 12. Real Google Drive Verify Operation
  // -------------------------------------------------------------------------
  it('performs real Google Drive file existence and size verification', async () => {
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'test_drive_access_token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('drive/v3/files/drive_file_id_999')) {
        return new Response(
          JSON.stringify({ id: 'drive_file_id_999', name: 'backup-2026.zip', size: '1024', trashed: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'client_abc',
        clientSecret: 'secret_abc',
        refreshToken: '1//token_abc',
        folderId: 'target_folder_123',
      });

      const verifyRes = await provider.verify('drive_file_id_999', 1024);
      assert.strictEqual(verifyRes.exists, true);
      assert.strictEqual(verifyRes.size, 1024);
      assert.strictEqual(verifyRes.checksumMatch, true);
    } finally {
      restoreFetch();
    }
  });

  // -------------------------------------------------------------------------
  // 13. Real Google Drive Delete Operation
  // -------------------------------------------------------------------------
  it('performs real Google Drive delete operation', async () => {
    let deleteEndpointCalled = false;

    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({ access_token: 'test_drive_access_token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('drive/v3/files/drive_file_id_999') && init?.method === 'DELETE') {
        deleteEndpointCalled = true;
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request to ${urlStr}`);
    };

    try {
      const provider = new GoogleDriveStorageProvider({
        clientId: 'client_abc',
        clientSecret: 'secret_abc',
        refreshToken: '1//token_abc',
      });

      await provider.deleteFile('drive_file_id_999');
      assert.strictEqual(deleteEndpointCalled, true);
    } finally {
      restoreFetch();
    }
  });
});
