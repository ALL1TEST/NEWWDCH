// ============================================================
// S3-Compatible Storage Provider — Amazon S3, Cloudflare R2, Backblaze B2
// ============================================================

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

// Cloudflare R2 is S3-compatible
export class R2StorageProvider extends S3StorageProvider {
  constructor(config: S3Config) {
    super({ ...config, forcePathStyle: true }, 'Cloudflare R2');
  }
}

// Backblaze B2 is S3-compatible
export class B2StorageProvider extends S3StorageProvider {
  constructor(config: S3Config) {
    super({ ...config, forcePathStyle: true }, 'Backblaze B2');
  }
}
