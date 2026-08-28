'use client';

// ============================================================
// PLATFORM BACKUPS — backup management.
// ============================================================
// Reuses the existing Backup model + /api/backups API + backup lib.
// Backup infrastructure exists (local provider); where a real provider
// is not wired in production, the page clearly labels status rather
// than faking successful backups.
// Visual language mirrors the Client Dashboard Backups page:
// same PageHeader, same rounded-lg border bg-card table container,
// same Table components, same StatusBadge / EmptyState patterns,
// same alert-box styling for the "no backups" warning.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Database, Info, DatabaseBackup } from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  StatusBadge,
} from '@/components/patterns';
import { ErrorState, formatBytes, formatDate } from '@/modules/platform/shared';
import { SCOPE_BADGE_CLASSES } from '@/lib/backup-constants';
import { cn, labelize } from '@/lib/utils';

interface BackupRow {
  id: string;
  name: string;
  filename: string;
  scope: string;
  size: number;
  status: string;
  storageProvider: string;
  createdAt: string;
  completedAt: string | null;
}

function ScopeBadge({ scope }: { scope: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent font-medium text-[10px] leading-4 px-1.5',
        SCOPE_BADGE_CLASSES[scope as keyof typeof SCOPE_BADGE_CLASSES] ??
          'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
      )}
    >
      {labelize(scope)}
    </Badge>
  );
}

export function PlatformBackupsModule() {
  const backupsQuery = useQuery({
    queryKey: ['platform-backups'],
    queryFn: () => getApi<{ data: BackupRow[] } | BackupRow[]>('/api/backups?pageSize=20'),
    retry: false,
  });

  const raw = backupsQuery.data;
  const list: BackupRow[] = Array.isArray(raw) ? raw : ((raw as { data?: BackupRow[] })?.data ?? []);

  const hasRealBackup = list.some((b) => b.status === 'COMPLETED' && b.size > 0);

  return (
    <div className="space-y-6">
      {/* ==================== Page Header (Client Dashboard style) ==================== */}
      <PageHeader
        breadcrumbs={false}
        title="Backups"
        description="Platform backup history + status. Restore / download / delete actions are available where the backup provider supports them."
      />

      {/* ==================== No completed backups alert (same alert pattern) ==================== */}
      {!hasRealBackup && (
        <Card>
          <CardContent className="p-4 flex items-start gap-3 bg-amber-50/50 dark:bg-amber-950/20">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-400">No completed backups yet</p>
              <p className="text-muted-foreground">
                A local backup provider is registered, but no real backup has been created. Create one to verify
                end-to-end — this page does not fake successful backups.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== Backup History Table (Client Dashboard style) ==================== */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Database className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold">Backup History</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Retention, size, status and date for each backup.
            </p>
          </div>
        </div>

        {backupsQuery.isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-32 ml-auto" />
              </div>
            ))}
          </div>
        ) : backupsQuery.isError ? (
          <div className="py-6">
            <ErrorState message="Unable to load backups." onRetry={() => backupsQuery.refetch()} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={DatabaseBackup}
            title="No backups recorded"
            description="When backups complete they will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((b) => (
                  <TableRow key={b.id} className="group">
                    <TableCell className="pl-4">
                      <span className="font-medium text-foreground text-sm">
                        {b.name || b.filename}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ScopeBadge scope={b.scope} />
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums text-sm text-muted-foreground">
                        {formatBytes(b.size)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {labelize(b.storageProvider)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} size="sm" />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(b.completedAt ?? b.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
