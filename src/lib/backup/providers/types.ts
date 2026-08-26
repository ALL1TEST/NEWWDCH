// ============================================================
// Storage Provider Adapter Interface
// ============================================================
// Every storage provider implements this interface so the backup
// service can test/upload/download/verify/delete without knowing the
// specific provider implementation. The factory in index.ts maps a
// provider enum to a concrete adapter; adding a new provider means
// adding a new adapter + a new factory branch — no changes to the
// Add Storage UI (which renders generically from the client-side
// provider registry in src/lib/backup/provider-registry.tsx).

export interface UploadResult {
  remotePath: string;
  size: number;
  checksum?: string;
}

export interface VerifyResult {
  exists: boolean;
  size: number | null;
  checksumMatch: boolean;
}

export interface StorageProvider {
  /** Human-readable provider name */
  readonly name: string;

  /** Test that the connection configuration is valid and reachable.
   *  MUST perform a real round-trip against the storage (no fake success).
   *  Returns a clean, user-facing message (no stack traces). */
  testConnection(): Promise<{ success: boolean; message: string }>;

  /** Upload a local file to the storage destination */
  upload(localPath: string, remoteFileName: string): Promise<UploadResult>;

  /** Download a file from the storage destination to a local path */
  download(remotePath: string, localPath: string): Promise<void>;

  /** Verify that a file exists at the given remote path with correct size/checksum */
  verify(remotePath: string, expectedSize?: number, expectedChecksum?: string): Promise<VerifyResult>;

  /** Delete a file from the storage destination */
  deleteFile(remotePath: string): Promise<void>;
}

// ------------------------------------------------------------
// Per-provider config types. The field KEYS here MUST stay in sync
// with the client-side provider registry field definitions and the
// server-side validateConfigJson in the storage API routes.
// ------------------------------------------------------------

export interface LocalConfig {
  path?: string; // optional custom storage path
}

/** S3-compatible config. Used by Amazon S3, Cloudflare R2, Wasabi, Backblaze B2. */
export interface S3Config {
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // for R2 / custom S3-compatible endpoints
  accountId?: string; // Cloudflare R2 account ID (used to derive the endpoint)
  forcePathStyle?: boolean;
}

export interface FtpConfig {
  host: string;
  port?: number;
  username: string;
  password: string;
  remotePath?: string;
  secure?: boolean;
}

// ---- OAuth cloud-drive configs ----

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId?: string; // 'root' or a folder ID
}

export interface DropboxConfig {
  appKey: string;
  appSecret: string;
  refreshToken: string;
  folder?: string; // path, e.g. /Backups
}

export interface OneDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folder?: string; // path, e.g. /Backups
}

// ---- Coming-soon providers (field types declared for forward
//      compatibility; not yet wired into the factory). ----

export interface GoogleCloudStorageConfig {
  projectId: string;
  serviceAccountEmail: string;
  privateKey: string;
  bucket: string;
  folder?: string;
}

export interface AzureBlobConfig {
  storageAccount: string;
  accessKey: string;
  container: string;
  endpoint?: string;
}
