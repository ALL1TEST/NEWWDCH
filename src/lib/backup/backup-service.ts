// ============================================================
// Backup Service — orchestration for create, verify, restore, retention
// ============================================================

import { db } from '@/lib/db';
import { existsSync, mkdirSync, copyFileSync, statSync, unlinkSync, writeFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import JSZip from 'jszip';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { encrypt, decrypt } from '@/lib/encryption';
import { createStorageProvider, encryptConfigForStorage, decryptConfigFields, maskConfigSecrets } from './providers';
import type { StorageProvider } from './providers';
import { nanoid } from 'nanoid';
import path from 'node:path';

const BACKUP_DIR = join(process.cwd(), 'backups');
const DB_PATH = join(process.cwd(), 'db', 'custom.db');
const MEDIA_DIR = join(process.cwd(), 'upload');
const TMP_DIR = join(process.cwd(), 'backups', '.tmp');

function formatTimestamp(d: Date): string {
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function computeSha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function getFirstUserId(): Promise<string | null> {
  const user = await db.user.findFirst({ select: { id: true } });
  return user?.id ?? null;
}

// ============================================================
// Create Backup — the main orchestration
// ============================================================

export interface CreateBackupParams {
  name?: string;
  scope: 'FULL' | 'DATABASE_ONLY' | 'MEDIA_ONLY' | 'FILES_ONLY' | 'SETTINGS_ONLY';
  type?: 'MANUAL' | 'AUTOMATED';
  note?: string;
  storageId?: string; // BackupStorage ID — if set, upload to this destination
  storageProvider?: string; // fallback: provider type string
  encryptionEnabled?: boolean;
  verifyAfterUpload?: boolean;
  createdById?: string;
  siteId?: string | null;
  scheduleId?: string | null;
}

export async function createBackup(params: CreateBackupParams) {
  const id = 'bkp_' + nanoid(10);
  const startedAt = Date.now();
  const now = new Date();
  const timestamp = formatTimestamp(now);
  const scope = params.scope;
  const backupName = params.name?.trim() || `Backup ${timestamp}`;
  const filename = `backup-${timestamp}-${scope.toLowerCase()}.zip`;
  const localArchivePath = join(BACKUP_DIR, filename);

  // Ensure directories exist
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  // Resolve createdById
  let createdById = params.createdById;
  if (!createdById) {
    createdById = await getFirstUserId();
    if (!createdById) throw new Error('No user found. Cannot create backup.');
  }

  // Determine storage destination
  let storage: StorageProvider | null = null;
  let storageConfigRecord: { id: string; name: string; provider: string; config: string } | null = null;
  if (params.storageId) {
    storageConfigRecord = await db.backupStorage.findUnique({ where: { id: params.storageId } }) as any;
    if (storageConfigRecord) {
      storage = await createStorageProvider(storageConfigRecord.provider, storageConfigRecord.config);
    }
  }

  const encryptionStatus = params.encryptionEnabled ? 'ENCRYPTED' as const : 'NONE' as const;

  // Create the backup record
  const backup = await db.backup.create({
    data: {
      name: backupName,
      filename,
      scope,
      type: params.type || 'MANUAL',
      status: 'CREATING',
      note: params.note ?? null,
      storageProvider: (storageConfigRecord?.provider || params.storageProvider || 'LOCAL') as any,
      storagePath: localArchivePath,
      encryptionStatus,
      verificationStatus: 'PENDING',
      createdById,
      siteId: params.siteId ?? null,
      scheduleId: params.scheduleId ?? null,
    },
  });

  try {
    // ---- Step 1: Create the archive ----
    await createArchive(localArchivePath, scope);

    // ---- Step 2: Encrypt if enabled ----
    let finalLocalPath = localArchivePath;
    let finalFilename = filename;
    if (params.encryptionEnabled) {
      finalFilename = filename.replace('.zip', '.enc');
      finalLocalPath = join(BACKUP_DIR, finalFilename);
      const fileBuffer = await readFile(localArchivePath);
      const encryptedData = await encrypt(fileBuffer.toString('base64'));
      await writeFile(finalLocalPath, encryptedData);
      // Clean up the unencrypted archive
      if (existsSync(localArchivePath)) unlinkSync(localArchivePath);
    }

    // ---- Step 3: Compute checksum + size ----
    const checksum = await computeSha256(finalLocalPath);
    const fileSize = statSync(finalLocalPath).size;
    const dbStat = existsSync(DB_PATH) ? statSync(DB_PATH).size : 0;

    const durationMs = Date.now() - startedAt;

    // ---- Step 4: Upload to storage if not LOCAL ----
    let remotePath = finalLocalPath; // default: local path
    if (storage && storageConfigRecord) {
      try {
        const uploadResult = await storage.upload(finalLocalPath, finalFilename);
        remotePath = uploadResult.remotePath;
      } catch (uploadErr) {
        throw new Error(`Upload failed: ${uploadErr instanceof Error ? uploadErr.message : 'Unknown error'}`);
      }
    }

    // ---- Step 5: Verify if requested ----
    let verificationStatus: 'VERIFIED' | 'FAILED' = 'PENDING' as any;
    if (params.verifyAfterUpload && storage) {
      try {
        const verifyResult = await storage.verify(remotePath, fileSize, checksum);
        verificationStatus = verifyResult.exists && verifyResult.checksumMatch ? 'VERIFIED' : 'FAILED';
      } catch {
        verificationStatus = 'FAILED';
      }
    } else if (!storage) {
      // Local storage — verify locally
      verificationStatus = existsSync(finalLocalPath) ? 'VERIFIED' : 'FAILED';
    }

    // ---- Step 6: Update backup record as COMPLETED ----
    const completed = await db.backup.update({
      where: { id: backup.id },
      data: {
        status: 'COMPLETED',
        size: fileSize,
        databaseSize: dbStat,
        durationMs,
        checksum,
        verificationStatus,
        storagePath: remotePath,
        completedAt: new Date(),
        fileCount: scope === 'DATABASE_ONLY' ? 1 : scope === 'FULL' ? 2 : 1,
      },
    });

    // ---- Step 7: Create success log ----
    await db.backupLog.create({
      data: {
        backupId: backup.id,
        action: 'create',
        status: 'success',
        databaseSize: dbStat,
        fileCount: 1,
        archiveSize: fileSize,
        durationMs,
        storageProvider: (storageConfigRecord?.provider || params.storageProvider || 'LOCAL') as any,
        verificationResult: verificationStatus,
        createdById,
        siteId: params.siteId ?? null,
      },
    });

    return completed;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errMsg = error instanceof Error ? error.message : 'Unknown backup error';

    // Mark as FAILED
    await db.backup.update({
      where: { id: backup.id },
      data: { status: 'FAILED', durationMs },
    });

    await db.backupLog.create({
      data: {
        backupId: backup.id,
        action: 'create',
        status: 'failed',
        durationMs,
        storageProvider: (storageConfigRecord?.provider || params.storageProvider || 'LOCAL') as any,
        errorMessage: errMsg,
        createdById,
        siteId: params.siteId ?? null,
      },
    });

    // Clean up partial files
    if (existsSync(localArchivePath)) {
      try { unlinkSync(localArchivePath); } catch {}
    }

    throw error;
  }
}

// ============================================================
// Create Archive — zip with DB + media + settings depending on scope
// ============================================================

async function createArchive(archivePath: string, scope: string): Promise<void> {
  const zip = new JSZip();

  // Database (always included unless scope is MEDIA_ONLY or FILES_ONLY or SETTINGS_ONLY)
  if (scope !== 'MEDIA_ONLY' && scope !== 'FILES_ONLY' && scope !== 'SETTINGS_ONLY') {
    if (existsSync(DB_PATH)) {
      const dbBuffer = await readFile(DB_PATH);
      zip.file('database.sqlite3', dbBuffer);
    }
  }

  // Media files
  if (scope === 'FULL' || scope === 'MEDIA_ONLY') {
    if (existsSync(MEDIA_DIR)) {
      await addDirToZip(zip, MEDIA_DIR, 'media/');
    }
  }

  // Settings (export as JSON)
  if (scope === 'FULL' || scope === 'SETTINGS_ONLY') {
    const settingsJson = await createSettingsJson();
    zip.file('settings.json', settingsJson);
  }

  // Generate the zip file
  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  await writeFile(archivePath, content);
}

// Helper: recursively add a directory to a JSZip instance
async function addDirToZip(zip: JSZip, dirPath: string, zipPath: string): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const entryZipPath = zipPath + entry.name;
    if (entry.isDirectory()) {
      await addDirToZip(zip, fullPath, entryZipPath + '/');
    } else if (entry.isFile()) {
      const buffer = await readFile(fullPath);
      zip.file(entryZipPath, buffer);
    }
  }
}

