// ============================================================
// OneDrive Storage Provider — real Microsoft OAuth refresh-token test
// ============================================================
// Test Connection performs a REAL OAuth2 refresh-token exchange against
// Microsoft's v2.0 token endpoint, then calls /me on Microsoft Graph to
// verify the token. No fake success.

import type { StorageProvider, UploadResult, VerifyResult, OneDriveConfig } from './types';

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const ME_URL = 'https://graph.microsoft.com/v1.0/me';

export class OneDriveStorageProvider implements StorageProvider {
  readonly name = 'OneDrive';
  protected config: OneDriveConfig;

  constructor(config: OneDriveConfig) {
    this.config = config;
  }

  protected async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.config.refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/.default offline_access',
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
      const res = await fetch(ME_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return { success: false, message: 'Connection failed — Microsoft Graph rejected the token.' };
      }
      const folder = this.config.folder || '/';
      return { success: true, message: `Connected to OneDrive (${folder}).` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, message: msg };
    }
  }

  async upload(): Promise<UploadResult> {
    throw new Error(
      'OneDrive upload is not implemented in this build. Configure a working destination (Local/S3/R2/FTP) to run backups.',
    );
  }

  async download(): Promise<void> {
    throw new Error('OneDrive download is not implemented in this build.');
  }

  async verify(): Promise<VerifyResult> {
    return { exists: false, size: null, checksumMatch: false };
  }

  async deleteFile(): Promise<void> {
    throw new Error('OneDrive delete is not implemented in this build.');
  }
}
