// ============================================================
// Storage Provider Factory — creates the right adapter
// ============================================================
// Maps a BackupStorageProvider enum to a concrete adapter. Adding a
// new provider means: (1) add a config interface to ./types.ts,
// (2) add an adapter module, (3) add a factory branch here. The
// Add Storage UI renders generically from the client-side provider
// registry (src/lib/backup/provider-registry.tsx) and never needs
// changes for a new provider.

import { LocalStorageProvider } from './local';
import { S3StorageProvider, R2StorageProvider, WasabiStorageProvider, B2StorageProvider } from './s3';
import { FtpStorageProvider } from './ftp';
import { GoogleDriveStorageProvider } from './google-drive';
import { DropboxStorageProvider } from './dropbox';
import { OneDriveStorageProvider } from './onedrive';
import type { StorageProvider } from './types';
import { encrypt, decrypt } from '@/lib/encryption';

export type { StorageProvider } from './types';

/** Providers whose integration is NOT implemented yet. The UI shows
 *  their fields (preview) but marks them "Coming soon" and the API
 *  rejects creating one with a clear message. Test Connection is
 *  disabled for these. Google Cloud Storage and Azure Blob require
 *  their native SDKs + service-account flows; flagged here rather
 *  than faked. */
export const COMING_SOON_PROVIDERS = new Set<string>([
  'GOOGLE_CLOUD_STORAGE',
  'MICROSOFT_AZURE_BLOB',
]);

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

    case 'AMAZON_S3':
      return new S3StorageProvider(decryptedConfig as never, 'Amazon S3');

    case 'CLOUDFLARE_R2':
      return new R2StorageProvider(decryptedConfig as never);

    case 'WASABI':
      return new WasabiStorageProvider(decryptedConfig as never);

    case 'BACKBLAZE_B2':
      return new B2StorageProvider(decryptedConfig as never);

    case 'FTP':
      return new FtpStorageProvider(decryptedConfig as never);

    case 'GOOGLE_DRIVE':
      return new GoogleDriveStorageProvider(decryptedConfig as never);

    case 'DROPBOX':
      return new DropboxStorageProvider(decryptedConfig as never);

    case 'ONEDRIVE':
      return new OneDriveStorageProvider(decryptedConfig as never);

    default:
      throw new Error(`Unknown storage provider: ${providerType}`);
  }
}

/**
 * Fields that should be encrypted when storing the config. Covers every
 * supported provider's secret fields. Secrets are encrypted at rest and
 * masked ('••••••••') in API responses — never surfaced as plain text.
 */
export const ENCRYPTED_FIELDS = new Set([
  'secretAccessKey',   // Amazon S3 / Cloudflare R2 / Wasabi
  'applicationKey',    // Backblaze B2
  'privateKey',        // Google Cloud Storage (forward-compat)
  'accessKey',         // Microsoft Azure Blob (forward-compat)
  'password',          // FTP
  'clientSecret',      // Google Drive / OneDrive
  'appSecret',         // Dropbox
  'refreshToken',      // Google Drive / Dropbox / OneDrive
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
