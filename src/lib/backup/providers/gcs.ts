// ============================================================
// Google Cloud Storage Provider — real service-account JWT test
// ============================================================
// Test Connection performs a REAL OAuth2 service-account JWT
// exchange: signs an RS256 assertion with the RSA private key,
// exchanges it for an access token at Google's token endpoint,
// then pings the GCS bucket metadata API. No fake success — if
// the private key is invalid, the service account lacks storage
// scope, or the bucket is unreachable, the test fails honestly.

import { createSign } from 'node:crypto';
import type { StorageProvider, UploadResult, VerifyResult, GoogleCloudStorageConfig } from './types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const STORAGE_API = 'https://storage.googleapis.com/storage/v1';
const SCOPE = 'https://www.googleapis.com/auth/devstorage.read_only';

/** Normalize a pasted service-account private key. GCS JSON key
 *  files ship the key with literal "\n" sequences and PEM framing;
 *  users often paste it verbatim. This restores real newlines and
 *  guarantees PEM framing so Node's signer accepts it. */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  // Restore escaped newlines into real ones.
  key = key.replace(/\\n/g, '\n').replace(/\\r/g, '');
  // Strip any surrounding quotes.
  key = key.replace(/^"([\s\S]*)"$/, '$1');
  // Ensure PEM framing.
  if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }
  return key;
}

function base64UrlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

export class GoogleCloudStorageProvider implements StorageProvider {
  readonly name = 'Google Cloud Storage';
  protected config: GoogleCloudStorageConfig;

  constructor(config: GoogleCloudStorageConfig) {
    this.config = config;
  }

  /** Build + sign the service-account JWT assertion. Returns the
   *  signed JWT string (header.payload.signature). Throws if the
   *  private key is invalid or unusable. */
  protected async buildAssertion(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: this.config.serviceAccountEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    };
    const encHeader = base64UrlEncode(JSON.stringify(header));
    const encPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encHeader}.${encPayload}`;
    const pem = normalizePrivateKey(this.config.privateKey);
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput, 'utf8');
    signer.end();
    const signature = signer.sign(pem);
    return `${signingInput}.${base64UrlEncode(signature)}`;
  }

  /** Exchange the signed JWT for a Google OAuth2 access token. */
  protected async getAccessToken(): Promise<string> {
    const assertion = await this.buildAssertion();
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
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
      throw new Error(detail ? `Invalid service account: ${detail}` : 'Invalid service account credentials');
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('No access token returned');
    return data.access_token;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.getAccessToken();
      // Fetch the bucket metadata — confirms the token + the service
      // account can read the target bucket within the project.
      const url = `${STORAGE_API}/b/${encodeURIComponent(this.config.bucket)}?project=${encodeURIComponent(this.config.projectId)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return { success: false, message: 'Connection failed — bucket not reachable or access denied.' };
      }
      return { success: true, message: `Connected to Google Cloud Storage (${this.config.bucket}).` };
    } catch (err) {
      // Surface a clean, non-empty message. Signing/crypto errors carry
      // terse OpenSSL strings like "error:1E08010C:DECODER routines…";
      // never expose those — fall back to a clear user-facing message.
      const raw = err instanceof Error ? err.message : '';
      const looksTechnical = /error:[0-9A-F]+|DECODER|routines|PEM|ASN\.1|crypto\.|node:internal|OpenSSL|unsupported/i.test(raw);
      const message = raw && !looksTechnical
        ? raw
        : 'Connection failed — invalid service account credentials or unreachable bucket.';
      return { success: false, message };
    }
  }

  async upload(): Promise<UploadResult> {
    throw new Error(
      'Google Cloud Storage upload is not implemented in this build. Configure a working destination (Local/S3/R2/FTP) to run backups.',
    );
  }

  async download(): Promise<void> {
    throw new Error('Google Cloud Storage download is not implemented in this build.');
  }

  async verify(): Promise<VerifyResult> {
    return { exists: false, size: null, checksumMatch: false };
  }

  async deleteFile(): Promise<void> {
    throw new Error('Google Cloud Storage delete is not implemented in this build.');
  }
}
