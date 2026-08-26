// ============================================================
// Storage Provider Adapter Interface
// ============================================================
// Every storage provider implements this interface so the backup
// service can upload/download/verify/delete without knowing the
// specific provider implementation.

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

  /** Test that the connection configuration is valid and reachable */
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

// Configuration types for each provider supported by this CMS build.
// Removed providers (Amazon S3, Backblaze B2, SFTP) intentionally have no
// config type here — they cannot be constructed via the factory.

export interface LocalConfig {
  path?: string; // optional custom storage path
}

export interface S3Config {
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // for R2 or custom S3-compatible
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

export interface OAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  folderId?: string;
  folder?: string;
  // For providers that need client credentials
  clientId?: string;
  clientSecret?: string;
  appKey?: string;
  appSecret?: string;
}
