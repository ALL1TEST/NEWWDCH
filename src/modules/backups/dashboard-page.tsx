'use client';

import React, { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  DatabaseBackup, HardDrive, CheckCircle2, Clock, XCircle,
  Plus, BarChart3, Activity as ActivityIcon, Database,
} from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useChartTheme } from '@/lib/chart-theme';
import { cn, formatFileSize, formatRelativeTime, truncate } from '@/lib/utils';
import { formatDurationMs } from '@/lib/backup-constants';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSiteStore } from '@/lib/stores/site-store';

// -------------------- Types --------------------

interface BackupStats {
  totalBackups: number;
  totalStorageBytes?: number;
  totalStorageFormatted?: string;
  successRate: number;
  avgDurationMs?: number;
  avgDurationFormatted?: string;
  lastBackup?: { id: string; name: string; filename?: string; status: string; createdAt: string; size?: number } | null;
  failedBackups: number;
  completedBackups?: number;
  statusDistribution?: Record<string, number>;
  storageTrend?: { completedAt: string; size: number }[];
  recentLogs?: { id: string; action: string; status: string; createdAt: string; errorMessage?: string | null }[];
}

// -------------------- Stat Card --------------------

function StatCard({
  label, value, secondary, icon, iconColor, delay = 0, onClick,
}: {
  label: string;
  value: string | number;
  secondary?: string;
  icon: React.ReactNode;
  iconColor: string;
  delay?: number;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: delay * 0.06 }}
    >
      <Wrapper
        {...(onClick ? { onClick, type: 'button' as const } : {})}
        className={cn(
          'text-left w-full rounded-xl border bg-card p-5 transition-colors',
          onClick && 'hover:bg-muted/40 cursor-pointer',
        )}
      >
        {/* Small muted label */}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          {label}
        </p>
        {/* Large value */}
        <p className="text-3xl font-bold tracking-tight tabular-nums leading-none">
          {value}
        </p>
        {/* Small secondary info */}
        {secondary && (
          <p className="text-xs text-muted-foreground mt-2">{secondary}</p>
        )}
        {/* Small icon — bottom right, doesn't compete with value */}
        <div className={cn('absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-lg', iconColor)}>
          {icon}
        </div>
      </Wrapper>
    </motion.div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 relative">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

// -------------------- Backups Breadcrumb --------------------
// Mirrors the SEO page's breadcrumb pattern (rendered via the global
// <Breadcrumbs /> + <PageHeader>): site-context prefix > current module crumb.
// Lives directly below the top header (below the BackupsSubNav tabs),
// aligned with the main content's left edge. Same position/spacing/typography/
// icons/alignment as the SEO page's breadcrumb (text-xs muted-foreground
// prefix + Database icon + BreadcrumbPage).
// NOTE: the global <Breadcrumbs /> component intentionally returns null for
// the `backups` module (it lives in the SETTINGS_CHILDREN set so the topbar
// keeps only the "All Sites" site selector); this inline breadcrumb is the
// sole breadcrumb on the Backups Overview page.

