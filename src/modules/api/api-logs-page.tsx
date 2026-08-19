'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
} from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatFileSize, formatRelativeTime, truncate } from '@/lib/utils';
import { METHOD_COLORS } from '@/lib/api-constants';
import { STATUS_COLORS } from '@/shared/constants';
import type { ColumnDef } from '@tanstack/react-table';

// -------------------- Types --------------------

interface ApiLogApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  type: string;
}

interface ApiLogRow {
  id: string;
  apiKeyId: string;
  method: string;
  path: string;
  query: string | null;
  statusCode: number;
  duration: number;
  requestSize: number;
  responseSize: number;
  ipAddress: string;
  country: string | null;
  userAgent: string;
  browser: string | null;
  device: string | null;
  siteId: string | null;
  userId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  apiKey: ApiLogApiKey | null;
}

interface ApiLogStats {
  totalRequests: number;
  avgDuration: number;
  totalRequestSize: number;
  totalResponseSize: number;
  errorCount: number;
  successRate: number;
}

interface ApiLogsMeta {
  requestId: string;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: ApiLogStats;
}

interface ApiLogsResponse {
  data: ApiLogRow[];
  meta: ApiLogsMeta;
}

// -------------------- Constants --------------------

const HTTP_METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const STATUS_CODE_RANGES = [
  { label: 'All', value: 'all' },
  { label: '2xx', value: '2xx' },
  { label: '4xx', value: '4xx' },
  { label: '5xx', value: '5xx' },
] as const;

function getStatusCodeColor(code: number): string {
  if (code >= 200 && code < 300) return STATUS_COLORS.PUBLISHED;
  if (code >= 400 && code < 500) return STATUS_COLORS.IN_REVIEW;
  if (code >= 500) return STATUS_COLORS.FAILED;
  return STATUS_COLORS.DRAFT;
}

// -------------------- Method Badge --------------------

function MethodBadge({ method }: { method: string }) {
  const colorClass = METHOD_COLORS[method.toUpperCase()] ?? METHOD_COLORS.GET;
  return (
    <Badge variant="outline" className={cn('border-transparent font-semibold text-xs px-2 py-0', colorClass)}>
      {method.toUpperCase()}
    </Badge>
  );
}

// -------------------- Status Code Badge --------------------

function StatusCodeBadge({ code }: { code: number }) {
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium tabular-nums', getStatusCodeColor(code))}>
      {code}
    </Badge>
  );
}

// -------------------- Stats Card --------------------

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}

