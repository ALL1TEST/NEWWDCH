'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  HeartPulse,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Database,
  ListTodo,
  Server,
  Bell,
  XCircle,
  FileWarning,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime } from '@/lib/utils';

// -------------------- Types --------------------

interface SystemHealth {
  status: string;
  totalDependencies: number;
  healthyCount: number;
  degradedCount: number;
  downCount: number;
}

interface OverviewData {
  systemHealth: SystemHealth;
  cpu: { usage: number; cores: number };
  ram: { total: number; used: number; free: number; usagePercent: number };
  disk: { total: number; used: number; free: number; usagePercent: number };
  network: { inBytes: number; outBytes: number };
  queueStats: Record<string, number>;
  cacheStatus: string;
  totalAlerts: number;
  failedJobs: number;
  errorLogs24h: number;
  aiRequestsToday: number;
  recentActivity: AuditEntry[];
  activeAlerts: AlertEntry[];
}

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  details: string | null;
  user: { name: string; avatar?: string } | null;
  createdAt: string;
}

interface AlertEntry {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
}

// -------------------- Helpers --------------------

function getHealthColor(status: string) {
  if (status === 'HEALTHY' || status === 'UP' || status === 'OK') return 'green';
  if (status === 'DEGRADED' || status === 'WARNING') return 'amber';
  if (status === 'UNHEALTHY' || status === 'DOWN' || status === 'CRITICAL') return 'red';
  return 'gray';
}

const HEALTH_BORDER: Record<string, string> = {
  green: 'border-green-200 dark:border-green-900/50',
  amber: 'border-amber-200 dark:border-amber-900/50',
  red: 'border-red-200 dark:border-red-900/50',
  gray: 'border-zinc-200 dark:border-zinc-800',
};

const HEALTH_BG: Record<string, string> = {
  green: 'bg-green-50 dark:bg-green-950/30',
  amber: 'bg-amber-50 dark:bg-amber-950/30',
  red: 'bg-red-50 dark:bg-red-950/30',
  gray: 'bg-zinc-50 dark:bg-zinc-900/30',
};

const HEALTH_TEXT: Record<string, string> = {
  green: 'text-green-700 dark:text-green-400',
  amber: 'text-amber-700 dark:text-amber-400',
  red: 'text-red-700 dark:text-red-400',
  gray: 'text-zinc-500 dark:text-zinc-400',
};

function UsageBar({ percent, color }: { percent: number; color: string }) {
  const barColor =
    percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div
        className={cn('h-full rounded-full transition-all', barColor)}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

// -------------------- Overview Page --------------------

export function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.overview(),
    queryFn: () => getApi<OverviewData>('/api/monitoring/overview'),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Monitoring Overview" description="Real-time system health and performance" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const d = data;
  const healthColor = getHealthColor(d?.systemHealth?.status ?? 'UNKNOWN');
  const cpuPct = d?.cpu?.usage ?? 0;
  const ramPct = d?.ram?.usagePercent ?? 0;
  const diskPct = d?.disk?.usagePercent ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring Overview" description="Real-time system health and performance" />

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {/* System Health */}
        <Card className={cn('border', HEALTH_BORDER[healthColor])}>
          <CardContent className={cn('p-4', HEALTH_BG[healthColor])}>
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse className={cn('h-4 w-4', HEALTH_TEXT[healthColor])} />
              <span className="text-xs font-medium text-muted-foreground">System Health</span>
            </div>
            <p className={cn('text-lg font-bold', HEALTH_TEXT[healthColor])}>
              {d?.systemHealth?.status ?? 'UNKNOWN'}
            </p>
          </CardContent>
        </Card>

        {/* CPU */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">CPU Usage</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{cpuPct.toFixed(1)}%</p>
            <UsageBar percent={cpuPct} color="cpu" />
          </CardContent>
        </Card>

        {/* RAM */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MemoryStick className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">RAM Usage</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{ramPct.toFixed(1)}%</p>
            <UsageBar percent={ramPct} color="ram" />
          </CardContent>
        </Card>

        {/* Disk */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Disk Usage</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{diskPct.toFixed(1)}%</p>
            <UsageBar percent={diskPct} color="disk" />
          </CardContent>
        </Card>

        {/* Network */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Network className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Network</span>
            </div>
            <p className={cn('text-lg font-bold', HEALTH_TEXT[getHealthColor(d?.network ? 'UP' : 'DOWN')])}>
              Active
            </p>
          </CardContent>
        </Card>

        {/* DB Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">DB Status</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">Connected</p>
          </CardContent>
        </Card>

        {/* Queue Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Queue Status</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {(d?.queueStats?.ACTIVE ?? 0) + (d?.queueStats?.WAITING ?? 0)} active
            </p>
          </CardContent>
        </Card>

        {/* Cache Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Cache Status</span>
            </div>
            <p className={cn('text-lg font-bold', HEALTH_TEXT[getHealthColor(d?.cacheStatus ?? 'UNKNOWN')])}>
              {d?.cacheStatus ?? 'Unknown'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Total Alerts</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{d?.totalAlerts ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-muted-foreground">Failed Jobs</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{d?.failedJobs ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileWarning className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-muted-foreground">Error Logs (24h)</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{d?.errorLogs24h ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-medium text-muted-foreground">AI Requests Today</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{d?.aiRequestsToday ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Recent Activity + Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {(!d?.recentActivity || d.recentActivity.length === 0) ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                No recent activity
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {d.recentActivity.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{entry.action}</span>
                        <Badge variant="outline" className="text-[10px] border-transparent bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
                          {entry.resourceType}
                        </Badge>
                      </div>
                      {entry.details && (
                        <p className="text-xs text-muted-foreground truncate">{entry.details}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{entry.user?.name ?? 'System'}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(entry.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Active Alerts
              {(d?.activeAlerts?.length ?? 0) > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                  {d?.activeAlerts?.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {(!d?.activeAlerts || d.activeAlerts.length === 0) ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                No active alerts
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {d.activeAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {alert.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(alert.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
