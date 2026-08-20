// ============================================================
// SFTP Storage Provider — fully functional (using ssh2)
// ============================================================

import { Client } from 'ssh2';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import type { StorageProvider, UploadResult, VerifyResult, SftpConfig } from './types';

export class SftpStorageProvider implements StorageProvider {
  readonly name = 'SFTP';
  protected config: SftpConfig;
  protected remotePath: string;

  constructor(config: SftpConfig) {
    this.config = config;
    this.remotePath = config.remotePath || '/backups';
  }

  protected connect(): Promise<{ conn: Client; sftp: SFTPWrapper }> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) { conn.end(); reject(err); return; }
          resolve({ conn, sftp });
        });
      }).on('error', (err) => reject(err)).connect({
        host: this.config.host,
        port: this.config.port || 22,
        username: this.config.username,
        ...(this.config.password ? { password: this.config.password } : {}),
        ...(this.config.privateKey ? { privateKey: this.config.privateKey } : {}),
      });
    });
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { conn, sftp } = await this.connect();
      // Ensure the remote directory exists
      await this.ensureDir(sftp, this.remotePath);
      conn.end();
      return { success: true, message: `Connected to SFTP ${this.config.host}:${this.config.port || 22}` };
    } catch (err) {
      return { success: false, message: `SFTP connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  }

  async upload(localPath: string, remoteFileName: string): Promise<UploadResult> {
    const { conn, sftp } = await this.connect();
    try {
      await this.ensureDir(sftp, this.remotePath);
      const remoteFullPath = `${this.remotePath}/${remoteFileName}`;
      await new Promise<void>((resolve, reject) => {
        sftp.fastPut(localPath, remoteFullPath, (err) => err ? reject(err) : resolve());
      });
      const localStat = await stat(localPath);
      const buffer = await readFile(localPath);
      const checksum = createHash('sha256').update(buffer).digest('hex');
      return { remotePath: remoteFullPath, size: localStat.size, checksum };
    } finally {
      conn.end();
    }
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const { conn, sftp } = await this.connect();
    try {
      const fileName = remotePath.split('/').pop() || remotePath;
      const remoteFullPath = remotePath.startsWith('/') ? remotePath : `${this.remotePath}/${remotePath}`;
      await new Promise<void>((resolve, reject) => {
        sftp.fastGet(remoteFullPath, localPath, (err) => err ? reject(err) : resolve());
      });
    } finally {
      conn.end();
    }
  }

  async verify(remotePath: string, expectedSize?: number, expectedChecksum?: string): Promise<VerifyResult> {
    const { conn, sftp } = await this.connect();
    try {
      const remoteFullPath = remotePath.startsWith('/') ? remotePath : `${this.remotePath}/${remotePath}`;
      const statInfo = await new Promise<any>((resolve, reject) => {
        sftp.stat(remoteFullPath, (err, stats) => err ? resolve(null) : resolve(stats));
      });
      if (!statInfo) return { exists: false, size: null, checksumMatch: false };
      const size = statInfo.size ?? null;
      let checksumMatch = true;
      if (expectedChecksum) {
        // Download and verify
        const tmpPath = `/tmp/.verify-${Date.now()}`;
        await new Promise<void>((resolve, reject) => {
          sftp.fastGet(remoteFullPath, tmpPath, (err) => err ? reject(err) : resolve());
        });
        const buffer = await readFile(tmpPath);
        const actualChecksum = createHash('sha256').update(buffer).digest('hex');
        checksumMatch = actualChecksum === expectedChecksum;
        await import('node:fs').then(fs => fs.unlinkSync(tmpPath));
      }
      const sizeMatch = expectedSize ? size === expectedSize : true;
      return { exists: true, size, checksumMatch: checksumMatch && sizeMatch };
    } catch {
      return { exists: false, size: null, checksumMatch: false };
    } finally {
      conn.end();
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    const { conn, sftp } = await this.connect();
    try {
      const remoteFullPath = remotePath.startsWith('/') ? remotePath : `${this.remotePath}/${remotePath}`;
      await new Promise<void>((resolve, reject) => {
        sftp.unlink(remoteFullPath, (err) => err ? reject(err) : resolve());
      });
    } finally {
      conn.end();
    }
  }

  private async ensureDir(sftp: SFTPWrapper, dir: string): Promise<void> {
    return new Promise((resolve) => {
      sftp.mkdir(dir, (err: Error | null) => {
        // Ignore error — directory may already exist
        resolve();
      });
    });
  }
}

// Minimal type for the sftp subsystem
interface SFTPWrapper {
  fastPut(localPath: string, remotePath: string, callback: (err: Error | null) => void): void;
  fastGet(remotePath: string, localPath: string, callback: (err: Error | null) => void): void;
  stat(remotePath: string, callback: (err: Error | null, stats: unknown) => void): void;
  mkdir(path: string, callback: (err: Error | null) => void): void;
  unlink(path: string, callback: (err: Error | null) => void): void;
}