function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <Card className="bg-background">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
          {subtext && (
            <p className="text-xs text-muted-foreground truncate">{subtext}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------- Stats Bar --------------------

function StatsBar({ stats, isLoading }: { stats?: ApiLogStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="bg-background">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                <div className="h-5 w-20 bg-muted rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const totalBandwidth = (stats.totalRequestSize ?? 0) + (stats.totalResponseSize ?? 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard
        icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        label="Total Requests"
        value={stats.totalRequests.toLocaleString()}
      />
      <StatCard
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        label="Avg Duration"
        value={`${Math.round(stats.avgDuration ?? 0)}ms`}
      />
      <StatCard
        icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
        label="Total Bandwidth"
        value={formatFileSize(totalBandwidth)}
        subtext={`${formatFileSize(stats.totalRequestSize ?? 0)} in / ${formatFileSize(stats.totalResponseSize ?? 0)} out`}
      />
      <StatCard
        icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        label="Error Count"
        value={stats.errorCount.toLocaleString()}
        subtext={stats.totalRequests > 0 ? `${((stats.errorCount / stats.totalRequests) * 100).toFixed(1)}% of total` : undefined}
      />
      <StatCard
        icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        label="Success Rate"
        value={`${Number(stats.successRate).toFixed(1)}%`}
      />
    </div>
  );
}

// -------------------- Main Component --------------------

export function ApiLogsPage() {
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [statusCodeFilter, setStatusCodeFilter] = useState<string>('all');
  const [searchValue, setSearchValue] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const table = useDataTable({
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
    initialPageSize: 50,
  });

  const queryParams = useMemo(
    () => ({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      method: methodFilter !== 'ALL' ? methodFilter : undefined,
      statusCode: statusCodeFilter !== 'all' ? statusCodeFilter : undefined,
      search: searchValue || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [table.currentPage, table.pageSize, table.sortField, table.sortOrder, methodFilter, statusCodeFilter, searchValue, dateFrom, dateTo],
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.apiLogs.list(queryParams),
    queryFn: () => getApi<ApiLogsResponse>('/api/api-logs', queryParams, { raw: true }),
    staleTime: 10_000,
  });

  const apiLogs = data?.data ?? [];
  const pagination = data?.meta?.pagination;
  const stats = data?.meta?.stats;

  const hasActiveFilters = methodFilter !== 'ALL' || statusCodeFilter !== 'all' || searchValue !== '' || dateFrom !== '' || dateTo !== '';

  const clearFilters = useCallback(() => {
    setMethodFilter('ALL');
    setStatusCodeFilter('all');
    setSearchValue('');
    setDateFrom('');
    setDateTo('');
    table.setCurrentPage(1);
  }, [table]);

  const columns = useMemo<ColumnDef<ApiLogRow>[]>(
    () => [
      {
        id: 'method',
        header: 'Method',
        accessorKey: 'method',
        enableSorting: true,
        size: 90,
        cell: ({ getValue }) => <MethodBadge method={getValue() as string} />,
      },
      {
        id: 'path',
        header: 'Path',
        accessorFn: (row) => `${row.path}${row.query ? `?${row.query}` : ''}`,
        enableSorting: true,
        size: 260,
        cell: ({ row }) => (
          <span className="font-mono text-xs break-all" title={`${row.original.path}${row.original.query ? `?${row.original.query}` : ''}`}>
            {row.original.path}
            {row.original.query && (
              <span className="text-muted-foreground">?{truncate(row.original.query, 40)}</span>
            )}
          </span>
        ),
      },
      {
        id: 'statusCode',
        header: 'Status',
        accessorKey: 'statusCode',
        enableSorting: true,
        size: 80,
        cell: ({ getValue }) => <StatusCodeBadge code={getValue() as number} />,
      },
      {
        id: 'duration',
        header: 'Duration',
        accessorKey: 'duration',
        enableSorting: true,
        size: 90,
        cell: ({ getValue }) => {
          const ms = getValue() as number;
          const color = ms > 5000 ? 'text-red-600 dark:text-red-400' : ms > 1000 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground';
          return (
            <span className={cn('text-xs tabular-nums', color)}>
              {ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`}
            </span>
          );
        },
      },
      {
        id: 'requestSize',
        header: 'Req Size',
        accessorKey: 'requestSize',
        enableSorting: true,
        size: 90,
        cell: ({ getValue }) => {
          const size = getValue() as number;
          return <span className="text-xs text-muted-foreground tabular-nums">{formatFileSize(size)}</span>;
        },
      },
      {
        id: 'responseSize',
        header: 'Res Size',
        accessorKey: 'responseSize',
        enableSorting: true,
        size: 90,
        cell: ({ getValue }) => {
          const size = getValue() as number;
          return <span className="text-xs text-muted-foreground tabular-nums">{formatFileSize(size)}</span>;
        },
      },
      {
        id: 'ipAddress',
        header: 'IP',
        accessorKey: 'ipAddress',
        enableSorting: false,
        size: 130,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono text-muted-foreground" title={row.original.country || undefined}>
              {row.original.ipAddress}
            </span>
          </div>
        ),
      },
      {
        id: 'userAgent',
        header: 'User Agent',
        accessorKey: 'userAgent',
        enableSorting: false,
        size: 180,
        cell: ({ row }) => {
          const ua = row.original.userAgent;
          if (!ua) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-xs text-muted-foreground truncate block max-w-[160px]" title={ua}>
              {ua}
            </span>
          );
        },
      },
      {
        id: 'apiKey',
        header: 'API Key',
        enableSorting: false,
        size: 160,
        cell: ({ row }) => {
          const key = row.original.apiKey;
          if (!key) return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium truncate max-w-[140px]" title={key.name}>
                {key.name}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {key.keyPrefix}…
              </span>
            </div>
          );
        },
      },
      ColumnDefHelper.dateColumn<ApiLogRow>({
        id: 'createdAt',
        header: 'Date',
        accessorKey: 'createdAt',
        format: (d) => formatRelativeTime(d),
        size: 150,
      }),
    ],
    [],
  );

  const filterContent = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger size="sm" className="w-[120px] h-9">
          <SelectValue placeholder="All Methods" />
        </SelectTrigger>
        <SelectContent>
          {HTTP_METHODS.map((m) => (
            <SelectItem key={m} value={m}>{m === 'ALL' ? 'All Methods' : m}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusCodeFilter} onValueChange={(v) => { setStatusCodeFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger size="sm" className="w-[100px] h-9">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_CODE_RANGES.map((range) => (
            <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Search path..."
        value={searchValue}
        onChange={(e) => { setSearchValue(e.target.value); table.setCurrentPage(1); }}
        className="w-[180px] h-9 text-sm"
      />

      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => { setDateFrom(e.target.value); table.setCurrentPage(1); }}
        className="w-[140px] h-9 text-sm"
        title="From date"
      />

      <Input
        type="date"
        value={dateTo}
        onChange={(e) => { setDateTo(e.target.value); table.setCurrentPage(1); }}
        className="w-[140px] h-9 text-sm"
        title="To date"
      />

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3 mr-1" />
          Clear Filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="API Logs"
        description="Monitor and inspect all API requests, performance, and errors"
      />

      <StatsBar stats={stats} isLoading={isLoading} />

      <DataTable
        columns={columns}
        data={apiLogs}
        isLoading={isLoading}
        totalItems={pagination?.total ?? 0}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        filterContent={filterContent}
        getRowId={(row) => row.id}
        emptyMessage="No API logs found matching your filters."
      />
    </div>
  );
}
