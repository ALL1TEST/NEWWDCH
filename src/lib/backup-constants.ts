// Shared constants for the Backup module — single source of truth
import type { BackupScope, BackupStorageProvider } from '@/shared/types';

// -------------------- Duration Formatting --------------------

export function formatDurationMs(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

// -------------------- Backup Scope Options --------------------

export const BACKUP_SCOPE_OPTIONS: { value: BackupScope; label: string }[] = [
  { value: 'FULL', label: 'Full' },
  { value: 'DATABASE_ONLY', label: 'Database Only' },
  { value: 'MEDIA_ONLY', label: 'Media Only' },
  { value: 'FILES_ONLY', label: 'Files Only' },
  { value: 'SETTINGS_ONLY', label: 'Settings Only' },
];

// -------------------- Storage Provider Options --------------------

export const BACKUP_STORAGE_OPTIONS: { value: BackupStorageProvider; label: string }[] = [
  { value: 'LOCAL', label: 'Local' },
  { value: 'GOOGLE_DRIVE', label: 'Google Drive' },
  { value: 'DROPBOX', label: 'Dropbox' },
  { value: 'ONEDRIVE', label: 'OneDrive' },
  { value: 'CLOUDFLARE_R2', label: 'Cloudflare R2' },
  { value: 'FTP', label: 'FTP' },
];

// -------------------- Scope Badge Colors --------------------

export const SCOPE_BADGE_CLASSES: Record<BackupScope, string> = {
  FULL: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DATABASE_ONLY: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  MEDIA_ONLY: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  FILES_ONLY: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  SETTINGS_ONLY: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};
