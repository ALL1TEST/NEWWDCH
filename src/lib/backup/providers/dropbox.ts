// ============================================================
// Dropbox Storage Provider — real OAuth refresh-token test
// ============================================================
// Test Connection performs a REAL OAuth2 refresh-token exchange against
// Dropbox's token endpoint, then calls check/user to verify the token.
// No fake success.

import type { StorageProvider, UploadResult, VerifyResult, DropboxConfig } from './types';

const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const CHECK_URL = 'https://api.dropboxapi.com/2/check/user';

export class DropboxStorageProvider implements StorageProvider {
  readonly name = 'Dropbox';
  protected config: DropboxConfig;

  constructor(config: DropboxConfig) {
    this.config = config;
  }

  protected async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      refresh_token: this.config.refreshToken,
      grant_type: 'refresh_token',
      client_id: this.config.appKey,
      client_secret: this.config.appSecret,
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
      const res = await fetch(CHECK_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        return { success: false, message: 'Connection failed — Dropbox API rejected the token.' };
      }
      const folder = this.config.folder || '/';
      return { success: true, message: `Connected to Dropbox (${folder}).` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, message: msg };
    }
  }

  async upload(): Promise<UploadResult> {
    throw new Error(
      'Dropbox upload is not implemented in this build. Configure a working destination (Local/S3/R2/FTP) to run backups.',
    );
  }

  async download(): Promise<void> {
    throw new Error('Dropbox download is not implemented in this build.');
  }

  async verify(): Promise<VerifyResult> {
    return { exists: false, size: null, checksumMatch: false };
  }

  async deleteFile(): Promise<void> {
    throw new Error('Dropbox delete is not implemented in this build.');
  }
}
