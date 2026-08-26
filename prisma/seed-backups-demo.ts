// ============================================================
// BACKUPS MODULE SEED SCRIPT — Realistic Test/Demo Data
// ============================================================
// Populates ALL Backups sections with internally consistent data:
//   - BackupStorage   (Storage page)
//   - BackupSchedule  (Schedules page)
//   - Backup          (Backups page + Restore selector)
//   - BackupLog       (Logs page + Overview recent activity)
// The same backup that appears on the Overview (recent activity / chart)
// also appears in the Backups list, the Restore selector, and the Logs
// page. Storage destinations are reused across backups & schedules.
// Schedules have lastRunAt tied to existing backup createdAt.
//
// Run:  bun run prisma/seed-backups-demo.ts
// ============================================================

import { db } from '../src/lib/db';

// -------------------- Config --------------------

const ADMIN_USER_ID = 'cmt0pg30r0000uwmza35j6bwu'; // admin@example.com (already seeded)
const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

// Realistic checksum (sha256 hex, 64 chars). Static values for stability.
function fakeChecksum(seed: number): string {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 64; i++) {
    s += hex[(seed * (i + 7) + i * 13) % 16];
  }
  return s;
}

// Format ISO with explicit ms
function iso(ms: number): Date {
  return new Date(ms);
}

// -------------------- Storage Destinations --------------------

interface SeedStorage {
  name: string;
  provider:
    | 'LOCAL' | 'AMAZON_S3' | 'GOOGLE_DRIVE' | 'DROPBOX' | 'ONEDRIVE'
    | 'CLOUDFLARE_R2' | 'BACKBLAZE_B2' | 'FTP' | 'SFTP';
  config: Record<string, unknown>;
  isActive: boolean;
  lastTestAt: Date;
  lastTestResult: string | null; // 'SUCCESS' | 'FAILED' | null
}

const STORAGE_DESTINATIONS: SeedStorage[] = [
  {
    name: 'Local Storage',
    provider: 'LOCAL',
    config: {
      path: '/var/backups/cms',
      maxRetentionDays: 30,
    },
    isActive: true,
    lastTestAt: iso(NOW - 2 * HOUR_MS),
    lastTestResult: 'SUCCESS',
  },
  {
    name: 'Amazon S3 — Production',
    provider: 'AMAZON_S3',
    config: {
      bucket: 'cms-backups-prod',
      region: 'us-east-1',
      prefix: 'backups/',
      storageClass: 'STANDARD_IA',
    },
    isActive: true,
    lastTestAt: iso(NOW - 1 * DAY_MS),
    lastTestResult: 'SUCCESS',
  },
  {
    name: 'Google Cloud Storage',
    provider: 'GOOGLE_DRIVE',
    config: {
      bucket: 'cms-dr-archive',
      prefix: 'monthly/',
      location: 'US-CENTRAL1',
    },
    isActive: true,
    lastTestAt: iso(NOW - 3 * DAY_MS),
    lastTestResult: 'SUCCESS',
  },
  {
    name: 'Backblaze B2 Archive',
    provider: 'BACKBLAZE_B2',
    config: {
      bucket: 'cms-cold-archive',
      prefix: 'archive/',
    },
    isActive: false,
    lastTestAt: iso(NOW - 5 * DAY_MS),
    lastTestResult: 'FAILED',
  },
];

// -------------------- Schedules --------------------

