'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
  StatusBadge,
} from '@/components/patterns';
import { AvatarWithFallback } from '@/components/shared';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatDateTime, truncate } from '@/lib/utils';
import type { PaginatedResponse } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import type { ColumnDef } from '@tanstack/react-table';

// -------------------- Types --------------------

interface AuditLogUser {
  id: string;
  name: string;
  avatar?: string;
}

interface AuditLogRow {
  id: string;
  timestamp: string;
  user: AuditLogUser;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  details: Record<string, unknown>;
}

// -------------------- Resource Types --------------------

const RESOURCE_TYPES = [
  'Content',
  'Media',
  'User',
  'Category',
  'Tag',
  'Comment',
  'Form',
  'Webhook',
  'Setting',
  'Theme',
  'Backup',
  'ApiKey',
  'Navigation',
  'Newsletter',
];

// -------------------- Action Badge --------------------

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  LOGIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  LOGOUT: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  PUBLISH: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  RESTORE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  EXPORT: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  IMPORT: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

function ActionBadge({ action }: { action: string }) {
  const colorClass = ACTION_COLORS[action.toUpperCase()] ?? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', colorClass)}>
      {action}
    </Badge>
  );
}

// -------------------- Main Component --------------------

export function AuditPage() {
  const [actionSearch, setActionSearch] = useState('');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const table = useDataTable({ initialSortField: 'timestamp', initialSortOrder: 'desc' });

  const queryParams = useMemo(
    () => ({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
      action: actionSearch || undefined,
      userId: userFilter !== 'all' ? userFilter : undefined,
      resourceType: resourceTypeFilter !== 'all' ? resourceTypeFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [table.currentPage, table.pageSize, table.sortField, table.sortOrder, table.searchValue, actionSearch, userFilter, resourceTypeFilter, dateFrom, dateTo],
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.auditLog.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<AuditLogRow>>('/api/audit-logs', queryParams),
    staleTime: 10_000,
  });

  const auditLogs = data?.data ?? [];
  const pagination = data?.pagination;

  // Fetch users for filter
  const { data: users } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => getApi<AuditLogUser[]>('/api/users?pageSize=100'),
    staleTime: 60_000,
  });

  const columns = useMemo<ColumnDef<AuditLogRow>[]>(
    () => [
      ColumnDefHelper.dateColumn<AuditLogRow>({
        id: 'timestamp',
        header: 'Timestamp',
        accessorKey: 'timestamp',
        format: (d) => formatDateTime(d),
        size: 170,
      }),
      {
        id: 'user',
        header: 'User',
        accessorFn: (row) => row.user?.name ?? 'System',
        enableSorting: false,
        size: 180,
        cell: ({ row }) => {
          const user = row.original.user;
          return (
            <div className="flex items-center gap-2">
              <AvatarWithFallback src={user?.avatar} name={user?.name ?? 'System'} size="sm" />
              <span className="text-sm truncate max-w-[120px]">{user?.name ?? 'System'}</span>
            </div>
          );
        },
      },
      {
        id: 'action',
        header: 'Action',
        accessorKey: 'action',
        enableSorting: false,
        cell: ({ getValue }) => <ActionBadge action={getValue() as string} />,
      },
      ColumnDefHelper.textColumn<AuditLogRow>({ id: 'resourceType', header: 'Resource Type', accessorKey: 'resourceType', enableSorting: false }),
      ColumnDefHelper.textColumn<AuditLogRow>({ id: 'resourceId', header: 'Resource ID', accessorKey: 'resourceId', truncate: 20, enableSorting: false, className: 'font-mono text-xs' }),
      ColumnDefHelper.textColumn<AuditLogRow>({ id: 'ipAddress', header: 'IP Address', accessorKey: 'ipAddress', enableSorting: false, className: 'font-mono text-xs', size: 130 }),
      {
        id: 'details',
        header: 'Details',
        enableSorting: false,
        size: 200,
        cell: ({ row }) => {
          const details = row.original.details;
          const hasDetails = details && Object.keys(details).length > 0;
          if (!hasDetails) return <span className="text-muted-foreground">—</span>;
          return (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
                View JSON
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 text-[11px] bg-muted rounded-md p-2 overflow-x-auto max-w-[280px] max-h-40 overflow-y-auto font-mono leading-relaxed">
                  {JSON.stringify(details, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          );
        },
      },
    ],
    [],
  );

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    window.open(`/api/audit-logs/export?${params.toString()}`, '_blank');
  }, [queryParams]);

  const filterContent = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Filter by action..."
        value={actionSearch}
        onChange={(e) => { setActionSearch(e.target.value); table.setCurrentPage(1); }}
        className="w-[140px] h-9 text-sm"
      />
      <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger size="sm" className="w-[130px] h-9">
          <SelectValue placeholder="All Users" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Users</SelectItem>
          {(users ?? []).map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={resourceTypeFilter} onValueChange={(v) => { setResourceTypeFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger size="sm" className="w-[140px] h-9">
          <SelectValue placeholder="All Resources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Resources</SelectItem>
          {RESOURCE_TYPES.map((rt) => (
            <SelectItem key={rt} value={rt}>{rt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Logs"
        description="Track all actions and changes across the system"
        action={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={auditLogs}
        isLoading={isLoading}
        totalItems={pagination?.total ?? 0}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        searchPlaceholder="Search audit logs..."
        searchValue={table.searchValue}
        onSearch={(v) => { table.setSearchValue(v); table.setCurrentPage(1); }}
        filterContent={filterContent}
        getRowId={(row) => row.id}
        emptyMessage="No audit logs found."
      />
    </div>
  );
}
