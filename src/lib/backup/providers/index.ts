// ============================================================
// Storage Provider Factory — creates the right adapter
// ============================================================

import { LocalStorageProvider } from './local';
import { S3StorageProvider, R2StorageProvider } from './s3';
import { FtpStorageProvider } from './ftp';
import type { StorageProvider } from './types';
import { encrypt, decrypt } from '@/lib/encryption';

export type { StorageProvider } from './types';

/**
 * Create a storage provider adapter from a BackupStorage record.
 * The config JSON is decrypted (credentials) before being passed to the adapter.
 */
export async function createStorageProvider(
  providerType: string,
  configJson: string,
): Promise<StorageProvider> {
  // Parse the config
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(configJson || '{}');
  } catch {
    config = {};
  }

  // Decrypt encrypted credential fields
  const decryptedConfig = await decryptConfigFields(config);

  switch (providerType) {
    case 'LOCAL':
      return new LocalStorageProvider(decryptedConfig as never);

    case 'CLOUDFLARE_R2':
      return new R2StorageProvider(decryptedConfig as never);

    case 'FTP':
      return new FtpStorageProvider(decryptedConfig as never);

    case 'GOOGLE_DRIVE':
    case 'DROPBOX':
    case 'ONEDRIVE':
      // OAuth providers — the connection/config (client ID, client secret,
      // refresh token, destination folder) is stored by the create flow,
      // and the row-level Test Connection reports it as configured. The
      // actual OAuth refresh + upload against the provider's API is an
      // integration point for a production deployment (registering the
      // OAuth app, exposing the callback URL). Until that integration is
      // wired in, attempting to run a backup against an OAuth provider
      // fails fast with a clear, actionable error.
      throw new Error(`${providerType} requires an OAuth integration. Configure the OAuth client credentials in the storage destination, then wire the provider callback URL in production.`);

    default:
      throw new Error(`Unknown storage provider: ${providerType}`);
  }
}

/**
 * Fields that should be encrypted when storing the config. Restricted to
 * the providers supported by this CMS build (Local, Google Drive, Dropbox,
 * OneDrive, Cloudflare R2, FTP). Removed providers (Amazon S3, Backblaze B2,
 * SFTP) are intentionally absent so their secret keys can never be written
 * or surfaced by this code path.
 */
export const ENCRYPTED_FIELDS = new Set([
  'secretAccessKey', // Cloudflare R2
  'password',         // FTP
  'clientSecret',     // Google Drive / OneDrive
  'appSecret',         // Dropbox
  'refreshToken',     // Google Drive / Dropbox / OneDrive
]);

/**
 * Encrypt sensitive fields in a config object before storing.
 * Returns a JSON string with sensitive fields encrypted.
 */
export async function encryptConfigForStorage(config: Record<string, unknown>): Promise<string> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (ENCRYPTED_FIELDS.has(key) && typeof value === 'string' && value.length > 0) {
      result[key] = await encrypt(value);
    } else {
      result[key] = value;
    }
  }
  return JSON.stringify(result);
}

/**
 * Decrypt sensitive fields in a config object for use.
 */
export async function decryptConfigFields(config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (ENCRYPTED_FIELDS.has(key) && typeof value === 'string' && value.length > 0) {
      try {
        result[key] = await decrypt(value);
      } catch {
        // If decryption fails, use the raw value (might be plain text in dev)
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Mask sensitive fields for API responses (never expose secrets).
 */
export function maskConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (ENCRYPTED_FIELDS.has(key)) {
      result[key] = typeof value === 'string' && value.length > 0 ? '••••••••' : value;
    } else {
      result[key] = value;
    }
  }
  return result;
}
