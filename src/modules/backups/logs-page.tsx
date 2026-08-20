'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileText,
  Filter,
  CalendarRange,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
  EmptyState,
  StatusBadge,
} from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatFileSize, formatRelativeTime, labelize } from '@/lib/utils';
import { formatDurationMs } from '@/lib/backup-constants';
import type { PaginatedResponse } from '@/shared/types';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

// -------------------- Types --------------------

interface LogRow {
  id: string;
  action: string;
  status: string;
  backupId: string | null;
  backupName: string | null;
  databaseSize: number | null;
  fileCount: number | null;
  durationMs: number | null;
  storageProvider: string | null;
  verificationResult: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// -------------------- Filter Options --------------------

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'RESTORE', label: 'Restore' },
  { value: 'VERIFY', label: 'Verify' },
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'SCHEDULE', label: 'Schedule' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
];

// -------------------- Logs Page --------------------

export function LogsPage() {
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const table = useDataTable({ initialSortField: 'createdAt', initialSortOrder: 'desc' });

  const queryParams = useMemo(
    () => ({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
      action: actionFilter !== 'all' ? actionFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    }),
    [table.currentPage, table.pageSize, table.sortField, table.sortOrder, table.searchValue, actionFilter, statusFilter, fromDate, toDate],
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.backupLogs.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<LogRow>>('/api/backups/logs', queryParams),
    staleTime: 10_000,
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  const handleExport = () => {
    // Export logs as CSV
    if (logs.length === 0) {
      toast.info('No logs to export');
      return;
    }
    const headers = ['Action', 'Status', 'Backup Name', 'DB Size', 'File Count', 'Duration', 'Provider', 'Verification', 'Error', 'Created'];
    const rows = logs.map((log) => [
      log.action,
      log.status,
      log.backupName || '',
      log.databaseSize ? formatFileSize(log.databaseSize) : '',
      log.fileCount?.toString() || '',
      formatDurationMs(log.durationMs),
      log.storageProvider || '',
      log.verificationResult || '',
      log.errorMessage?.replace(/"/g, '""') || '',
      log.createdAt,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported');
  };

  const columns = useMemo<ColumnDef<LogRow>[]>(
    () => [
      {
        id: 'action',
        header: 'Action',
        accessorKey: 'action',
        size: 120,
        cell: ({ getValue }) => (
          <Badge
            variant="outline"
            className={cn(
              'border-transparent font-medium',
              getValue() === 'CREATE'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : getValue() === 'RESTORE'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : getValue() === 'VERIFY'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                    : getValue() === 'DELETE'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            )}
          >
            {labelize(getValue() as string)}
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        size: 120,
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} size="sm" />,
      },
      {
        id: 'backupName',
        header: 'Backup Name',
        accessorKey: 'backupName',
        className: 'font-medium',
        size: 180,
      },
      {
        id: 'databaseSize',
        header: 'DB Size',
        accessorKey: 'databaseSize',
        enableSorting: false,
        size: 100,
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return (
            <span className="tabular-nums text-xs text-muted-foreground">
              {val ? formatFileSize(val) : '—'}
            </span>
          );
        },
      },
      {
        id: 'fileCount',
        header: 'Files',
        accessorKey: 'fileCount',
        enableSorting: false,
        size: 80,
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return (
            <span className="tabular-nums text-xs text-muted-foreground">
              {val !== null ? val : '—'}
            </span>
          );
        },
      },
      {
        id: 'durationMs',
        header: 'Duration',
        accessorKey: 'durationMs',
        enableSorting: false,
        size: 90,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-xs text-muted-foreground">
            {formatDurationMs(getValue() as number | null)}
          </span>
        ),
      },
      {
        id: 'storageProvider',
        header: 'Provider',
        accessorKey: 'storageProvider',
        enableSorting: false,
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {getValue() ? labelize(getValue() as string) : '—'}
          </span>
        ),
      },
      {
        id: 'verificationResult',
        header: 'Verification',
        accessorKey: 'verificationResult',
        enableSorting: false,
        size: 110,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          if (!val) return <span className="text-muted-foreground text-xs">—</span>;
          return <StatusBadge status={val} size="sm" />;
        },
      },
      {
        id: 'errorMessage',
        header: 'Error',
        accessorKey: 'errorMessage',
        enableSorting: false,
        size: 200,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          if (!val) return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <span className="text-xs text-red-600 dark:text-red-400" title={val}>
              {val.length > 50 ? val.slice(0, 50) + '...' : val}
            </span>
          );
        },
      },
      ColumnDefHelper.dateColumn<LogRow>({
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        format: (d) => formatRelativeTime(d),
        size: 140,
      }),
    ],
    [],
  );

  const filterContent = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue placeholder="Action" />
        </SelectTrigger>
        <SelectContent>
          {ACTION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger className="h-9 w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); table.setCurrentPage(1); }}
          className="h-9 w-[140px] text-xs"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); table.setCurrentPage(1); }}
          className="h-9 w-[140px] text-xs"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Backup Logs"
        description="View activity logs for all backup operations"
        action={
          <Button size="sm" variant="outline" onClick={handleExport} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      {logs.length === 0 && !isLoading ? (
        <EmptyState
          icon={FileText}
          title="No log entries yet"
          description="Backup activity logs will appear here once operations are performed."
        />
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          isLoading={isLoading}
          totalItems={pagination?.total ?? 0}
          pageSize={table.pageSize}
          currentPage={table.currentPage}
          onPageChange={(p) => table.setCurrentPage(p)}
          onSortChange={(f, o) => table.setSortField(f, o)}
          sortField={table.sortField}
          sortOrder={table.sortOrder}
          searchPlaceholder="Search logs..."
          searchValue={table.searchValue}
          onSearch={(v) => {
            table.setSearchValue(v);
            table.setCurrentPage(1);
          }}
          filterContent={filterContent}
          getRowId={(row) => row.id}
          emptyMessage="No log entries found."
        />
      )}
    </div>
  );
}
