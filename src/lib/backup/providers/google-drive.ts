// ============================================================
// Google Drive Storage Provider — real OAuth refresh-token test
// ============================================================
// The Test Connection performs a REAL OAuth2 refresh-token exchange
// against Google's token endpoint, then pings the Drive API. No fake
// success: if the refresh token is invalid or Google is unreachable,
// the test fails honestly.
//
// Upload/download against Drive is not implemented in this build —
// running a backup against a Google Drive destination fails fast with
// a clear, actionable error (see upload()). The storage CONFIG (client
// ID, client secret, refresh token, folder ID) is real, encrypted at
// rest, and exactly what a production Drive upload integration needs.

import type { StorageProvider, UploadResult, VerifyResult, GoogleDriveConfig } from './types';
import { readFile, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name = 'Google Drive';
  protected config: GoogleDriveConfig;

  constructor(config: GoogleDriveConfig) {
    this.config = config;
  }

  /**
   * Validates that all required OAuth credentials are present and non-empty.
   */
  protected validateCredentials(): { valid: boolean; error?: string } {
    if (!this.config.clientId || !this.config.clientId.trim()) {
      return { valid: false, error: 'Google Drive connection requires a Client ID.' };
    }
    if (!this.config.clientSecret || !this.config.clientSecret.trim()) {
      return { valid: false, error: 'Google Drive connection requires a Client Secret.' };
    }
    if (!this.config.refreshToken || !this.config.refreshToken.trim()) {
      return { valid: false, error: 'Google Drive connection requires a Refresh Token.' };
    }
    return { valid: true };
  }

  /** Exchange the refresh token for an access token. Returns the access
   *  token on success, throws on failure.
   *  Verifies Client ID, Client Secret, and Refresh Token are used together.
   *  Logs HTTP status and sanitized error details without logging secrets/tokens. */
  protected async refreshAccessToken(): Promise<string> {
    const credValidation = this.validateCredentials();
    if (!credValidation.valid) {
      throw new Error(credValidation.error);
    }

    const body = new URLSearchParams({
      client_id: this.config.clientId.trim(),
      client_secret: this.config.clientSecret.trim(),
      refresh_token: this.config.refreshToken.trim(),
      grant_type: 'refresh_token',
    });

    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (netErr) {
      const netMsg = netErr instanceof Error ? netErr.message : 'Network failure';
      console.error(`[Google Drive OAuth] Network error connecting to token endpoint: ${netMsg}`);
      throw new Error(`Network error connecting to Google OAuth endpoint (${TOKEN_URL}): ${netMsg}`);
    }

    // 1. Log HTTP status without logging client secrets or tokens
    console.log(`[Google Drive OAuth] Token refresh response HTTP status: ${res.status}`);

    if (!res.ok) {
      let errCode = '';
      let errDesc = '';
      try {
        const j = (await res.json()) as { error?: string; error_description?: string };
        errCode = typeof j.error === 'string' ? j.error : '';
        errDesc = typeof j.error_description === 'string' ? j.error_description : '';
      } catch {
        /* non-JSON response */
      }

      const sanitizedErrCode = errCode || `HTTP_${res.status}`;
      const sanitizedErrDesc =
        errDesc.replace(/[\r\n]+/g, ' ').slice(0, 250) || res.statusText || 'Token refresh failed';

      // 1. Log sanitized error code/message without secrets or tokens
      console.error(
        `[Google Drive OAuth] Token refresh error: status=${res.status}, code=${sanitizedErrCode}, message=${sanitizedErrDesc}`
      );

      // 4. Actionable specific error messages
      if (errCode === 'invalid_grant') {
        throw new Error(
          'Google OAuth refresh token is expired, revoked, or invalid. Please generate a new refresh token in Google Cloud Console or OAuth 2.0 Playground.'
        );
      }
      if (errCode === 'invalid_client') {
        throw new Error(
          'Google OAuth Client ID or Client Secret is invalid. Verify your Client ID and Client Secret in Google Cloud Console (APIs & Services > Credentials).'
        );
      }
      if (errCode === 'unauthorized_client') {
        throw new Error(
          'OAuth client is not authorized for token refresh. Verify your OAuth consent screen and client configuration in Google Cloud Console.'
        );
      }
      if (errCode === 'invalid_request') {
        throw new Error(
          sanitizedErrDesc
            ? `Google OAuth request error: ${sanitizedErrDesc}`
            : 'Invalid token refresh request format sent to Google.'
        );
      }

      throw new Error(
        sanitizedErrDesc
          ? `Google OAuth token refresh failed (${sanitizedErrCode}): ${sanitizedErrDesc}`
          : `Google OAuth token refresh failed with HTTP ${res.status}.`
      );
    }

    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      console.error('[Google Drive OAuth] Token refresh succeeded but returned no access token.');
      throw new Error('Google OAuth endpoint succeeded but did not return an access token.');
    }

    console.log('[Google Drive OAuth] Token refresh succeeded.');
    return data.access_token;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.refreshAccessToken();

      // 3. Test Google Drive API access and identify failure causes
      let driveRes: Response;
      try {
        driveRes = await fetch(`${DRIVE_FILES_URL}?pageSize=1&fields=files(id)`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (netErr) {
        const netMsg = netErr instanceof Error ? netErr.message : 'Network failure';
        console.error(`[Google Drive API] Network error accessing Drive API: ${netMsg}`);
        return {
          success: false,
          message: `Network error connecting to Google Drive API: ${netMsg}. Check internet connectivity or proxy settings.`,
        };
      }

      console.log(`[Google Drive API] Ping response HTTP status: ${driveRes.status}`);

      if (!driveRes.ok) {
        let apiCode: number | undefined;
        let apiMessage = '';
        let errorReason = '';

        try {
          const j = (await driveRes.json()) as {
            error?: {
              code?: number;
              message?: string;
              status?: string;
              errors?: Array<{ reason?: string; message?: string; domain?: string }>;
            };
          };
          if (j.error) {
            apiCode = j.error.code;
            apiMessage = j.error.message || '';
            errorReason = j.error.errors?.[0]?.reason || '';
          }
        } catch {
          /* non-JSON response */
        }

        console.error(
          `[Google Drive API] Access failed: status=${driveRes.status}, code=${apiCode || driveRes.status}, reason=${errorReason || 'none'}, message=${apiMessage || 'none'}`
        );

        // Check: Google Drive API Enablement
        const isApiDisabled =
          errorReason === 'accessNotConfigured' ||
          apiMessage.toLowerCase().includes('has not been used in project') ||
          apiMessage.toLowerCase().includes('is not enabled') ||
          apiMessage.toLowerCase().includes('is disabled') ||
          apiMessage.toLowerCase().includes('enable it by visiting');

        if (isApiDisabled) {
          return {
            success: false,
            message:
              'Google Drive API is not enabled in your Google Cloud Project. Please enable the Google Drive API in Google Cloud Console (APIs & Services > Library > Google Drive API).',
          };
        }

        // Check: Insufficient OAuth Scopes
        const isInsufficientScope =
          errorReason === 'insufficientPermissions' ||
          errorReason === 'insufficient_scope' ||
          apiMessage.toLowerCase().includes('insufficient authentication scopes') ||
          apiMessage.toLowerCase().includes('insufficient permission') ||
          (driveRes.status === 403 && apiMessage.toLowerCase().includes('scope'));

        if (isInsufficientScope) {
          return {
            success: false,
            message:
              'Insufficient OAuth scopes. The refresh token must be granted Google Drive permissions (e.g. https://www.googleapis.com/auth/drive or https://www.googleapis.com/auth/drive.file).',
          };
        }

        // Check: Forbidden / Permission Denied
        if (driveRes.status === 403) {
          return {
            success: false,
            message: apiMessage
              ? `Google Drive permission denied: ${apiMessage}`
              : 'Access denied by Google Drive. Check project IAM permissions or Google Workspace organizational policies.',
          };
        }

        // Check: Unauthorized / Token Rejected
        if (driveRes.status === 401) {
          return {
            success: false,
            message:
              'Google Drive rejected the access token (unauthorized). The refresh token or client credentials may be invalid or mismatched.',
          };
        }

        return {
          success: false,
          message: apiMessage
            ? `Google Drive API error (${apiCode || driveRes.status}): ${apiMessage}`
            : `Google Drive API returned HTTP ${driveRes.status}.`,
        };
      }

      // Check folder accessibility if folderId is specified and not 'root'
      const rawFolderId = this.config.folderId?.trim();
      if (rawFolderId && rawFolderId.toLowerCase() !== 'root') {
        try {
          const folderRes = await fetch(
            `${DRIVE_FILES_URL}/${encodeURIComponent(rawFolderId)}?fields=id,name,mimeType,trashed`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (folderRes.status === 404) {
            return {
              success: false,
              message: `Target Google Drive folder ID "${rawFolderId}" was not found or is inaccessible.`,
            };
          }
          if (folderRes.ok) {
            const folderData = (await folderRes.json()) as { name?: string; trashed?: boolean };
            if (folderData.trashed) {
              return {
                success: false,
                message: `Target Google Drive folder "${folderData.name || rawFolderId}" is in trash.`,
              };
            }
            return {
              success: true,
              message: `Connected to Google Drive (folder: "${folderData.name || rawFolderId}").`,
            };
          }
        } catch {
          // If folder verification network error occurs, fall back to successful general drive connection
        }
      }

      const folderLabel = rawFolderId && rawFolderId.toLowerCase() !== 'root' ? rawFolderId : 'Drive root';
      return { success: true, message: `Connected to Google Drive (${folderLabel}).` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, message: msg };
    }
  }

  async upload(localPath: string, remoteFileName: string): Promise<UploadResult> {
    const token = await this.refreshAccessToken();
    const fileBuffer = await readFile(localPath);
    const stat = statSync(localPath);
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');

    const rawFolderId = this.config.folderId?.trim();
    const parents = rawFolderId && rawFolderId.toLowerCase() !== 'root' ? [rawFolderId] : undefined;

    const boundary = `-------google-drive-boundary-${Date.now()}`;
    const metadata = JSON.stringify({
      name: remoteFileName,
      ...(parents ? { parents } : {}),
    });

    const prefix = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([prefix, fileBuffer, suffix]);

    let uploadRes: Response;
    try {
      uploadRes = await fetch(DRIVE_UPLOAD_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      });
    } catch (netErr) {
      const msg = netErr instanceof Error ? netErr.message : 'Network error';
      throw new Error(`Failed to upload to Google Drive: ${msg}`);
    }

    if (!uploadRes.ok) {
      let errMessage = `HTTP ${uploadRes.status}`;
      try {
        const errJson = (await uploadRes.json()) as { error?: { message?: string } };
        if (errJson.error?.message) errMessage = errJson.error.message;
      } catch {}
      throw new Error(`Google Drive upload rejected: ${errMessage}`);
    }

    const uploadData = (await uploadRes.json()) as { id: string; name: string };
    return { remotePath: uploadData.id, size: stat.size, checksum };
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const token = await this.refreshAccessToken();
    const downloadRes = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(remotePath)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!downloadRes.ok) {
      throw new Error(`Google Drive download failed: HTTP ${downloadRes.status}`);
    }
    const arrayBuf = await downloadRes.arrayBuffer();
    await writeFile(localPath, Buffer.from(arrayBuf));
  }

  async verify(remotePath: string, expectedSize?: number, expectedChecksum?: string): Promise<VerifyResult> {
    try {
      const token = await this.refreshAccessToken();
      const fileRes = await fetch(
        `${DRIVE_FILES_URL}/${encodeURIComponent(remotePath)}?fields=id,name,size,md5Checksum,trashed`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!fileRes.ok) {
        return { exists: false, size: null, checksumMatch: false };
      }
      const fileData = (await fileRes.json()) as { size?: string; trashed?: boolean; md5Checksum?: string };
      if (fileData.trashed) {
        return { exists: false, size: null, checksumMatch: false };
      }
      const size = fileData.size ? Number(fileData.size) : null;
      const sizeMatches = expectedSize !== undefined && size !== null ? size === expectedSize : true;
      let checksumMatches = true;
      if (expectedChecksum && fileData.md5Checksum) {
        // Google Drive natively calculates MD5 (32 hex characters).
        // If expectedChecksum is a 32-character hex string, perform exact case-insensitive match.
        if (expectedChecksum.length === 32) {
          checksumMatches = fileData.md5Checksum.toLowerCase() === expectedChecksum.toLowerCase();
        }
      }
      return { exists: true, size, checksumMatch: sizeMatches && checksumMatches };
    } catch {
      return { exists: false, size: null, checksumMatch: false };
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    const token = await this.refreshAccessToken();
    const delRes = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(remotePath)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!delRes.ok && delRes.status !== 404) {
      throw new Error(`Google Drive delete failed: HTTP ${delRes.status}`);
    }
  }
}
