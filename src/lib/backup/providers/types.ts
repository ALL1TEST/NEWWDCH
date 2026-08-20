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

// Configuration types for each provider
export interface LocalConfig {
  path?: string; // optional custom storage path
}

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // for R2, B2, or custom S3-compatible
  forcePathStyle?: boolean;
}

export interface B2Config {
  bucket: string;
  keyId: string;
  applicationKey: string;
  endpoint?: string;
}

export interface FtpConfig {
  host: string;
  port?: number;
  username: string;
  password: string;
  remotePath?: string;
  secure?: boolean;
}

export interface SftpConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath?: string;
}

export interface OAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  folderId?: string;
  // For providers that need client credentials
  clientId?: string;
  clientSecret?: string;
}
