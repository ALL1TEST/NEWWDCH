'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  DatabaseBackup,
  HardDrive,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { PageHeader } from '@/components/patterns';
import { StatusBadge } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils';
import { formatDurationMs } from '@/lib/backup-constants';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { BackupStatus } from '@/shared/types';

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
  statusDistribution?: Record<string, number>;
  scopeDistribution?: Record<string, number>;
  storageTrend?: { completedAt: string; size: number }[];
  activeSchedulesCount?: number;
  recentLogs?: { id: string; action: string; status: string; createdAt: string; errorMessage?: string | null }[];
}

// -------------------- Stat Card --------------------

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  colorClass: string;
  delay?: number;
}

function StatCard({ title, value, description, icon, colorClass, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.05, ease: 'easeOut' }}
    >
      <Card className="py-4">
        <CardContent className="pb-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {title}
              </p>
              <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <div className={cn('shrink-0 rounded-lg p-2.5', colorClass)}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// -------------------- Chart Config --------------------

const chartConfig = {
  count: {
    label: 'Backups',
    color: 'hsl(var(--chart-1))',
  },
  size: {
    label: 'Storage',
    color: 'hsl(var(--chart-2))',
  },
};

// -------------------- Dashboard Page --------------------

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.backupStats.dashboard(),
    queryFn: () => getApi<BackupStats>('/api/backups/stats'),
    staleTime: 15_000,
  });

  const trendData = useMemo(() => {
    const trend = stats?.storageTrend;
    if (!trend?.length) return [];
    // Group by date and aggregate count + size
    const byDate = new Map<string, { date: string; size: number; count: number }>();
    for (const d of trend) {
      const day = new Date(d.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const existing = byDate.get(day) ?? { date: day, size: 0, count: 0 };
      existing.size += d.size ?? 0;
      existing.count += 1;
      byDate.set(day, existing);
    }
    return Array.from(byDate.values());
  }, [stats?.storageTrend]);

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <PageHeader title="Backups" description="Create and manage database backups" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="py-4">
              <CardContent className="pb-0">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Backups" description="Create and manage database backups" />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Backups"
          value={stats.totalBackups}
          description="All-time backups"
          icon={<DatabaseBackup className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          colorClass="bg-emerald-100 dark:bg-emerald-900/30"
          delay={0}
        />
        <StatCard
          title="Total Storage"
          value={stats.totalStorageFormatted ?? formatFileSize(stats.totalStorageBytes ?? 0)}
          description="Across all backups"
          icon={<HardDrive className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          colorClass="bg-amber-100 dark:bg-amber-900/30"
          delay={1}
        />
        <StatCard
          title="Success Rate"
          value={`${(stats.successRate ?? 0).toFixed(1)}%`}
          description="Completed successfully"
          icon={<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />}
          colorClass="bg-green-100 dark:bg-green-900/30"
          delay={2}
        />
        <StatCard
          title="Avg Duration"
          value={stats.avgDurationFormatted ?? formatDurationMs(stats.avgDurationMs ?? null)}
          description="Per backup"
          icon={<Clock className="h-5 w-5 text-sky-600 dark:text-sky-400" />}
          colorClass="bg-sky-100 dark:bg-sky-900/30"
          delay={3}
        />
        <StatCard
          title="Last Backup"
          value={stats.lastBackup ? formatRelativeTime(stats.lastBackup.createdAt) : 'Never'}
          description={stats.lastBackup ? new Date(stats.lastBackup.createdAt).toLocaleDateString() : 'No backups yet'}
          icon={<DatabaseBackup className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          colorClass="bg-violet-100 dark:bg-violet-900/30"
          delay={4}
        />
        <StatCard
          title="Failed Backups"
          value={stats.failedBackups}
          description={stats.failedBackups === 0 ? 'All healthy' : 'Needs attention'}
          icon={<XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
          colorClass="bg-red-100 dark:bg-red-900/30"
          delay={5}
        />
      </div>

      {/* Trend + Recent Table */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 7-Day Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">7-Day Trend</CardTitle>
            <CardDescription>Backup activity over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <BarChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, name) => {
                          if (name === 'size') return formatFileSize(value as number);
                          return String(value);
                        }}
                      />
                    }
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Table */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest backup operations</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Error</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentLogs && stats.recentLogs.length > 0 ? (
                    stats.recentLogs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium capitalize">{log.action}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={log.status} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-[200px] truncate">
                          {log.errorMessage || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                          {formatRelativeTime(log.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        No backup activity yet. Create your first backup to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
