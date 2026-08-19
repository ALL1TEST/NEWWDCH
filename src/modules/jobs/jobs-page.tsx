'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RotateCcw,
  XCircle,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
  ConfirmDialog,
  StatusBadge,
} from '@/components/patterns';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatDate, formatRelativeTime, truncate } from '@/lib/utils';
import type { PaginatedResponse, JobStatus, JobPriority } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import type { ColumnDef } from '@tanstack/react-table';

// -------------------- Types --------------------

interface JobRow {
  id: string;
  type: string;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface JobStats {
  total: number;
  WAITING: number;
  ACTIVE: number;
  COMPLETED: number;
  FAILED: number;
  RETRYING: number;
}

// -------------------- Status Tabs --------------------

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Waiting', value: 'WAITING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Retrying', value: 'RETRYING' },
];

// -------------------- Priority Badge --------------------

function PriorityBadge({ priority }: { priority: JobPriority }) {
  const classes: Record<JobPriority, string> = {
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    NORMAL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    LOW: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    BATCH: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  };
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', classes[priority])}>
      {priority}
    </Badge>
  );
}

// -------------------- Main Component --------------------

export function JobsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const table = useDataTable({ initialSortField: 'createdAt', initialSortOrder: 'desc' });

  const queryParams = useMemo(
    () => ({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
    [table.currentPage, table.pageSize, table.sortField, table.sortOrder, table.searchValue, statusFilter],
  );

  // Fetch jobs
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.jobs.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<JobRow>>('/api/jobs', queryParams),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const jobs = data?.data ?? [];
  const pagination = data?.pagination;

  // Fetch stats
  const { data: jobStats } = useQuery({
    queryKey: ['jobs', 'stats'],
    queryFn: () => getApi<JobStats>('/api/jobs/stats'),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const stats = jobStats ?? { total: 0, WAITING: 0, ACTIVE: 0, COMPLETED: 0, FAILED: 0, RETRYING: 0 };

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/jobs/${id}/retry`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/jobs/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
  });

  const columns: ColumnDef<JobRow>[] = [
    ColumnDefHelper.textColumn<JobRow>({ id: 'type', header: 'Type', accessorKey: 'type', className: 'font-medium font-mono text-sm' }),
    {
      id: 'priority',
      header: 'Priority',
      accessorKey: 'priority',
      enableSorting: false,
      cell: ({ getValue }) => <PriorityBadge priority={getValue() as JobPriority} />,
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} size="sm" />,
    },
    {
      id: 'attempts',
      header: 'Attempts',
      enableSorting: false,
      size: 90,
      cell: ({ row }) => {
        const { attempts, maxAttempts } = row.original;
        return (
          <span className={cn(
            'text-sm tabular-nums',
            attempts >= maxAttempts && 'text-red-500 font-medium',
          )}>
            {attempts}/{maxAttempts}
          </span>
        );
      },
    },
    ColumnDefHelper.dateColumn<JobRow>({ id: 'createdAt', header: 'Created', accessorKey: 'createdAt', format: (d) => formatRelativeTime(d) }),
    ColumnDefHelper.dateColumn<JobRow>({ id: 'startedAt', header: 'Started', accessorKey: 'startedAt', format: (d) => formatRelativeTime(d) }),
    ColumnDefHelper.dateColumn<JobRow>({ id: 'completedAt', header: 'Completed', accessorKey: 'completedAt', format: (d) => formatRelativeTime(d) }),
    ColumnDefHelper.textColumn<JobRow>({ id: 'error', header: 'Error', accessorKey: 'error', truncate: 40, enableSorting: false, className: 'text-red-500 text-xs' }),
    ColumnDefHelper.actionColumn<JobRow>({
      id: 'actions',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.status === 'FAILED' && (
              <DropdownMenuItem onClick={() => retryMutation.mutate(row.id)}>
                <RotateCcw className="h-4 w-4 mr-2" />Retry
              </DropdownMenuItem>
            )}
            {(row.status === 'WAITING' || row.status === 'ACTIVE') && (
              <DropdownMenuItem variant="destructive" onClick={() => cancelMutation.mutate(row.id)}>
                <XCircle className="h-4 w-4 mr-2" />Cancel
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Background Jobs" description="Monitor and manage queued background jobs" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        {(['WAITING', 'ACTIVE', 'COMPLETED', 'FAILED', 'RETRYING'] as const).map((s) => (
          <Card
            key={s}
            className={cn(
              'cursor-pointer transition-colors',
              statusFilter === s && 'ring-2 ring-primary',
            )}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">{stats[s]}</p>
              <p className="text-xs text-muted-foreground">{s.replace(/_/g, ' ')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter(tab.value); table.setCurrentPage(1); }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={jobs}
        isLoading={isLoading}
        totalItems={pagination?.total ?? 0}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        searchPlaceholder="Search jobs..."
        searchValue={table.searchValue}
        onSearch={(v) => { table.setSearchValue(v); table.setCurrentPage(1); }}
        getRowId={(row) => row.id}
        emptyMessage="No jobs found."
      />
    </div>
  );
}
