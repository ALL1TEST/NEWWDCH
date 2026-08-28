'use client';

// ============================================================
// PLATFORM BACKUPS — backup management.
// ============================================================
// Reuses the existing Backup model + /api/backups API + backup lib.
// Backup infrastructure exists (local provider); where a real provider
// is not wired in production, the page clearly labels status rather
// than faking successful backups.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Database, Info } from 'lucide-react';
import { PlatformPageHeader, ErrorState, EmptyState, formatBytes, formatDate } from '@/modules/platform/shared';

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
    <div className="space-y-4">
      <PlatformPageHeader
        title="Backups"
        subtitle="Platform backup history + status. Restore / download / delete actions are available where the backup provider supports them."
      />

      {!hasRealBackup && (
        <Card>
          <CardContent className="p-4 flex items-start gap-3 bg-amber-50/50 dark:bg-amber-950/20">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-400">No completed backups yet</p>
              <p className="text-muted-foreground">A local backup provider is registered, but no real backup has been created. Create one to verify end-to-end — this page does not fake successful backups.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Backup History</CardTitle>
          </div>
          <CardDescription className="text-xs">Retention, size, status and date for each backup.</CardDescription>
        </CardHeader>
        <CardContent>
          {backupsQuery.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : backupsQuery.isError ? (
            <ErrorState message="Unable to load backups." onRetry={() => backupsQuery.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState message="No backups recorded." icon={<Database className="h-5 w-5 opacity-50" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Name</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Scope</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Size</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Provider</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((b) => (
                    <tr key={b.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 pr-4 text-xs">{b.name || b.filename}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{b.scope}</td>
                      <td className="py-2.5 pr-4 text-xs">{formatBytes(b.size)}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{b.storageProvider}</td>
                      <td className="py-2.5 pr-4"><Badge variant="outline" className="text-[10px]">{b.status}</Badge></td>
                      <td className="py-2.5 text-right text-xs text-muted-foreground">{formatDate(b.completedAt ?? b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
