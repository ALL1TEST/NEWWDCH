// ============================================================
// FTP Storage Provider — fully functional (using basic-ftp)
// ============================================================

import * as ftp from 'basic-ftp';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { StorageProvider, UploadResult, VerifyResult, FtpConfig } from './types';

export class FtpStorageProvider implements StorageProvider {
  readonly name = 'FTP';
  protected config: FtpConfig;
  protected remotePath: string;

  constructor(config: FtpConfig) {
    this.config = config;
    this.remotePath = config.remotePath || '/backups';
  }

  protected async getClient(): Promise<ftp.Client> {
    const client = new ftp.Client();
    await client.access({
      host: this.config.host,
      port: this.config.port || 21,
      user: this.config.username,
      password: this.config.password,
      secure: this.config.secure || false,
    });
    return client;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const client = new ftp.Client();
    try {
      await client.access({
        host: this.config.host,
        port: this.config.port || 21,
        user: this.config.username,
        password: this.config.password,
        secure: this.config.secure || false,
      });
      // Try to ensure the remote directory exists
      await client.ensureDir(this.remotePath).catch(() => {});
      return { success: true, message: `Connected to FTP ${this.config.host}:${this.config.port || 21}` };
    } catch (err) {
      return { success: false, message: `FTP connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
    } finally {
      client.close();
    }
  }

  async upload(localPath: string, remoteFileName: string): Promise<UploadResult> {
    const client = await this.getClient();
    try {
      await client.ensureDir(this.remotePath);
      await client.uploadFrom(localPath, remoteFileName);
      const localStat = await stat(localPath);
      const buffer = await readFile(localPath);
      const checksum = createHash('sha256').update(buffer).digest('hex');
      return { remotePath: `${this.remotePath}/${remoteFileName}`, size: localStat.size, checksum };
    } finally {
      client.close();
    }
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const client = await this.getClient();
    try {
      const fileName = remotePath.split('/').pop() || remotePath;
      await client.ensureDir(this.remotePath);
      await client.downloadTo(localPath, fileName);
    } finally {
      client.close();
    }
  }

  async verify(remotePath: string, expectedSize?: number, expectedChecksum?: string): Promise<VerifyResult> {
    const client = await this.getClient();
    try {
      const fileName = remotePath.split('/').pop() || remotePath;
      await client.ensureDir(this.remotePath);
      const list = await client.list(fileName);
      if (list.length === 0) return { exists: false, size: null, checksumMatch: false };
      const fileInfo = list[0];
      const size = fileInfo.size ?? null;
      let checksumMatch = true;
      if (expectedChecksum) {
        // Download and verify checksum
        const tmpPath = localPath + '.verify';
        await client.downloadTo(tmpPath, fileName);
        const buffer = await readFile(tmpPath);
        const actualChecksum = createHash('sha256').update(buffer).digest('hex');
        checksumMatch = actualChecksum === expectedChecksum;
        await import('node:fs').then(fs => fs.unlinkSync(tmpPath));
      }
      const sizeMatch = expectedSize ? size === expectedSize : true;
      return { exists: true, size, checksumMatch: checksumMatch && sizeMatch };
    } catch (err) {
      return { exists: false, size: null, checksumMatch: false };
    } finally {
      client.close();
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    const client = await this.getClient();
    try {
      const fileName = remotePath.split('/').pop() || remotePath;
      await client.ensureDir(this.remotePath);
      await client.remove(fileName);
    } finally {
      client.close();
    }
  }
}
