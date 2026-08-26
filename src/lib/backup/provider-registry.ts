// ============================================================
// Provider Registry — single source of truth for storage providers
// ============================================================
// The Add Storage component renders generically from this registry:
// it does NOT contain any provider-specific hardcoded UI logic.
// Adding a future provider only requires adding a definition here
// (+ a backend adapter + API validation branch). The form, dropdown,
// field rendering, and validation all derive from the definition.
//
// Each definition carries: id, name, category, connectionType,
// actionLabel, requiresConnection, enabled, and a `fields` array.
// The field KEYS here MUST stay in sync with the server-side
// validateConfigJson in /api/backups/storage/route.ts and the
// ENCRYPTED_FIELDS set in src/lib/backup/providers/index.ts.
//
// There is no "coming soon" concept. Every provider in this registry
// is `enabled: true` and treated as a real, selectable provider with
// a working form, real validation, and a real Test Connection.

import type { BackupStorageProvider } from '@/shared/types';

// -------------------- Types --------------------

export type ProviderCategory = 'LOCAL' | 'OBJECT_STORAGE' | 'CLOUD_DRIVE' | 'FILE_TRANSFER';

export type FieldGroup = 'connection' | 'credentials' | 'destination';

export type FieldType = 'text' | 'password' | 'number' | 'switch';

export interface ProviderField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  /** Short helper text — only when genuinely necessary. Kept minimal. */
  helpText?: string;
  multiline?: boolean;
  default?: string | boolean;
  group: FieldGroup;
}

export interface ProviderDefinition {
  id: BackupStorageProvider;
  name: string;
  category: ProviderCategory;
  /** 'none' = no test step (Local). 'credentials' = Test Connection
   *  validates the whole credential block (S3/R2/Wasabi/B2/GCS/Azure/FTP).
   *  'oauth' = Connect button runs a real token-refresh test, then a
   *  destination (folder) field is revealed. */
  connectionType: 'none' | 'credentials' | 'oauth';
  actionLabel: string;
  /** Whether Create requires a validated (connected) state. */
  requiresConnection: boolean;
  /** Only providers with enabled: true appear in the dropdown. Every
   *  provider in the dropdown is a real, selectable provider — there
   *  are no "soon"/"preview"/placeholder states. */
  enabled: boolean;
  fields: ProviderField[];
}

// -------------------- Category metadata --------------------

export const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  LOCAL: 'Local',
  OBJECT_STORAGE: 'Object Storage',
  CLOUD_DRIVE: 'Cloud Drive',
  FILE_TRANSFER: 'File Transfer',
};

/** Display order for categories in the dropdown. */
export const CATEGORY_ORDER: ProviderCategory[] = [
  'LOCAL',
  'OBJECT_STORAGE',
  'CLOUD_DRIVE',
  'FILE_TRANSFER',
];

// -------------------- Provider definitions --------------------
//
// Field placeholders are concise examples (per the design spec) —
// NOT long explanatory paragraphs. Help text is omitted unless a
// field genuinely needs one short line.

