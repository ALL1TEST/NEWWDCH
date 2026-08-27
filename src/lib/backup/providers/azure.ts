// ============================================================
// Microsoft Azure Blob Storage Provider — real SharedKey test
// ============================================================
// Test Connection performs a REAL Azure Storage SharedKey HMAC
// authentication: builds the canonical request, signs it with the
// base64-decoded access key via HMAC-SHA256, then calls the Get
// Container Properties API. No fake success — if the account name
// or access key is wrong, or the container is unreachable, the
// test fails honestly.

import { createHmac } from 'node:crypto';
import type { StorageProvider, UploadResult, VerifyResult, AzureBlobConfig } from './types';

const API_VERSION = '2020-10-02';

export class AzureBlobStorageProvider implements StorageProvider {
  readonly name = 'Microsoft Azure Blob Storage';
  protected config: AzureBlobConfig;

  constructor(config: AzureBlobConfig) {
    this.config = config;
  }

  /** The account default endpoint. The user may override via the
   *  optional `endpoint` field; otherwise derive it from the account. */
  protected get endpoint(): string {
    if (this.config.endpoint && this.config.endpoint.trim() !== '') {
      return this.config.endpoint.replace(/\/$/, '');
    }
    return `https://${this.config.storageAccount}.blob.core.windows.net`;
  }

  /** Sign a canonical string with the base64-decoded access key using
   *  HMAC-SHA256, returning the base64-encoded signature. */
  protected signCanonicalString(canonical: string): string {
    const key = Buffer.from(this.config.accessKey, 'base64');
    const hmac = createHmac('sha256', key).update(canonical, 'utf8').digest('base64');
    return hmac;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Get Container Properties — a HEAD-style request against the
      // container resource. We use a GET with restype=container which
      // returns the container's properties (and a 200/404).
      const url = `${this.endpoint}/${this.config.container}?restype=container`;
      const date = new Date().toUTCString();

      // Build the canonical resource string:
      //   /{accountName}/{container}\nrestype:container
      const canonicalResource = `/${this.config.storageAccount}/${this.config.container}\nrestype:container`;
      // Build the canonical headers (x-ms-* in lowercase, lexicographic
      // order by header name). Only x-ms-version + x-ms-date here.
      const canonicalHeaders = `x-ms-date:${date}\nx-ms-version:${API_VERSION}\n`;

      const stringToSign = [
        'GET',
        '',     // Content-Encoding
        '',     // Content-Language
        '',     // Content-Length (empty for GET)
        '',     // Content-MD5
        '',     // Content-Type
        '',     // Date (use x-ms-date instead)
        '',     // If-Modified-Since
        '',     // If-Match
        '',     // If-None-Match
        '',     // If-Unmodified-Since
        '',     // Range
        canonicalHeaders,
        canonicalResource,
      ].join('\n');

      const signature = this.signCanonicalString(stringToSign);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `SharedKey ${this.config.storageAccount}:${signature}`,
          'x-ms-date': date,
          'x-ms-version': API_VERSION,
        },
      });
      if (res.ok) {
        return { success: true, message: `Connected to Azure Blob Storage (${this.config.container}).` };
      }
      if (res.status === 404) {
        return { success: false, message: 'Connection failed — container not found or access denied.' };
      }
      return { success: false, message: 'Connection failed — invalid credentials or unreachable storage.' };
    } catch (err) {
      // Always surface a clean, non-empty user-facing message — never
      // a crypto/OpenSSL stack trace.
      const raw = err instanceof Error ? err.message : '';
      const looksTechnical = /error:[0-9A-F]+|DECODER|routines|PEM|ASN\.1|crypto\.|node:internal|OpenSSL|unsupported/i.test(raw);
      const message = raw && !looksTechnical
        ? raw
        : 'Connection failed — invalid storage account or access key.';
      return { success: false, message };
    }
  }

  async upload(): Promise<UploadResult> {
    throw new Error(
      'Azure Blob Storage upload is not implemented in this build. Configure a working destination (Local/S3/R2/FTP) to run backups.',
    );
  }

  async download(): Promise<void> {
    throw new Error('Azure Blob Storage download is not implemented in this build.');
  }

  async verify(): Promise<VerifyResult> {
    return { exists: false, size: null, checksumMatch: false };
  }

  async deleteFile(): Promise<void> {
    throw new Error('Azure Blob Storage delete is not implemented in this build.');
  }
}
