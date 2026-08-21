// ============================================================
// Local Storage Provider — fully functional
// ============================================================

import { existsSync, mkdirSync, copyFileSync, statSync, unlinkSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { StorageProvider, UploadResult, VerifyResult, LocalConfig } from './types';

const DEFAULT_BACKUP_DIR = join(process.cwd(), 'backups');

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'Local';
  private basePath: string;

  constructor(config: LocalConfig = {}) {
    this.basePath = resolve(config.path || DEFAULT_BACKUP_DIR);
    // Ensure the directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Verify the directory exists and is writable
      if (!existsSync(this.basePath)) {
        mkdirSync(this.basePath, { recursive: true });
      }
      const testFile = join(this.basePath, '.connection-test');
      const { writeFileSync } = await import('node:fs');
      writeFileSync(testFile, 'test');
      unlinkSync(testFile);
      return { success: true, message: `Connected to ${this.basePath}` };
    } catch (err) {
      return { success: false, message: `Cannot access ${this.basePath}: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  }

  async upload(localPath: string, remoteFileName: string): Promise<UploadResult> {
    const remotePath = join(this.basePath, remoteFileName);
    const dir = dirname(remotePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    copyFileSync(localPath, remotePath);
    const stat = statSync(remotePath);
    const checksum = await this.computeChecksum(remotePath);
    return { remotePath, size: stat.size, checksum };
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const src = this.resolvePath(remotePath);
    const dir = dirname(localPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    copyFileSync(src, localPath);
  }

  async verify(remotePath: string, expectedSize?: number, expectedChecksum?: string): Promise<VerifyResult> {
    const fullPath = this.resolvePath(remotePath);
    if (!existsSync(fullPath)) {
      return { exists: false, size: null, checksumMatch: false };
    }
    const stat = statSync(fullPath);
    let checksumMatch = true;
    if (expectedChecksum) {
      const actualChecksum = await this.computeChecksum(fullPath);
      checksumMatch = actualChecksum === expectedChecksum;
    }
    const sizeMatch = expectedSize ? stat.size === expectedSize : true;
    return { exists: true, size: stat.size, checksumMatch: checksumMatch && sizeMatch };
  }

  async deleteFile(remotePath: string): Promise<void> {
    const fullPath = this.resolvePath(remotePath);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  }

  private resolvePath(remotePath: string): string {
    // Handle both absolute paths and relative-to-base paths
    if (existsSync(remotePath)) return remotePath;
    const joined = join(this.basePath, remotePath);
    return joined;
  }

  private async computeChecksum(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    return createHash('sha256').update(buffer).digest('hex');
  }
}