export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  // ---------- LOCAL ----------
  {
    id: 'LOCAL',
    name: 'Local',
    category: 'LOCAL',
    connectionType: 'none',
    actionLabel: 'Test Path',
    requiresConnection: false,
    enabled: true,
    fields: [
      {
        key: 'path',
        label: 'Path',
        type: 'text',
        required: false,
        placeholder: '/var/backups',
        group: 'destination',
      },
    ],
  },

  // ---------- OBJECT STORAGE ----------
  {
    id: 'AMAZON_S3',
    name: 'Amazon S3',
    category: 'OBJECT_STORAGE',
    connectionType: 'credentials',
    actionLabel: 'Test Connection',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true, placeholder: 'AKIA...', group: 'credentials' },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true, group: 'credentials' },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true, placeholder: 'my-backups', group: 'credentials' },
      { key: 'region', label: 'Region', type: 'text', required: true, placeholder: 'eu-west-1', group: 'credentials' },
      { key: 'endpoint', label: 'Endpoint', type: 'text', required: false, placeholder: 'https://s3.eu-west-1.amazonaws.com', group: 'credentials' },
    ],
  },

  {
    id: 'GOOGLE_CLOUD_STORAGE',
    name: 'Google Cloud Storage',
    category: 'OBJECT_STORAGE',
    connectionType: 'credentials',
    actionLabel: 'Test Connection',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'projectId', label: 'Project ID', type: 'text', required: true, placeholder: 'my-project-123', group: 'credentials' },
      { key: 'serviceAccountEmail', label: 'Service Account Email', type: 'text', required: true, placeholder: 'backup@my-project.iam.gserviceaccount.com', group: 'credentials' },
      { key: 'privateKey', label: 'Private Key', type: 'password', required: true, multiline: true, placeholder: '-----BEGIN PRIVATE KEY-----\nMIIEvQIB...', group: 'credentials' },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true, placeholder: 'my-backups', group: 'credentials' },
      { key: 'folder', label: 'Folder', type: 'text', required: false, placeholder: 'backups/', group: 'destination' },
    ],
  },

  {
    id: 'MICROSOFT_AZURE_BLOB',
    name: 'Microsoft Azure Blob Storage',
    category: 'OBJECT_STORAGE',
    connectionType: 'credentials',
    actionLabel: 'Test Connection',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'storageAccount', label: 'Storage Account', type: 'text', required: true, placeholder: 'mystorageaccount', group: 'credentials' },
      { key: 'accessKey', label: 'Access Key', type: 'password', required: true, multiline: true, placeholder: 'base64-encoded key', group: 'credentials' },
      { key: 'container', label: 'Container', type: 'text', required: true, placeholder: 'backups', group: 'credentials' },
      { key: 'endpoint', label: 'Endpoint', type: 'text', required: false, placeholder: 'https://mystorageaccount.blob.core.windows.net', group: 'credentials' },
    ],
  },

  {
    id: 'CLOUDFLARE_R2',
    name: 'Cloudflare R2',
    category: 'OBJECT_STORAGE',
    connectionType: 'credentials',
    actionLabel: 'Test Connection',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'accountId', label: 'Account ID', type: 'text', required: true, placeholder: 'your-account-id', group: 'credentials' },
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true, placeholder: 'access-key-id', group: 'credentials' },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true, group: 'credentials' },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true, placeholder: 'my-backups', group: 'credentials' },
      { key: 'endpoint', label: 'Endpoint', type: 'text', required: false, placeholder: 'https://accountid.r2.cloudflarestorage.com', group: 'credentials' },
    ],
  },

  {
    id: 'WASABI',
    name: 'Wasabi',
    category: 'OBJECT_STORAGE',
    connectionType: 'credentials',
    actionLabel: 'Test Connection',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true, placeholder: 'access-key-id', group: 'credentials' },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true, group: 'credentials' },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true, placeholder: 'my-backups', group: 'credentials' },
      { key: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1', group: 'credentials' },
      { key: 'endpoint', label: 'Endpoint', type: 'text', required: false, placeholder: 'https://s3.us-east-1.wasabisys.com', group: 'credentials' },
    ],
  },

  {
    id: 'BACKBLAZE_B2',
    name: 'Backblaze B2',
    category: 'OBJECT_STORAGE',
    connectionType: 'credentials',
    actionLabel: 'Test Connection',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'keyId', label: 'Key ID', type: 'text', required: true, placeholder: 'key-id', group: 'credentials' },
      { key: 'applicationKey', label: 'Application Key', type: 'password', required: true, group: 'credentials' },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true, placeholder: 'my-backups', group: 'credentials' },
      { key: 'endpoint', label: 'Endpoint', type: 'text', required: false, placeholder: 'https://s3.us-west-002.backblazeb2.com', group: 'credentials' },
    ],
  },

  // ---------- CLOUD DRIVE ----------
  {
    id: 'GOOGLE_DRIVE',
    name: 'Google Drive',
    category: 'CLOUD_DRIVE',
    connectionType: 'oauth',
    actionLabel: 'Connect Google Drive',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: '123456789.apps.googleusercontent.com', group: 'connection' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, group: 'connection' },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true, placeholder: '1//xxxxxxxx', group: 'connection' },
      { key: 'folderId', label: 'Folder', type: 'text', required: true, placeholder: 'root or folder ID', group: 'destination' },
    ],
  },

  {
    id: 'DROPBOX',
    name: 'Dropbox',
    category: 'CLOUD_DRIVE',
    connectionType: 'oauth',
    actionLabel: 'Connect Dropbox',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'appKey', label: 'App Key', type: 'text', required: true, placeholder: 'xxxxxxxxxx', group: 'connection' },
      { key: 'appSecret', label: 'App Secret', type: 'password', required: true, group: 'connection' },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true, placeholder: 'xxxxxxxxxxxxxxxx', group: 'connection' },
      { key: 'folder', label: 'Folder', type: 'text', required: true, placeholder: '/Backups', group: 'destination' },
    ],
  },

  {
    id: 'ONEDRIVE',
    name: 'OneDrive',
    category: 'CLOUD_DRIVE',
    connectionType: 'oauth',
    actionLabel: 'Connect OneDrive',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', group: 'connection' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, group: 'connection' },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true, placeholder: 'xxxxxxxxxxxxxxxx', group: 'connection' },
      { key: 'folder', label: 'Folder', type: 'text', required: true, placeholder: '/Backups', group: 'destination' },
    ],
  },

  // ---------- FILE TRANSFER ----------
  {
    id: 'FTP',
    name: 'FTP',
    category: 'FILE_TRANSFER',
    connectionType: 'credentials',
    actionLabel: 'Test Connection',
    requiresConnection: true,
    enabled: true,
    fields: [
      { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'ftp.example.com', group: 'credentials' },
      { key: 'port', label: 'Port', type: 'number', required: false, placeholder: '21', default: '21', group: 'credentials' },
      { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'user', group: 'credentials' },
      { key: 'password', label: 'Password', type: 'password', required: true, group: 'credentials' },
      { key: 'remoteDirectory', label: 'Remote Directory', type: 'text', required: false, placeholder: '/backups', group: 'credentials' },
      { key: 'secure', label: 'Secure FTP / FTPS', type: 'switch', required: false, default: false, group: 'credentials' },
    ],
  },
];

// -------------------- Helpers --------------------

const PROVIDER_MAP: Record<string, ProviderDefinition> = Object.fromEntries(
  PROVIDER_REGISTRY.map((p) => [p.id, p]),
);

export function getProviderDefinition(id: BackupStorageProvider | string): ProviderDefinition | undefined {
  return PROVIDER_MAP[id];
}

export function getProviderName(id: BackupStorageProvider | string): string {
  return PROVIDER_MAP[id]?.name ?? id;
}

/** Returns the registry grouped by category, in display order.
 *  Only enabled providers are included. */
export function getProvidersByCategory(): { category: ProviderCategory; label: string; providers: ProviderDefinition[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    providers: PROVIDER_REGISTRY.filter((p) => p.category === category && p.enabled),
  }));
}
