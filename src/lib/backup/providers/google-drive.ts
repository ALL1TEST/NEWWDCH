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

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name = 'Google Drive';
  protected config: GoogleDriveConfig;

  constructor(config: GoogleDriveConfig) {
    this.config = config;
  }

  /** Exchange the refresh token for an access token. Returns the access
   *  token on success, throws on failure. Used by testConnection (and a
   *  future upload implementation). */
  protected async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.config.refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      let detail = '';
      try {
        const j = (await res.json()) as { error?: string; error_description?: string };
        detail = j.error_description || j.error || '';
      } catch { /* ignore */ }
      throw new Error(detail ? `Invalid refresh token: ${detail}` : 'Invalid refresh token');
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('No access token returned');
    return data.access_token;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.refreshAccessToken();
      // Ping the Drive API — list 1 file to confirm the token + scopes work.
      const res = await fetch(`${DRIVE_FILES_URL}?pageSize=1&fields=files(id)`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return { success: false, message: 'Connection failed — Drive API rejected the token.' };
      }
      const folder = this.config.folderId && this.config.folderId !== 'root'
        ? this.config.folderId
        : 'Drive root';
      return { success: true, message: `Connected to Google Drive (${folder}).` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, message: msg };
    }
  }

  async upload(): Promise<UploadResult> {
    throw new Error(
      'Google Drive upload is not implemented in this build. Configure a working destination (Local/S3/R2/FTP) to run backups.',
    );
  }

  async download(): Promise<void> {
    throw new Error('Google Drive download is not implemented in this build.');
  }

  async verify(): Promise<VerifyResult> {
    return { exists: false, size: null, checksumMatch: false };
  }

  async deleteFile(): Promise<void> {
    throw new Error('Google Drive delete is not implemented in this build.');
  }
}