function BackupsBreadcrumb() {
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const isAllSites = useSiteStore((s) => s.isAllSites());

  return (
    <Breadcrumb className="mb-3">
      <BreadcrumbList>
        {/* Site context prefix — exactly matches the SEO page's breadcrumb */}
        {isAllSites ? (
          <>
            <BreadcrumbItem>
              <span className="text-xs text-muted-foreground font-medium">All Sites</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : activeSite ? (
          <>
            <BreadcrumbItem>
              <span className="text-xs text-muted-foreground font-medium">{activeSite.name}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        {/* Current module crumb — Database icon + BreadcrumbPage (last item) */}
        <BreadcrumbItem>
          <span className="flex items-center gap-1">
            <Database className="h-3.5 w-3.5" />
            <BreadcrumbPage>Backups</BreadcrumbPage>
          </span>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

// -------------------- Dashboard Page --------------------

export function DashboardPage() {
  const navigate = useNavigationStore((s) => s.navigate);
  // Shared theme-aware chart palette — keeps ALL chart text readable in
  // dark mode without page-specific overrides.
  const chart = useChartTheme();
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.backupStats.dashboard(),
    queryFn: () => getApi<BackupStats>('/api/backups/stats'),
    staleTime: 15_000,
  });

  const trendData = useMemo(() => {
    const trend = stats?.storageTrend;
    if (!trend?.length) return [];
    const byDate = new Map<string, { date: string; count: number }>();
    for (const d of trend) {
      const day = new Date(d.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const existing = byDate.get(day) ?? { date: day, count: 0 };
      existing.count += 1;
      byDate.set(day, existing);
    }
    return Array.from(byDate.values());
  }, [stats?.storageTrend]);

  const goToBackups = useCallback(() => navigate('backups', null, 'backups'), [navigate]);
  const goToStorage = useCallback(() => navigate('backups', null, 'storage'), [navigate]);
  const goToLogs = useCallback(() => navigate('backups', null, 'logs'), [navigate]);

  if (isLoading || !stats) {
    return (
      <>
        <BackupsBreadcrumb />
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </>
    );
  }

  const successSecondary = stats.totalBackups > 0
    ? `${stats.completedBackups ?? 0} of ${stats.totalBackups} successful`
    : 'No backups yet';

  const lastBackupValue = stats.lastBackup
    ? new Date(stats.lastBackup.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Never';
  const lastBackupSecondary = stats.lastBackup
    ? new Date(stats.lastBackup.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'No backups yet';

  return (
    <>
      <BackupsBreadcrumb />
      <div className="space-y-8 p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Backups</h1>
            <p className="mt-1 text-sm text-muted-foreground">Monitor and manage your system backups.</p>
          </div>
          <Button onClick={goToBackups} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Backup
          </Button>
        </div>

      {/* Statistics Cards — 3 columns on large screens, 2 on medium, 1 on small */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="relative">
          <StatCard
            label="Total Backups"
            value={stats.totalBackups}
            secondary="All backups"
            icon={<DatabaseBackup className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            iconColor="bg-emerald-50 dark:bg-emerald-900/20"
            delay={0}
            onClick={goToBackups}
          />
        </div>
        <div className="relative">
          <StatCard
            label="Total Storage"
            value={stats.totalStorageFormatted ?? formatFileSize(stats.totalStorageBytes ?? 0)}
            secondary="Across all backups"
            icon={<HardDrive className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            iconColor="bg-amber-50 dark:bg-amber-900/20"
            delay={1}
            onClick={goToStorage}
          />
        </div>
        <div className="relative">
          <StatCard
            label="Success Rate"
            value={`${(stats.successRate ?? 0).toFixed(0)}%`}
            secondary={successSecondary}
            icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
            iconColor="bg-green-50 dark:bg-green-900/20"
            delay={2}
          />
        </div>
        <div className="relative">
          <StatCard
            label="Avg Duration"
            value={stats.avgDurationFormatted ?? formatDurationMs(stats.avgDurationMs ?? null)}
            secondary="Per backup"
            icon={<Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
            iconColor="bg-sky-50 dark:bg-sky-900/20"
            delay={3}
          />
        </div>
        <div className="relative">
          <StatCard
            label="Last Backup"
            value={lastBackupValue}
            secondary={lastBackupSecondary}
            icon={<DatabaseBackup className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
            iconColor="bg-violet-50 dark:bg-violet-900/20"
            delay={4}
          />
        </div>
        <div className="relative">
          <StatCard
            label="Failed"
            value={stats.failedBackups}
            secondary={stats.failedBackups === 0 ? 'All healthy' : 'Requires attention'}
            icon={<XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
            iconColor="bg-red-50 dark:bg-red-900/20"
            delay={5}
            onClick={goToLogs}
          />
        </div>
      </div>

      {/* Backup Activity — chart + recent activity side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-Day Trend Chart */}
        <Card className="flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Backup Activity</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Backup count over the last 7 days</p>
          </CardHeader>
          <CardContent className="flex-1">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} opacity={0.5} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} tickMargin={8} tick={{ fill: chart.textMuted }} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} tickMargin={4} tick={{ fill: chart.textMuted }} />
                  <RechartsTooltip
                    cursor={{ fill: chart.mutedBg, opacity: 0.3 }}
                    contentStyle={chart.tooltipStyle}
                    labelStyle={chart.tooltipLabelStyle}
                    itemStyle={chart.tooltipItemStyle}
                  />
                  <Bar dataKey="count" fill={chart.chart1} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[220px] text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <BarChart3 className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">No backup activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first backup to start tracking activity.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Latest backup operations</p>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {stats.recentLogs && stats.recentLogs.length > 0 ? (
              <div className="divide-y">
                {stats.recentLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                    {/* Status badge */}
                    <div className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      log.status === 'success' ? 'bg-green-500' : log.status === 'failed' ? 'bg-red-500' : 'bg-amber-500',
                    )} />
                    {/* Action */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{log.action.replace(/_/g, ' ')}</p>
                      {log.errorMessage && (
                        <p className="text-xs text-muted-foreground truncate" title={log.errorMessage}>
                          {truncate(log.errorMessage, 60)}
                        </p>
                      )}
                    </div>
                    {/* Status text */}
                    <Badge variant="outline" className={cn(
                      'text-[10px] font-medium border-transparent shrink-0',
                      log.status === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : log.status === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
                    )}>
                      {log.status}
                    </Badge>
                    {/* Time */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <ActivityIcon className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">Backup operations will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