async function createSettingsJson(): Promise<string> {
  const [settings, contentTypes, categories, tags, navItems] = await Promise.all([
    db.setting.findMany(),
    db.contentType.findMany(),
    db.category.findMany(),
    db.tag.findMany(),
    db.navigation.findMany(),
  ]);
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    settings,
    contentTypes,
    categories,
    tags,
    navigation: navItems,
  }, null, 2);
}

// ============================================================
// Verify Backup — check file exists, size, checksum
// ============================================================

export async function verifyBackup(backupId: string) {
  const backup = await db.backup.findUnique({ where: { id: backupId } });
  if (!backup) throw new Error('Backup not found');

  try {
    // For local storage
    let exists = false;
    let sizeMatch = false;
    let checksumMatch = false;

    if (existsSync(backup.storagePath)) {
      exists = true;
      const stat = statSync(backup.storagePath);
      sizeMatch = backup.size > 0 ? stat.size === backup.size : true;
      if (backup.checksum) {
        const actualChecksum = await computeSha256(backup.storagePath);
        checksumMatch = actualChecksum === backup.checksum;
      } else {
        checksumMatch = true;
      }
    }

    const verificationStatus = exists && sizeMatch && checksumMatch ? 'VERIFIED' : 'FAILED';

    await db.backup.update({
      where: { id: backupId },
      data: { verificationStatus },
    });

    await db.backupLog.create({
      data: {
        backupId,
        action: 'verify',
        status: verificationStatus === 'VERIFIED' ? 'success' : 'failed',
        verificationResult: verificationStatus,
        errorMessage: verificationStatus === 'FAILED' ? `exists=${exists}, sizeMatch=${sizeMatch}, checksumMatch=${checksumMatch}` : null,
      },
    });

    return { verificationStatus, exists, sizeMatch, checksumMatch };
  } catch (error) {
    await db.backup.update({ where: { id: backupId }, data: { verificationStatus: 'FAILED' } });
    await db.backupLog.create({
      data: {
        backupId,
        action: 'verify',
        status: 'failed',
        verificationResult: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

// ============================================================
// Restore Backup — download, decrypt, restore DB
// ============================================================

export async function restoreBackup(backupId: string, createdById?: string) {
  const backup = await db.backup.findUnique({ where: { id: backupId } });
  if (!backup) throw new Error('Backup not found');
  if (backup.status !== 'COMPLETED') throw new Error('Only completed backups can be restored');

  const startedAt = Date.now();

  try {
    if (!existsSync(backup.storagePath)) {
      throw new Error('Backup file not found at the storage path');
    }

    // If encrypted, decrypt first
    let dbRestorePath = backup.storagePath;
    if (backup.encryptionStatus === 'ENCRYPTED') {
      const tmpDir = join(TMP_DIR, `restore-${Date.now()}`);
      if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
      const decryptedPath = join(tmpDir, backup.filename.replace('.enc', '.zip'));
      const encryptedData = await readFile(backup.storagePath);
      const decryptedBase64 = await decrypt(encryptedData.toString());
      await writeFile(decryptedPath, Buffer.from(decryptedBase64, 'base64'));
      dbRestorePath = decryptedPath;
    }

    // For now, restore the database from the archive
    // (Extract the database.sqlite3 file from the zip)
    if (dbRestorePath.endsWith('.zip') || dbRestorePath.endsWith('.enc')) {
      const { createReadStream } = await import('node:fs');
      const yauzl = await import('yauzl').catch(() => null);
      // Use unzip approach: extract database.sqlite3 to a temp path, then copy to DB_PATH
      const tmpDbPath = join(TMP_DIR, `restore-db-${Date.now()}.sqlite3`);
      await extractFileFromZip(dbRestorePath, 'database.sqlite3', tmpDbPath);

      if (existsSync(tmpDbPath)) {
        // Create a backup of the current DB before overwriting
        const currentDbBackup = DB_PATH + '.pre-restore';
        if (existsSync(DB_PATH)) {
          copyFileSync(DB_PATH, currentDbBackup);
        }
        // Replace the DB
        copyFileSync(tmpDbPath, DB_PATH);
        // Clean up temp
        try { unlinkSync(tmpDbPath); } catch {}
      }
    } else {
      // Direct DB file backup (old format)
      const currentDbBackup = DB_PATH + '.pre-restore';
      if (existsSync(DB_PATH)) {
        copyFileSync(DB_PATH, currentDbBackup);
      }
      copyFileSync(backup.storagePath, DB_PATH);
    }

    const durationMs = Date.now() - startedAt;
    const dbStat = existsSync(DB_PATH) ? statSync(DB_PATH).size : 0;

    await db.backupLog.create({
      data: {
        backupId,
        action: 'restore',
        status: 'success',
        databaseSize: dbStat,
        durationMs,
        createdById: createdById || await getFirstUserId(),
      },
    });

    return { success: true, durationMs, databaseSize: dbStat };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    await db.backupLog.create({
      data: {
        backupId,
        action: 'restore',
        status: 'failed',
        durationMs,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        createdById: createdById || await getFirstUserId(),
      },
    });
    throw error;
  }
}

// Helper: extract a single file from a zip archive using JSZip
async function extractFileFromZip(zipPath: string, fileName: string, outputPath: string): Promise<void> {
  const zipBuffer = await readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  const file = zip.file(fileName);
  if (file) {
    const content = await file.async('nodebuffer');
    await writeFile(outputPath, content);
  } else {
    throw new Error(`File '${fileName}' not found in the backup archive`);
  }
}

// ============================================================
// Retention — delete old backups beyond the retention count
// ============================================================

export async function applyRetention(scheduleId: string, retentionCount: number) {
  const schedule = await db.backupSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule || retentionCount <= 0) return;

  // Get completed backups for this schedule, sorted by date descending
  const backups = await db.backup.findMany({
    where: { scheduleId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  });

  // Keep the newest N, delete the rest
  const toDelete = backups.slice(retentionCount);

  for (const backup of toDelete) {
    try {
      // Delete the physical file
      if (existsSync(backup.storagePath)) {
        unlinkSync(backup.storagePath);
      }

      // Delete from remote storage if applicable
      if (backup.storageProvider !== 'LOCAL') {
        const storageRecord = await db.backupStorage.findFirst({
          where: { provider: backup.storageProvider as any, isActive: true },
        });
        if (storageRecord) {
          try {
            const provider = await createStorageProvider(storageRecord.provider, storageRecord.config);
            await provider.deleteFile(backup.storagePath);
          } catch {}
        }
      }

      // Log the deletion
      await db.backupLog.create({
        data: {
          backupId: backup.id,
          action: 'retention_delete',
          status: 'success',
          warnings: `Deleted by retention policy (keeping ${retentionCount} backups)`,
        },
      });
    } catch (err) {
      // Log deletion failure
      await db.backupLog.create({
        data: {
          backupId: backup.id,
          action: 'retention_delete',
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  }

  // Delete the records from the database
  if (toDelete.length > 0) {
    await db.backup.deleteMany({
      where: { id: { in: toDelete.map((b) => b.id) } },
    });
  }

  return { deleted: toDelete.length };
}

// ============================================================
// Scheduler — check for due schedules and trigger backups
// ============================================================

export async function runScheduledBackups() {
  const now = new Date();
  const dueSchedules = await db.backupSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
  });

  const results: { scheduleId: string; success: boolean; message: string }[] = [];

  for (const schedule of dueSchedules) {
    // Prevent duplicate execution — check if a backup is already running for this schedule
    const runningBackup = await db.backup.findFirst({
      where: { scheduleId: schedule.id, status: { in: ['CREATING', 'RUNNING'] } },
    });
    if (runningBackup) {
      results.push({ scheduleId: schedule.id, success: false, message: 'A backup is already running for this schedule' });
      continue;
    }

    try {
      // Create the backup
      const backup = await createBackup({
        name: `Scheduled: ${schedule.name}`,
        scope: schedule.scope,
        type: 'AUTOMATED',
        storageProvider: schedule.storageProvider as string,
        encryptionEnabled: schedule.encryptionEnabled,
        verifyAfterUpload: schedule.verificationEnabled,
        scheduleId: schedule.id,
        siteId: schedule.siteId,
        createdById: schedule.createdById,
      });

      // Apply retention policy
      if (schedule.retentionCount > 0) {
        await applyRetention(schedule.id, schedule.retentionCount);
      }

      // Update the schedule's last/next run
      await db.backupSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: calculateNextRun(schedule.frequency, schedule.cronExpression),
        },
      });

      results.push({ scheduleId: schedule.id, success: true, message: `Backup created: ${backup.filename}` });
    } catch (error) {
      results.push({ scheduleId: schedule.id, success: false, message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return results;
}

function calculateNextRun(frequency: string, cronExpression?: string | null): Date {
  const now = new Date();
  switch (frequency) {
    case 'HOURLY':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case 'DAILY':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'WEEKLY':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'MONTHLY':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case 'CUSTOM':
      // For custom cron, just schedule for 1 hour from now (proper cron parsing would need a library)
      return new Date(now.getTime() + 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

// ============================================================
// Test Storage Connection — used by the storage API
// ============================================================

export async function testStorageConnection(providerType: string, config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  try {
    const configJson = JSON.stringify(config);
    const provider = await createStorageProvider(providerType, configJson);
    return await provider.testConnection();
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}
