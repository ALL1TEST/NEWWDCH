// ============================================================
// S3-Compatible Storage Provider — base + Cloudflare R2
// ============================================================
// Amazon S3 and Backblaze B2 were removed from this CMS build. The base
// S3StorageProvider class is retained because Cloudflare R2 is
// S3-compatible and reuses it. The factory only constructs R2 (via
// R2StorageProvider), never the bare S3StorageProvider.

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { StorageProvider, UploadResult, VerifyResult, S3Config } from './types';

export class S3StorageProvider implements StorageProvider {
  readonly name: string;
  protected client: S3Client;
  protected bucket: string;
  protected keyPrefix: string;

  constructor(config: S3Config, name = 'S3') {
    this.name = name;
    this.bucket = config.bucket;
    this.keyPrefix = 'backups/';
    this.client = new S3Client({
      region: config.region || 'auto',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      ...(config.forcePathStyle ? { forcePathStyle: true } : {}),
    });
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Use HeadBucket (via a lightweight put+delete test or list)
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const cmd = new ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1 });
      await this.client.send(cmd);
      return { success: true, message: `Connected to ${this.name} bucket: ${this.bucket}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `${this.name} connection failed: ${msg}` };
    }
  }

  async upload(localPath: string, remoteFileName: string): Promise<UploadResult> {
    const key = this.keyPrefix + remoteFileName;
    const body = await readFile(localPath);
    const stat = await import('node:fs').then(fs => fs.statSync(localPath));
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body }));
    const checksum = createHash('sha256').update(body).digest('hex');
    return { remotePath: key, size: stat.size, checksum };
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const key = remotePath.startsWith('backups/') ? remotePath : this.keyPrefix + remotePath;
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) throw new Error('Empty response body from S3');
    const bytes = await response.Body.transformToByteArray();
    await writeFile(localPath, Buffer.from(bytes));
  }

  async verify(remotePath: string, expectedSize?: number, expectedChecksum?: string): Promise<VerifyResult> {
    const key = remotePath.startsWith('backups/') ? remotePath : this.keyPrefix + remotePath;
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      const size = head.ContentLength ?? null;
      // S3 doesn't return SHA-256 via HeadObject; if checksum is needed, download and hash
      let checksumMatch = true;
      if (expectedChecksum) {
        const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        if (response.Body) {
          const bytes = await response.Body.transformToByteArray();
          const actualChecksum = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
          checksumMatch = actualChecksum === expectedChecksum;
        }
      }
      const sizeMatch = expectedSize ? size === expectedSize : true;
      return { exists: true, size, checksumMatch: checksumMatch && sizeMatch };
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'NotFound' || name === 'NoSuchKey') {
        return { exists: false, size: null, checksumMatch: false };
      }
      throw err;
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    const key = remotePath.startsWith('backups/') ? remotePath : this.keyPrefix + remotePath;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

// Cloudflare R2 is S3-compatible. The R2 config carries an `accountId`
// (from the form); if the user didn't supply an explicit endpoint, derive
// it from the account ID so the S3 client targets R2's API host rather
// than the default AWS endpoint.
export class R2StorageProvider extends S3StorageProvider {
  constructor(config: S3Config & { accountId?: string }) {
    const endpoint =
      config.endpoint && config.endpoint.trim() !== ''
        ? config.endpoint
        : config.accountId
          ? `https://${config.accountId}.r2.cloudflarestorage.com`
          : undefined;
    super(
      {
        ...config,
        ...(endpoint ? { endpoint } : {}),
        forcePathStyle: true,
      },
      'Cloudflare R2',
    );
  }
}
