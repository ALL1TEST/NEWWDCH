'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  MousePointerClick,
  Eye,
  TrendingUp,
  Target,
  Link2,
  Loader2,
  RefreshCw,
  Plug,
  Unplug,
  Search,
  Globe,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ==================== Types ====================

interface SearchConsoleConnection {
  id: string;
  siteUrl: string;
  status: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SearchConsoleSummary {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
}

interface SearchConsoleData {
  connection: SearchConsoleConnection;
  summary: SearchConsoleSummary;
}

interface DailyStat {
  date: string;
  clicks: number;
  impressions: number;
}

interface QueryItem {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PageItem {
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PaginatedList<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ==================== Helpers ====================

function formatNumber(n: number | null | undefined): string {
  const num = n ?? 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(n: number | null | undefined): string {
  return `${((n ?? 0) * 100).toFixed(2)}%`;
}

function formatPosition(n: number | null | undefined): string {
  return (n ?? 0).toFixed(1);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ==================== Connection Badge ====================

function ConnectionBadge({ status }: { status: string }) {
  switch (status) {
    case 'CONNECTED':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent font-medium gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Connected
        </Badge>
      );
    case 'EXPIRED':
      return (
        <Badge variant="destructive" className="font-medium gap-1">
          <XCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="font-medium gap-1">
          <XCircle className="h-3 w-3" />
          Disconnected
        </Badge>
      );
  }
}

// ==================== KPI Card ====================

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor?: string;
  iconBg?: string;
}

function KpiCard({ icon: Icon, label, value, iconColor, iconBg }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconBg ?? 'bg-muted',
          )}
        >
          <Icon className={cn('h-5 w-5', iconColor ?? 'text-muted-foreground')} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">{value}</p>
        </div>
      </div>
    </Card>
  );
}

// ==================== CSS Bar Chart ====================

