'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  HardDrive,
  Clock,
  XCircle,
  CheckCircle2,
  Database,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, EmptyState, StatusBadge } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { formatFileSize, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigationStore } from '@/lib/stores/navigation-store';

// -------------------- Types --------------------

interface BackupStatsData {
  lastBackup?: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
  };
  nextScheduled?: string;
  failedCount?: number;
  totalStorageUsed?: number;
  verifiedCount?: number;
  failedVerifications?: number;
  pendingVerifications?: number;
  restorePointCount?: number;
  completedCount?: number;
  successRate?: number;
  activeSchedules?: number;
  recentLogs?: Array<{
    id: string;
    action: string;
    status: string;
    createdAt: string;
    backup?: { name: string };
  }>;
}

// -------------------- Backup Monitoring Page --------------------

export function BackupMonitoringPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.backupStats(),
    queryFn: () => getApi<BackupStatsData>('/api/monitoring/backup-stats'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const d = data;

  return (
    <div className="space-y-6">
      <PageHeader title="Backup Monitoring" description="Monitor backup health, storage, and restore points" />
      <Button variant="outline" onClick={() => useNavigationStore.getState().navigate('backups')} className="gap-2">
        Manage Backups <ChevronRight className="h-4 w-4" />
      </Button>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <>
          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Last Backup</span>
                </div>
                {d?.lastBackup ? (
                  <>
                    <p className="text-lg font-bold">{d.lastBackup.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={d.lastBackup.status} size="sm" />
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(d.lastBackup.createdAt)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-lg font-bold text-muted-foreground">No backups yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Next Scheduled</span>
                </div>
                <p className="text-lg font-bold">{d?.nextScheduled ? formatRelativeTime(d.nextScheduled) : '—'}</p>
                {d?.activeSchedules != null && (
                  <p className="text-xs text-muted-foreground mt-1">{d.activeSchedules} active schedule{d.activeSchedules !== 1 ? 's' : ''}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Failed Backups</span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{d?.failedCount ?? 0}</p>
                {d?.successRate != null && (
                  <p className="text-xs text-muted-foreground mt-1">Success Rate: {d.successRate.toFixed(1)}%</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Storage Used</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{d?.totalStorageUsed != null ? formatFileSize(d.totalStorageUsed) : '—'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Verified Backups</span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{d?.verifiedCount ?? 0}</p>
                {(d?.failedVerifications ?? 0) > 0 && (
                  <p className="text-xs text-red-500 mt-1">{d?.failedVerifications ?? 0} failed verifications</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-sky-500" />
                  <span className="text-xs text-muted-foreground">Restore Points</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{d?.restorePointCount ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Backup Logs */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Recent Backup Activity</h3>
              {(!d?.recentLogs || d.recentLogs.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent backup activity.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Action</th>
                        <th className="pb-2 pr-4 font-medium">Backup</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {d.recentLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-accent/50">
                          <td className="py-2.5 pr-4 text-xs font-medium">{log.action}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground truncate max-w-[180px]">{log.backup?.name ?? '—'}</td>
                          <td className="py-2.5 pr-4"><StatusBadge status={log.status} size="sm" /></td>
                          <td className="py-2.5 text-muted-foreground whitespace-nowrap">{formatRelativeTime(log.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
