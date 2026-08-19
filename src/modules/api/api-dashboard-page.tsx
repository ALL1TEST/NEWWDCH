'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Key,
  KeyRound,
  Timer,
  Activity,
  Gauge,
  AlertOctagon,
  Wifi,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils';
import { METHOD_COLORS } from '@/lib/api-constants';

// -------------------- Types --------------------

interface ApiDashboardData {
  keys: {
    total: number;
    active: number;
    inactive: number;
    revoked: number;
    expired: number;
  };
  requests: {
    today: number;
    total: number;
    errorsToday: number;
    errorRate: number;
    avgLatencyMs: number;
  };
  bandwidth: {
    requestBytes24h: number;
    responseBytes24h: number;
    totalBytes24h: number;
  };
  tokens: {
    personalAccessTokens: number;
    oauthClients: number;
  };
  hourlyData: {
    hour: string;
    requests: number;
    errors: number;
  }[];
  topEndpoints: {
    path: string;
    method: string;
    requests: number;
    avgDuration: number;
  }[];
  topKeys: {
    id: string;
    name: string;
    keyPrefix: string;
    totalRequests: number;
    totalErrors: number;
    lastUsedAt: string | null;
    lastUsedIp: string | null;
  }[];
}

// -------------------- Helpers --------------------

function formatBytes(bytes: number): string {
  return formatFileSize(bytes);
}

function formatLatency(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}



// -------------------- Stat Card --------------------

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  colorClass: string;
}

function StatCard({ title, value, description, icon, colorClass }: StatCardProps) {
  return (
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
  );
}

// -------------------- Loading Skeleton --------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="API Dashboard" description="API module overview and analytics" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="py-4">
            <CardContent className="pb-0">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="h-[300px] animate-pulse bg-muted rounded" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="h-[300px] animate-pulse bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// -------------------- Custom Tooltip --------------------

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function ChartTooltipContent({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium tabular-nums">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// -------------------- Dashboard Page --------------------

export function ApiDashboardPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: queryKeys.apiDashboard.all,
    queryFn: () => getApi<ApiDashboardData>('/api/api-dashboard'),
    staleTime: 15_000,
  });

  const chartData = useMemo(() => {
    if (!dashboard?.hourlyData?.length) return [];
    return dashboard.hourlyData.map((d) => ({
      ...d,
      hour: d.hour.replace(/^0/, ''),
    }));
  }, [dashboard]);

  if (isLoading || !dashboard) {
    return <LoadingSkeleton />;
  }

  const { keys, requests, bandwidth } = dashboard;
  const errorRateNum = Number(requests.errorRate) || 0;

  return (
    <div className="space-y-6">
      <PageHeader title="API Dashboard" description="API module overview and analytics" />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total API Keys"
          value={keys.total}
          description={`${keys.active} active, ${keys.inactive} inactive`}
          icon={<Key className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          colorClass="bg-emerald-100 dark:bg-emerald-900/30"
        />
        <StatCard
          title="Active Keys"
          value={keys.active}
          description="Currently usable"
          icon={<KeyRound className="h-5 w-5 text-green-600 dark:text-green-400" />}
          colorClass="bg-green-100 dark:bg-green-900/30"
        />
        <StatCard
          title="Revoked Keys"
          value={keys.revoked}
          description={keys.revoked === 0 ? 'All clean' : 'Needs review'}
          icon={<Key className="h-5 w-5 text-red-600 dark:text-red-400" />}
          colorClass="bg-red-100 dark:bg-red-900/30"
        />
        <StatCard
          title="Expired Keys"
          value={keys.expired}
          description="Past expiration date"
          icon={<Timer className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          colorClass="bg-orange-100 dark:bg-orange-900/30"
        />
        <StatCard
          title="Requests Today"
          value={requests.today.toLocaleString()}
          description={`${requests.total.toLocaleString()} total all-time`}
          icon={<Activity className="h-5 w-5 text-sky-600 dark:text-sky-400" />}
          colorClass="bg-sky-100 dark:bg-sky-900/30"
        />
        <StatCard
          title="Average Latency"
          value={formatLatency(requests.avgLatencyMs)}
          description={requests.errorsToday > 0 ? `${requests.errorsToday} errors today` : 'All requests healthy'}
          icon={<Gauge className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          colorClass="bg-violet-100 dark:bg-violet-900/30"
        />
        <StatCard
          title="Error Rate"
          value={`${errorRateNum.toFixed(2)}%`}
          description={errorRateNum < 1 ? 'Within normal range' : errorRateNum < 5 ? 'Elevated' : 'High — investigate'}
          icon={<AlertOctagon className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          colorClass="bg-amber-100 dark:bg-amber-900/30"
        />
        <StatCard
          title="Bandwidth (24h)"
          value={formatBytes(bandwidth.totalBytes24h)}
          description={`↑ ${formatBytes(bandwidth.requestBytes24h)} · ↓ ${formatBytes(bandwidth.responseBytes24h)}`}
          icon={<Wifi className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          colorClass="bg-teal-100 dark:bg-teal-900/30"
        />
      </div>

      {/* Hourly Requests Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hourly Requests vs Errors (Last 24h)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="hour"
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
                <Tooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="requests"
                  name="Requests"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="errors"
                  name="Errors"
                  fill="hsl(var(--chart-5))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              No hourly data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Row: Top Endpoints + Top API Keys */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Endpoint</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium text-right">Requests</th>
                    <th className="px-4 py-3 font-medium text-right">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.topEndpoints?.length > 0 ? (
                    dashboard.topEndpoints.map((ep, i) => (
                      <tr
                        key={`${ep.method}-${ep.path}-${i}`}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]">
                          {ep.path}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-bold border-transparent px-1.5',
                              METHOD_COLORS[ep.method] ?? METHOD_COLORS.GET,
                            )}
                          >
                            {ep.method}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {ep.requests.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatLatency(ep.avgDuration)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        No endpoint data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top API Keys</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Prefix</th>
                    <th className="px-4 py-3 font-medium text-right">Requests</th>
                    <th className="px-4 py-3 font-medium text-right">Errors</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.topKeys?.length > 0 ? (
                    dashboard.topKeys.map((key) => (
                      <tr
                        key={key.id}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium truncate max-w-[140px]">
                          {key.name}
                        </td>
                        <td className="px-4 py-3">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                            {key.keyPrefix}...
                          </code>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {key.totalRequests.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {key.totalErrors > 0 ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] border-transparent',
                                key.totalErrors > 10
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              )}
                            >
                              {key.totalErrors}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                          {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : 'Never'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        No API key data available
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