function PerformanceChart({ stats, isLoading }: { stats: DailyStat[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-muted-foreground">No performance data available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Sync with Search Console to see chart data
        </p>
      </div>
    );
  }

  const maxClicks = Math.max(...stats.map((s) => s.clicks), 1);
  const maxImpressions = Math.max(...stats.map((s) => s.impressions), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
            Clicks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/30" />
            Impressions
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] font-normal bg-background/80">
          Last 14 days
        </Badge>
      </div>

      <div className="flex items-end gap-[3px] sm:gap-1.5 h-48">
        {stats.map((stat) => {
          const clickHeight = Math.max((stat.clicks / maxClicks) * 100, stat.clicks > 0 ? 4 : 0);
          const impHeight = Math.max((stat.impressions / maxImpressions) * 100, stat.impressions > 0 ? 4 : 0);

          return (
            <div
              key={stat.date}
              className="flex-1 flex flex-col items-center gap-0.5 group relative min-w-0"
            >
              {/* Tooltip */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center gap-0.5 bg-popover border rounded-md shadow-md px-2 py-1.5 z-10 pointer-events-none">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatShortDate(stat.date)}
                </span>
                <span className="text-[10px] font-medium">
                  {stat.clicks} clicks · {stat.impressions} imp
                </span>
              </div>

              {/* Bars container */}
              <div className="flex items-end gap-[1px] w-full">
                {/* Impressions bar (wider, lighter) */}
                <div
                  className="flex-1 rounded-t-sm bg-primary/20 transition-all duration-300"
                  style={{ height: `${impHeight * 0.85}%` }}
                />
                {/* Clicks bar (narrower, solid) */}
                <div
                  className="w-[40%] rounded-t-sm bg-primary transition-all duration-300"
                  style={{ height: `${clickHeight}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        <span>{formatShortDate(stats[0]?.date ?? '')}</span>
        <span>{formatShortDate(stats[stats.length - 1]?.date ?? '')}</span>
      </div>
    </div>
  );
}

// ==================== Queries Table ====================

function QueriesTable({ queries, isLoading }: { queries: QueryItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (queries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">No query data available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Sync with Search Console to see search queries
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Query</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Impressions</TableHead>
            <TableHead className="text-right hidden md:table-cell">CTR</TableHead>
            <TableHead className="text-right hidden lg:table-cell">Position</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queries.map((item, i) => (
            <TableRow key={`${item.query}-${i}`}>
              <TableCell className="font-medium max-w-[240px] truncate" title={item.query}>
                {item.query}
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums hidden sm:table-cell">
                {item.impressions.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden md:table-cell">
                {formatPercent(item.ctr)}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden lg:table-cell">
                {formatPosition(item.position)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ==================== Pages Table ====================

function PagesTable({ pages, isLoading }: { pages: PageItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Link2 className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">No page data available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Sync with Search Console to see page data
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page URL</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Impressions</TableHead>
            <TableHead className="text-right hidden md:table-cell">CTR</TableHead>
            <TableHead className="text-right hidden lg:table-cell">Position</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((item, i) => (
            <TableRow key={`${item.pageUrl}-${i}`}>
              <TableCell className="font-mono text-xs max-w-[280px] truncate" title={item.pageUrl}>
                <span className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  {item.pageUrl}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums hidden sm:table-cell">
                {item.impressions.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden md:table-cell">
                {formatPercent(item.ctr)}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden lg:table-cell">
                {formatPosition(item.position)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ==================== Loading Skeleton ====================

function SearchConsoleSkeleton() {
  return (
    <div className="space-y-6">
      {/* Connection card skeleton */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-6 w-28" />
        </div>
      </Card>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      {/* Chart skeleton */}
      <Card className="p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-48 w-full" />
      </Card>
    </div>
  );
}

// ==================== Main Page ====================

export function SeoSearchConsolePage() {
  return <SeoSearchConsolePageInner />;
}

function SeoSearchConsolePageInner() {
  const queryClient = useQueryClient();
  const [connectUrl, setConnectUrl] = useState('');

  // Main query
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.seoSearchConsole.all,
    queryFn: () => getApi<SearchConsoleData>('/api/seo/search-console'),
    staleTime: 30_000,
  });

  // Stats query (14 days)
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.seoSearchConsoleStats.list(14),
    queryFn: () => getApi<DailyStat[]>('/api/seo/search-console/stats', { days: 14 }),
    staleTime: 60_000,
    enabled: data?.connection?.status === 'CONNECTED',
  });

  // Queries query
  const { data: queriesData, isLoading: queriesLoading } = useQuery({
    queryKey: queryKeys.seoSearchConsoleQueries.list({ page: 1, pageSize: 10 }),
    queryFn: () => getApi<PaginatedList<QueryItem>>('/api/seo/search-console/queries', { page: 1, pageSize: 10 }),
    staleTime: 60_000,
    enabled: data?.connection?.status === 'CONNECTED',
  });

  // Pages query
  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: queryKeys.seoSearchConsolePages.list({ page: 1, pageSize: 10 }),
    queryFn: () => getApi<PaginatedList<PageItem>>('/api/seo/search-console/pages', { page: 1, pageSize: 10 }),
    staleTime: 60_000,
    enabled: data?.connection?.status === 'CONNECTED',
  });

  const isConnected = data?.connection?.status === 'CONNECTED';
  const connection = data?.connection;
  const summary = data?.summary;

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: () => postApi('/api/seo/search-console', { siteUrl: connectUrl }),
    onSuccess: () => {
      setConnectUrl('');
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      toast.success('Search Console connected successfully');
    },
    onError: () => {
      toast.error('Failed to connect Search Console');
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => deleteApi('/api/seo/search-console'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      toast.success('Search Console disconnected');
    },
    onError: () => {
      toast.error('Failed to disconnect Search Console');
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => patchApi('/api/seo/search-console?action=sync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleQueries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsolePages.all });
      toast.success('Search Console data synced successfully');
    },
    onError: () => {
      toast.error('Failed to sync Search Console data');
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Console"
        description="Monitor your site's performance in Google Search"
      />

      {/* Error state */}
      {error && (
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Failed to load Search Console data. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SearchConsoleSkeleton />
      ) : data ? (
        <>
          {/* Connection Status Card */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  isConnected
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-zinc-100 dark:bg-zinc-800',
                )}>
                  <Plug className={cn(
                    'h-5 w-5',
                    isConnected
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-muted-foreground',
                  )} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">Connection Status</h3>
                    <ConnectionBadge status={connection?.status ?? 'DISCONNECTED'} />
                  </div>
                  {connection?.siteUrl && isConnected && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {connection.siteUrl}
                    </p>
                  )}
                  {connection?.lastSyncAt && isConnected && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Last synced: {formatDate(connection.lastSyncAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isConnected ? (
                  <>
                    <Button
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending}
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Unplug className="h-4 w-4 mr-2" />
                      )}
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input
                      placeholder="https://yourdomain.com"
                      value={connectUrl}
                      onChange={(e) => setConnectUrl(e.target.value)}
                      className="h-9 w-full sm:w-64 font-mono text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && connectUrl.trim()) {
                          connectMutation.mutate();
                        }
                      }}
                    />
                    <Button
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending || !connectUrl.trim()}
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plug className="h-4 w-4 mr-2" />
                      )}
                      Connect
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* KPI Stats Cards — Only when connected */}
          {isConnected && summary && (
            <section>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  icon={MousePointerClick}
                  label="Total Clicks"
                  value={formatNumber(summary.totalClicks)}
                  iconColor="text-green-600 dark:text-green-400"
                  iconBg="bg-green-100 dark:bg-green-900/30"
                />
                <KpiCard
                  icon={Eye}
                  label="Total Impressions"
                  value={formatNumber(summary.totalImpressions)}
                  iconColor="text-emerald-600 dark:text-emerald-400"
                  iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                />
                <KpiCard
                  icon={TrendingUp}
                  label="Average CTR"
                  value={formatPercent(summary.averageCtr)}
                  iconColor="text-amber-600 dark:text-amber-400"
                  iconBg="bg-amber-100 dark:bg-amber-900/30"
                />
                <KpiCard
                  icon={Target}
                  label="Average Position"
                  value={formatPosition(summary.averagePosition)}
                  iconColor="text-sky-600 dark:text-sky-400"
                  iconBg="bg-sky-100 dark:bg-sky-900/30"
                />
              </div>
            </section>
          )}

          {/* Performance Chart */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Performance Chart</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <PerformanceChart
                stats={statsData ?? []}
                isLoading={statsLoading}
              />
            </CardContent>
          </Card>

          {/* Top Search Queries */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Top Search Queries</CardTitle>
                <Badge variant="outline" className="text-[10px] font-normal">
                  Top 10
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <QueriesTable
                queries={queriesData?.data ?? []}
                isLoading={queriesLoading}
              />
            </CardContent>
          </Card>

          {/* Top Pages */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Top Pages</CardTitle>
                <Badge variant="outline" className="text-[10px] font-normal">
                  Top 10
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <PagesTable
                pages={pagesData?.data ?? []}
                isLoading={pagesLoading}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