interface SeedSchedule {
  name: string;
  description: string;
  frequency: 'HOURLY' | 'EVERY_6_HOURS' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM_CRON';
  cronExpression: string | null;
  scope: 'FULL' | 'DATABASE_ONLY' | 'MEDIA_ONLY' | 'FILES_ONLY' | 'SETTINGS_ONLY';
  storageProvider: SeedStorage['provider'];
  encryptionEnabled: boolean;
  verificationEnabled: boolean;
  retentionCount: number;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

const SCHEDULES: SeedSchedule[] = [
  {
    name: 'Daily Database Backup',
    description: 'Automatic nightly database snapshot. Runs at 02:00 UTC every day.',
    frequency: 'DAILY',
    cronExpression: '0 2 * * *',
    scope: 'DATABASE_ONLY',
    storageProvider: 'LOCAL',
    encryptionEnabled: true,
    verificationEnabled: true,
    retentionCount: 7,
    isActive: true,
    lastRunAt: iso(NOW - 6 * HOUR_MS),
    nextRunAt: iso(NOW + 18 * HOUR_MS),
  },
  {
    name: 'Weekly Full Backup',
    description: 'Complete system backup including media and files. Sundays at 03:00 UTC.',
    frequency: 'WEEKLY',
    cronExpression: '0 3 * * 0',
    scope: 'FULL',
    storageProvider: 'AMAZON_S3',
    encryptionEnabled: true,
    verificationEnabled: true,
    retentionCount: 4,
    isActive: true,
    lastRunAt: iso(NOW - 2 * DAY_MS),
    nextRunAt: iso(NOW + 5 * DAY_MS),
  },
  {
    name: 'Monthly Archive',
    description: 'Long-term archive snapshot stored to cold storage. First of each month at 04:00 UTC.',
    frequency: 'MONTHLY',
    cronExpression: '0 4 1 * *',
    scope: 'FULL',
    storageProvider: 'BACKBLAZE_B2',
    encryptionEnabled: true,
    verificationEnabled: true,
    retentionCount: 12,
    isActive: false,
    lastRunAt: iso(NOW - 18 * DAY_MS),
    nextRunAt: null,
  },
  {
    name: 'Hourly DB Snapshot',
    description: 'Fast point-in-time database snapshot for low RPO. Retains 24 hourly snapshots.',
    frequency: 'HOURLY',
    cronExpression: '0 * * * *',
    scope: 'DATABASE_ONLY',
    storageProvider: 'LOCAL',
    encryptionEnabled: false,
    verificationEnabled: false,
    retentionCount: 24,
    isActive: true,
    lastRunAt: iso(NOW - 40 * MIN_MS),
    nextRunAt: iso(NOW + 20 * MIN_MS),
  },
];

// -------------------- Backups --------------------
// 14 backups spread over the last 7 days. Mix of:
//   - 10 COMPLETED
//   - 2 FAILED
//   - 1 CREATING (in-progress)
//   - 1 VERIFIED (extra-verified)
// Storage providers match destinations above.
// Sizes & durations are realistic per scope.
// `createdAt` is spread across 7 days so the chart on Overview shows activity.

type Scope = 'FULL' | 'DATABASE_ONLY' | 'MEDIA_ONLY' | 'FILES_ONLY' | 'SETTINGS_ONLY';
type Status = 'CREATING' | 'COMPLETED' | 'FAILED' | 'RESTORING' | 'RESTORED' | 'VERIFYING' | 'VERIFIED' | 'DELETING';
type Provider = SeedStorage['provider'];

interface SeedBackup {
  name: string;
  filename: string;
  scope: Scope;
  size: number;
  type: 'AUTOMATED' | 'MANUAL';
  status: Status;
  note: string | null;
  storageProvider: Provider;
  storagePath: string | null;
  encryptionStatus: 'NONE' | 'ENCRYPTED' | 'DECRYPTED';
  verificationStatus: 'PENDING' | 'VERIFIED' | 'WARNING' | 'FAILED' | 'SKIPPED';
  checksum: string | null;
  databaseSize: number;
  fileCount: number;
  durationMs: number | null;
  downloadCount: number;
  scheduleIdx: number | null; // index into SCHEDULES (resolved later)
  createdAgoMs: number;
  completedAgoMs: number | null;
}

const BACKUPS: SeedBackup[] = [
  // Day 0 (today) — one in-progress, one just-verified, one failed-this-morning
  {
    name: 'Hourly DB Snapshot — 10:00',
    filename: 'backup-2026-08-21T10-00-00-database_only.zip',
    scope: 'DATABASE_ONLY',
    size: 0,
    type: 'AUTOMATED',
    status: 'CREATING',
    note: 'In progress: streaming database tables...',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-21T10-00-00-database_only.zip',
    encryptionStatus: 'NONE',
    verificationStatus: 'PENDING',
    checksum: null,
    databaseSize: 0,
    fileCount: 0,
    durationMs: null,
    downloadCount: 0,
    scheduleIdx: 3,
    createdAgoMs: 4 * MIN_MS,
    completedAgoMs: null,
  },
  {
    name: 'Daily Database Backup — 02:00',
    filename: 'backup-2026-08-21T02-00-00-database_only.enc',
    scope: 'DATABASE_ONLY',
    size: 184_562_432, // ~176 MB
    type: 'AUTOMATED',
    status: 'VERIFIED',
    note: 'Automatic nightly backup. Verified post-upload with checksum comparison.',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-21T02-00-00-database_only.enc',
    encryptionStatus: 'ENCRYPTED',
    verificationStatus: 'VERIFIED',
    checksum: fakeChecksum(11),
    databaseSize: 184_562_432,
    fileCount: 1,
    durationMs: 42_180,
    downloadCount: 0,
    scheduleIdx: 0,
    createdAgoMs: 8 * HOUR_MS,
    completedAgoMs: 8 * HOUR_MS - 42_180,
  },
  {
    name: 'Manual Pre-Release Snapshot',
    filename: 'backup-2026-08-21T00-15-00-full.zip',
    scope: 'FULL',
    size: 1_924_642_816, // ~1.79 GB
    type: 'MANUAL',
    status: 'COMPLETED',
    note: 'Pre-release snapshot taken before deploying v2.4 to production.',
    storageProvider: 'AMAZON_S3',
    storagePath: 's3://cms-backups-prod/backups/backup-2026-08-21T00-15-00-full.zip',
    encryptionStatus: 'ENCRYPTED',
    verificationStatus: 'VERIFIED',
    checksum: fakeChecksum(21),
    databaseSize: 412_876_544,
    fileCount: 1_842,
    durationMs: 184_320,
    downloadCount: 3,
    scheduleIdx: null,
    createdAgoMs: 10 * HOUR_MS,
    completedAgoMs: 10 * HOUR_MS - 184_320,
  },

  // Day 1 (yesterday) — daily + failed media backup
  {
    name: 'Daily Database Backup — 02:00',
    filename: 'backup-2026-08-20T02-00-00-database_only.enc',
    scope: 'DATABASE_ONLY',
    size: 178_234_112, // ~170 MB
    type: 'AUTOMATED',
    status: 'COMPLETED',
    note: 'Automatic nightly backup.',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-20T02-00-00-database_only.enc',
    encryptionStatus: 'ENCRYPTED',
    verificationStatus: 'VERIFIED',
    checksum: fakeChecksum(31),
    databaseSize: 178_234_112,
    fileCount: 1,
    durationMs: 38_940,
    downloadCount: 1,
    scheduleIdx: 0,
    createdAgoMs: 1 * DAY_MS + 8 * HOUR_MS,
    completedAgoMs: 1 * DAY_MS + 8 * HOUR_MS - 38_940,
  },
  {
    name: 'Hourly DB Snapshot — 14:00',
    filename: 'backup-2026-08-20T14-00-00-database_only.zip',
    scope: 'DATABASE_ONLY',
    size: 156_432_128, // ~149 MB
    type: 'AUTOMATED',
    status: 'COMPLETED',
    note: 'Hourly snapshot.',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-20T14-00-00-database_only.zip',
    encryptionStatus: 'NONE',
    verificationStatus: 'SKIPPED',
    checksum: fakeChecksum(41),
    databaseSize: 156_432_128,
    fileCount: 1,
    durationMs: 14_280,
    downloadCount: 0,
    scheduleIdx: 3,
    createdAgoMs: 1 * DAY_MS + 4 * HOUR_MS,
    completedAgoMs: 1 * DAY_MS + 4 * HOUR_MS - 14_280,
  },
  {
    name: 'Media Library Backup (FAILED)',
    filename: 'backup-2026-08-20T11-30-00-media_only.zip',
    scope: 'MEDIA_ONLY',
    size: 0,
    type: 'MANUAL',
    status: 'FAILED',
    note: 'Failed: storage write timeout after 60s. Media archive exceeded 2 GB temp buffer.',
    storageProvider: 'GOOGLE_DRIVE',
    storagePath: null,
    encryptionStatus: 'NONE',
    verificationStatus: 'SKIPPED',
    checksum: null,
    databaseSize: 0,
    fileCount: 0,
    durationMs: 60_840,
    downloadCount: 0,
    scheduleIdx: null,
    createdAgoMs: 1 * DAY_MS + 7 * HOUR_MS,
    completedAgoMs: null,
  },

  // Day 2 — weekly full backup
  {
    name: 'Weekly Full Backup — W33',
    filename: 'backup-2026-08-19T03-00-00-full.enc',
    scope: 'FULL',
    size: 1_892_562_432, // ~1.76 GB (SQLite INT max ~2.1B)
    type: 'AUTOMATED',
    status: 'COMPLETED',
    note: 'Weekly full system backup. Uploaded to S3 Standard-IA.',
    storageProvider: 'AMAZON_S3',
    storagePath: 's3://cms-backups-prod/backups/backup-2026-08-19T03-00-00-full.enc',
    encryptionStatus: 'ENCRYPTED',
    verificationStatus: 'VERIFIED',
    checksum: fakeChecksum(51),
    databaseSize: 408_124_416,
    fileCount: 1_856,
    durationMs: 224_640,
    downloadCount: 2,
    scheduleIdx: 1,
    createdAgoMs: 2 * DAY_MS + 6 * HOUR_MS,
    completedAgoMs: 2 * DAY_MS + 6 * HOUR_MS - 224_640,
  },
  {
    name: 'Daily Database Backup — 02:00',
    filename: 'backup-2026-08-19T02-00-00-database_only.enc',
    scope: 'DATABASE_ONLY',
    size: 172_564_224, // ~164 MB
    type: 'AUTOMATED',
    status: 'COMPLETED',
    note: 'Automatic nightly backup.',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-19T02-00-00-database_only.enc',
    encryptionStatus: 'ENCRYPTED',
    verificationStatus: 'VERIFIED',
    checksum: fakeChecksum(61),
    databaseSize: 172_564_224,
    fileCount: 1,
    durationMs: 36_120,
    downloadCount: 0,
    scheduleIdx: 0,
    createdAgoMs: 2 * DAY_MS + 8 * HOUR_MS,
    completedAgoMs: 2 * DAY_MS + 8 * HOUR_MS - 36_120,
  },

  // Day 3 — daily + manual
  {
    name: 'Daily Database Backup — 02:00',
    filename: 'backup-2026-08-18T02-00-00-database_only.enc',
    scope: 'DATABASE_ONLY',
    size: 169_842_688, // ~162 MB
    type: 'AUTOMATED',
    status: 'COMPLETED',
    note: 'Automatic nightly backup.',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-18T02-00-00-database_only.enc',
    encryptionStatus: 'ENCRYPTED',
    verificationStatus: 'WARNING',
    checksum: fakeChecksum(71),
    databaseSize: 169_842_688,
    fileCount: 1,
    durationMs: 34_740,
    downloadCount: 0,
    scheduleIdx: 0,
    createdAgoMs: 3 * DAY_MS + 8 * HOUR_MS,
    completedAgoMs: 3 * DAY_MS + 8 * HOUR_MS - 34_740,
  },
  {
    name: 'Settings Export — Pre-maintenance',
    filename: 'backup-2026-08-18T09-45-00-settings_only.zip',
    scope: 'SETTINGS_ONLY',
    size: 4_281_344, // ~4 MB
    type: 'MANUAL',
    status: 'COMPLETED',
    note: 'Settings-only export before scheduled maintenance window.',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-18T09-45-00-settings_only.zip',
    encryptionStatus: 'NONE',
    verificationStatus: 'VERIFIED',
    checksum: fakeChecksum(81),
    databaseSize: 0,
    fileCount: 1,
    durationMs: 4_320,
    downloadCount: 1,
    scheduleIdx: null,
    createdAgoMs: 3 * DAY_MS + 2 * HOUR_MS,
    completedAgoMs: 3 * DAY_MS + 2 * HOUR_MS - 4_320,
  },

  // Day 4 — daily + failed
  {
    name: 'Daily Database Backup — 02:00',
    filename: 'backup-2026-08-17T02-00-00-database_only.enc',
    scope: 'DATABASE_ONLY',
    size: 0,
    type: 'AUTOMATED',
    status: 'FAILED',
    note: 'Failed: database connection error (ECONNREFUSED). Resolved on retry at 02:15.',
    storageProvider: 'LOCAL',
    storagePath: null,
    encryptionStatus: 'ENCRYPTED',
    verificationStatus: 'FAILED',
    checksum: null,
    databaseSize: 0,
    fileCount: 0,
    durationMs: 2_840,
    downloadCount: 0,
    scheduleIdx: 0,
    createdAgoMs: 4 * DAY_MS + 8 * HOUR_MS,
    completedAgoMs: null,
  },
  {
    name: 'Hourly DB Snapshot — 06:00',
    filename: 'backup-2026-08-17T06-00-00-database_only.zip',
    scope: 'DATABASE_ONLY',
    size: 148_762_112, // ~142 MB
    type: 'AUTOMATED',
    status: 'COMPLETED',
    note: 'Hourly snapshot.',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-17T06-00-00-database_only.zip',
    encryptionStatus: 'NONE',
    verificationStatus: 'SKIPPED',
    checksum: fakeChecksum(91),
    databaseSize: 148_762_112,
    fileCount: 1,
    durationMs: 12_480,
    downloadCount: 0,
    scheduleIdx: 3,
    createdAgoMs: 4 * DAY_MS + 4 * HOUR_MS,
    completedAgoMs: 4 * DAY_MS + 4 * HOUR_MS - 12_480,
  },

  // Day 5 — daily
  {
    name: 'Daily Database Backup — 02:00',
    filename: 'backup-2026-08-16T02-00-00-database_only.enc',
    scope: 'DATABASE_ONLY',
    size: 164_124_672, // ~156 MB
    type: 'AUTOMATED',
    status: 'COMPLETED',
    note: 'Automatic nightly backup.',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-16T02-00-00-database_only.enc',
    encryptionStatus: 'ENCRYPTED',
    verificationStatus: 'VERIFIED',
    checksum: fakeChecksum(101),
    databaseSize: 164_124_672,
    fileCount: 1,
    durationMs: 32_580,
    downloadCount: 0,
    scheduleIdx: 0,
    createdAgoMs: 5 * DAY_MS + 8 * HOUR_MS,
    completedAgoMs: 5 * DAY_MS + 8 * HOUR_MS - 32_580,
  },

  // Day 6 — daily (oldest, near the 7-day chart edge)
  {
    name: 'Daily Database Backup — 02:00',
    filename: 'backup-2026-08-15T02-00-00-database_only.enc',
    scope: 'DATABASE_ONLY',
    size: 161_448_960, // ~154 MB
    type: 'AUTOMATED',
    status: 'COMPLETED',
    note: 'Automatic nightly backup.',
    storageProvider: 'LOCAL',
    storagePath: '/var/backups/cms/backup-2026-08-15T02-00-00-database_only.enc',
    encryptionStatus: 'ENCRYPTED',
    verificationStatus: 'VERIFIED',
    checksum: fakeChecksum(111),
    databaseSize: 161_448_960,
    fileCount: 1,
    durationMs: 31_020,
    downloadCount: 0,
    scheduleIdx: 0,
    createdAgoMs: 6 * DAY_MS + 8 * HOUR_MS,
    completedAgoMs: 6 * DAY_MS + 8 * HOUR_MS - 31_020,
  },
];

// -------------------- Logs --------------------
// At least one per backup (CREATE log). Plus RESTORE, VERIFY, DOWNLOAD,
// SCHEDULE, DELETE operation logs. Each log references the right backupId.

type LogAction = 'CREATE' | 'RESTORE' | 'VERIFY' | 'DOWNLOAD' | 'DELETE' | 'SCHEDULE' | 'STORAGE_TEST';
type LogStatus = 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';

interface SeedLog {
  action: LogAction;
  status: LogStatus;
  backupIdx: number | null; // index into BACKUPS (resolved to backupId)
  databaseSize: number | null;
  fileCount: number | null;
  archiveSize: number | null;
  durationMs: number | null;
  storageProvider: Provider | null;
  verificationResult: string | null;
  errorMessage: string | null;
  warnings: string | null;
  createdAgoMs: number;
}

// We'll build this dynamically based on BACKUPS to keep IDs consistent.
function buildLogs(): SeedLog[] {
  const logs: SeedLog[] = [];

  // One CREATE log per backup (matches the backup's own status/duration)
  BACKUPS.forEach((b, idx) => {
    const completedMs = b.completedAgoMs;
    const isCreating = b.status === 'CREATING';
    logs.push({
      action: 'CREATE',
      status: isCreating ? 'IN_PROGRESS' : (b.status === 'FAILED' ? 'FAILED' : 'SUCCESS'),
      backupIdx: idx,
      databaseSize: b.databaseSize || null,
      fileCount: b.fileCount || null,
      archiveSize: b.size || null,
      durationMs: b.durationMs,
      storageProvider: b.storageProvider,
      verificationResult: b.verificationStatus === 'VERIFIED' ? 'VERIFIED'
        : b.verificationStatus === 'WARNING' ? 'WARNING'
        : b.verificationStatus === 'FAILED' ? 'FAILED'
        : null,
      errorMessage: b.status === 'FAILED' ? b.note : null,
      warnings: b.verificationStatus === 'WARNING' ? 'Checksum mismatch on 2 of 1842 files. Manual review recommended.' : null,
      createdAgoMs: b.createdAgoMs + 60_000, // log written 1 min after backup started
    });
  });

  // Restore operation — restores from the "Manual Pre-Release Snapshot" (idx 2, COMPLETED+VERIFIED+ENCRYPTED)
  logs.push({
    action: 'RESTORE',
    status: 'SUCCESS',
    backupIdx: 2,
    databaseSize: 412_876_544,
    fileCount: 1_842,
    archiveSize: 1_924_642_816,
    durationMs: 198_240,
    storageProvider: 'AMAZON_S3',
    verificationResult: 'VERIFIED',
    errorMessage: null,
    warnings: null,
    createdAgoMs: 3 * HOUR_MS,
  });

  // Verify operation — explicit verify on the Weekly Full Backup (idx 6)
  logs.push({
    action: 'VERIFY',
    status: 'SUCCESS',
    backupIdx: 6,
    databaseSize: 408_124_416,
    fileCount: 1_856,
    archiveSize: 1_892_562_432,
    durationMs: 28_640,
    storageProvider: 'AMAZON_S3',
    verificationResult: 'VERIFIED',
    errorMessage: null,
    warnings: null,
    createdAgoMs: 2 * DAY_MS + 5 * HOUR_MS,
  });

  // Download operation — Dev pulled the Manual Pre-Release Snapshot (idx 2)
  logs.push({
    action: 'DOWNLOAD',
    status: 'SUCCESS',
    backupIdx: 2,
    databaseSize: null,
    fileCount: null,
    archiveSize: 1_924_642_816,
    durationMs: 14_280,
    storageProvider: 'AMAZON_S3',
    verificationResult: null,
    errorMessage: null,
    warnings: null,
    createdAgoMs: 2 * HOUR_MS,
  });

  // Schedule execution log — Daily Database Backup fired successfully
  logs.push({
    action: 'SCHEDULE',
    status: 'SUCCESS',
    backupIdx: 1, // most recent daily backup produced by schedule
    databaseSize: 184_562_432,
    fileCount: 1,
    archiveSize: 184_562_432,
    durationMs: 42_180,
    storageProvider: 'LOCAL',
    verificationResult: 'VERIFIED',
    errorMessage: null,
    warnings: null,
    createdAgoMs: 8 * HOUR_MS + 60_000,
  });

  // Schedule execution log — Hourly snapshot triggered (in-progress)
  logs.push({
    action: 'SCHEDULE',
    status: 'IN_PROGRESS',
    backupIdx: 0, // the CREATING one
    databaseSize: null,
    fileCount: null,
    archiveSize: null,
    durationMs: null,
    storageProvider: 'LOCAL',
    verificationResult: null,
    errorMessage: null,
    warnings: null,
    createdAgoMs: 4 * MIN_MS + 30_000,
  });

  // Storage verification — Backblaze B2 connection failed
  logs.push({
    action: 'STORAGE_TEST',
    status: 'FAILED',
    backupIdx: null,
    databaseSize: null,
    fileCount: null,
    archiveSize: null,
    durationMs: 4_320,
    storageProvider: 'BACKBLAZE_B2',
    verificationResult: 'FAILED',
    errorMessage: 'Connection timeout: unable to reach Backblaze B2 API endpoint after 8s. Check credentials and network.',
    warnings: null,
    createdAgoMs: 5 * DAY_MS,
  });

  // Storage verification — Amazon S3 success
  logs.push({
    action: 'STORAGE_TEST',
    status: 'SUCCESS',
    backupIdx: null,
    databaseSize: null,
    fileCount: null,
    archiveSize: null,
    durationMs: 1_280,
    storageProvider: 'AMAZON_S3',
    verificationResult: 'VERIFIED',
    errorMessage: null,
    warnings: null,
    createdAgoMs: 1 * DAY_MS,
  });

  // Delete operation — old backup was cleaned up by retention policy (no backup reference)
  logs.push({
    action: 'DELETE',
    status: 'SUCCESS',
    backupIdx: null,
    databaseSize: null,
    fileCount: null,
    archiveSize: 158_432_128,
    durationMs: 1_240,
    storageProvider: 'LOCAL',
    verificationResult: null,
    errorMessage: null,
    warnings: null,
    createdAgoMs: 6 * HOUR_MS,
  });

  // Restore operation — failed restore attempt (user canceled mid-way, simulated as FAILED)
  logs.push({
    action: 'RESTORE',
    status: 'FAILED',
    backupIdx: 8, // Day 3 daily backup with WARNING verification — exactly the kind user wouldn't normally pick
    databaseSize: 169_842_688,
    fileCount: 1,
    archiveSize: 169_842_688,
    durationMs: 14_820,
    storageProvider: 'LOCAL',
    verificationResult: 'WARNING',
    errorMessage: 'Restore aborted: checksum mismatch detected during pre-restore validation. No data was modified.',
    warnings: 'Backup verification status is WARNING — restore blocked by integrity check.',
    createdAgoMs: 1 * DAY_MS + 3 * HOUR_MS,
  });

  // Sort by createdAgoMs asc so they insert chronologically; display layer sorts desc.
  logs.sort((a, b) => a.createdAgoMs - b.createdAgoMs);
  return logs;
}

// -------------------- Main --------------------

async function main() {
  console.log('=== BACKUPS SEED STARTING ===');
  console.log(`Reference NOW: ${new Date(NOW).toISOString()}`);
  console.log(`Admin user:    ${ADMIN_USER_ID}`);

  // ---- Clean up old backup data (order matters for FK constraints) ----
  console.log('\nCleaning up old backup data...');
  await db.backupLog.deleteMany({});
  await db.backup.deleteMany({});
  await db.backupSchedule.deleteMany({});
  await db.backupStorage.deleteMany({});
  console.log('  Old data cleaned.');

  // ---- 1. Storage Destinations ----
  console.log('\nCreating storage destinations...');
  const storageIds: string[] = [];
  for (const s of STORAGE_DESTINATIONS) {
    const created = await db.backupStorage.create({
      data: {
        name: s.name,
        provider: s.provider,
        config: JSON.stringify(s.config),
        isActive: s.isActive,
        lastTestAt: s.lastTestAt,
        lastTestResult: s.lastTestResult,
        createdById: ADMIN_USER_ID,
        siteId: null,
      },
    });
    storageIds.push(created.id);
    console.log(`  ✓ ${s.name} (${s.provider}) — ${s.isActive ? 'Active' : 'Inactive'} — ${s.lastTestResult}`);
  }

  // ---- 2. Schedules ----
  console.log('\nCreating backup schedules...');
  const scheduleIds: string[] = [];
  for (const s of SCHEDULES) {
    const created = await db.backupSchedule.create({
      data: {
        name: s.name,
        description: s.description,
        frequency: s.frequency,
        cronExpression: s.cronExpression,
        scope: s.scope,
        storageProvider: s.storageProvider,
        encryptionEnabled: s.encryptionEnabled,
        verificationEnabled: s.verificationEnabled,
        retentionCount: s.retentionCount,
        isActive: s.isActive,
        lastRunAt: s.lastRunAt,
        nextRunAt: s.nextRunAt,
        createdById: ADMIN_USER_ID,
        siteId: null,
      },
    });
    scheduleIds.push(created.id);
    console.log(`  ✓ ${s.name} (${s.frequency}) — ${s.isActive ? 'Active' : 'Inactive'}`);
  }

  // ---- 3. Backups ----
  console.log('\nCreating backups...');
  const backupIds: string[] = [];
  for (const b of BACKUPS) {
    const createdAt = new Date(NOW - b.createdAgoMs);
    const completedAt = b.completedAgoMs !== null ? new Date(NOW - b.completedAgoMs) : null;
    const created = await db.backup.create({
      data: {
        name: b.name,
        filename: b.filename,
        scope: b.scope,
        size: b.size,
        type: b.type,
        status: b.status,
        note: b.note,
        storageProvider: b.storageProvider,
        storagePath: b.storagePath,
        encryptionStatus: b.encryptionStatus,
        verificationStatus: b.verificationStatus,
        checksum: b.checksum,
        databaseSize: b.databaseSize,
        fileCount: b.fileCount,
        durationMs: b.durationMs,
        downloadCount: b.downloadCount,
        scheduleId: b.scheduleIdx !== null ? scheduleIds[b.scheduleIdx] : null,
        createdById: ADMIN_USER_ID,
        siteId: null,
        createdAt,
        completedAt,
        updatedAt: completedAt ?? createdAt,
      },
    });
    backupIds.push(created.id);
    console.log(`  ✓ ${b.name} (${b.scope}, ${b.status}) — ${b.size ? `${(b.size / 1024 / 1024).toFixed(1)}MB` : '0B'} — ${new Date(createdAt).toISOString()}`);
  }

  // ---- 4. Logs ----
  console.log('\nCreating backup logs...');
  const logs = buildLogs();
  for (const l of logs) {
    await db.backupLog.create({
      data: {
        backupId: l.backupIdx !== null ? backupIds[l.backupIdx] : null,
        action: l.action,
        status: l.status,
        databaseSize: l.databaseSize,
        fileCount: l.fileCount,
        archiveSize: l.archiveSize,
        durationMs: l.durationMs,
        storageProvider: l.storageProvider,
        verificationResult: l.verificationResult,
        errorMessage: l.errorMessage,
        warnings: l.warnings,
        createdById: ADMIN_USER_ID,
        siteId: null,
        createdAt: new Date(NOW - l.createdAgoMs),
      },
    });
  }
  console.log(`  ✓ Created ${logs.length} backup log entries`);

  // ---- Summary ----
  console.log('\n=== SEED COMPLETE ===');
  const summary = {
    storage: await db.backupStorage.count(),
    schedules: await db.backupSchedule.count(),
    backups: await db.backup.count(),
    logs: await db.backupLog.count(),
    completedBackups: await db.backup.count({ where: { status: 'COMPLETED' } }),
    failedBackups: await db.backup.count({ where: { status: 'FAILED' } }),
    creatingBackups: await db.backup.count({ where: { status: 'CREATING' } }),
    verifiedBackups: await db.backup.count({ where: { status: 'VERIFIED' } }),
    activeSchedules: await db.backupSchedule.count({ where: { isActive: true } }),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error('SEED FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
