// ============================================================
// Storage Provider Factory — creates the right adapter
// ============================================================

import { LocalStorageProvider } from './local';
import { S3StorageProvider, R2StorageProvider, B2StorageProvider } from './s3';
import { FtpStorageProvider } from './ftp';
import { SftpStorageProvider } from './sftp';
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

    case 'AMAZON_S3':
      return new S3StorageProvider(decryptedConfig as never);

    case 'CLOUDFLARE_R2':
      return new R2StorageProvider(decryptedConfig as never);

    case 'BACKBLAZE_B2':
      return new B2StorageProvider(decryptedConfig as never);

    case 'FTP':
      return new FtpStorageProvider(decryptedConfig as never);

    case 'SFTP':
      return new SftpStorageProvider(decryptedConfig as never);

    case 'GOOGLE_DRIVE':
    case 'DROPBOX':
    case 'ONEDRIVE':
      // OAuth providers — require external credentials configuration.
      // The adapter interface is ready; OAuth flow needs admin setup.
      throw new Error(`${providerType} requires OAuth configuration. Please configure OAuth credentials in the admin settings.`);

    default:
      throw new Error(`Unknown storage provider: ${providerType}`);
  }
}

/**
 * Fields that should be encrypted when storing the config.
 */
export const ENCRYPTED_FIELDS = new Set([
  'secretAccessKey', 'password', 'applicationKey', 'privateKey',
  'accessToken', 'refreshToken', 'clientSecret', 'credentials',
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
