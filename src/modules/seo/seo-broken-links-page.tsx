'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ScanSearch,
  Loader2,
  CheckCircle,
  EyeOff,
  RefreshCw,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
} from '@/components/patterns';
import { getApi, postApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { truncate } from '@/lib/utils';
import type { PaginatedResponse, BrokenLinkType, BrokenLinkStatus } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { toast } from 'sonner';

// ==================== Types ====================

interface BrokenLinkRow {
  id: string;
  brokenUrl: string;
  sourcePage: string;
  errorCode: number | null;
  type: BrokenLinkType;
  detectedAt: string;
  status: BrokenLinkStatus;
  createdAt: string;
  updatedAt: string;
}

// ==================== Status Colors ====================

const LINK_STATUS_MAP: Record<BrokenLinkStatus, { label: string; colorClass: string }> = {
  BROKEN: { label: 'Broken', colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  IGNORED: { label: 'Ignored', colorClass: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
  FIXED: { label: 'Fixed', colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

const LINK_TYPE_MAP: Record<BrokenLinkType, { label: string; colorClass: string }> = {
  INTERNAL: { label: 'Internal', colorClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  EXTERNAL: { label: 'External', colorClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  IMAGE: { label: 'Image', colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PDF: { label: 'PDF', colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  ANCHOR: { label: 'Anchor', colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

// ==================== Filter Options ====================

type FilterCategory = 'status' | 'type';

const STATUS_FILTERS: { label: string; value: string; category: FilterCategory }[] = [
  { label: 'All', value: 'all', category: 'status' },
  { label: '404', value: '404', category: 'type' },
  { label: '500', value: '500', category: 'type' },
  { label: 'Timeout', value: 'timeout', category: 'type' },
  { label: 'SSL', value: 'ssl', category: 'type' },
  { label: 'Internal', value: 'INTERNAL', category: 'type' },
  { label: 'External', value: 'EXTERNAL', category: 'type' },
  { label: 'Image', value: 'IMAGE', category: 'type' },
  { label: 'PDF', value: 'PDF', category: 'type' },
  { label: 'Anchor', value: 'ANCHOR', category: 'type' },
];

// ==================== Helper ====================

function ColoredBadge({
  label,
  colorClass,
}: {
  label: string;
  colorClass: string;
}) {
  return (
    <Badge
      variant="outline"
      className={
        'border-transparent font-medium px-1.5 py-0 text-[10px] leading-4 ' +
        colorClass
      }
    >
      {label}
    </Badge>
  );
}

function ErrorCodeBadge({ code }: { code: number | null }) {
  if (!code) return <span className="text-muted-foreground text-sm">—</span>;
  const isError = code >= 400;
  return (
    <Badge
      variant="outline"
      className={
        'border-transparent font-medium px-1.5 py-0 text-[10px] leading-4 ' +
        (isError
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300')
      }
    >
      {code}
    </Badge>
  );
}

// ==================== Main Page ====================

export function SeoBrokenLinksPage() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('all');

  const table = useDataTable({
    initialSortField: 'detectedAt',
    initialSortOrder: 'desc',
    initialPageSize: DEFAULT_PAGE_SIZE,
  });

  // Determine query params based on active filter
  const queryParams = useMemo(
    () => {
      const params: Record<string, string | number | boolean | undefined> = {
        page: table.currentPage,
        pageSize: table.pageSize,
        sort: table.sortField,
        order: table.sortOrder,
        search: table.searchValue || undefined,
      };

      if (activeFilter === '404' || activeFilter === '500') {
        params.errorCode = activeFilter;
      } else if (activeFilter === 'timeout') {
        params.errorCode = 'timeout';
      } else if (activeFilter === 'ssl') {
        params.errorCode = 'ssl';
      } else if (
        ['INTERNAL', 'EXTERNAL', 'IMAGE', 'PDF', 'ANCHOR'].includes(activeFilter)
      ) {
        params.type = activeFilter;
      }

      return params;
    },
    [table.currentPage, table.pageSize, table.sortField, table.sortOrder, table.searchValue, activeFilter],
  );

  // Query
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.seoBrokenLinks.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<BrokenLinkRow>>('/api/seo/broken-links', queryParams),
    staleTime: 10_000,
  });

  const records = data?.data ?? [];
  const totalItems = data?.pagination?.total ?? 0;

  // Mutations
  const fixMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/broken-links/${id}`, { status: 'FIXED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoBrokenLinks.all });
      toast.success('Link marked as fixed');
    },
    onError: () => {
      toast.error('Failed to mark link as fixed');
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/broken-links/${id}`, { status: 'IGNORED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoBrokenLinks.all });
      toast.success('Link ignored');
    },
    onError: () => {
      toast.error('Failed to ignore link');
    },
  });

  const recheckMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/broken-links/${id}`, { status: 'BROKEN' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoBrokenLinks.all });
      toast.success('Recheck scheduled');
    },
    onError: () => {
      toast.error('Failed to schedule recheck');
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => postApi('/api/seo/broken-links', null, { params: { action: 'scan' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoBrokenLinks.all });
      toast.success('Website scan initiated');
    },
    onError: () => {
      toast.error('Failed to start website scan');
    },
  });

  const redirectFromBroken = useMutation({
    mutationFn: (brokenUrl: string) => {
      const fromPath = brokenUrl.startsWith('/') ? brokenUrl : new URL(brokenUrl).pathname;
      return postApi('/api/redirects', { fromPath, toPath: '/', type: 'PERMANENT_301', isActive: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoBrokenLinks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
      toast.success('Redirect created — edit the destination in the Redirects page');
    },
    onError: () => toast.error('Failed to create redirect'),
  });

  const createRedirectFromBroken = (brokenUrl: string) => redirectFromBroken.mutate(brokenUrl);

  // Columns
  const columns = useMemo<ColumnDef<BrokenLinkRow>[]>(
    () => [
      {
        id: 'brokenUrl',
        header: 'Broken URL',
        accessorKey: 'brokenUrl',
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className="font-mono text-xs block max-w-[200px] truncate"
            title={row.original.brokenUrl}
          >
            {row.original.brokenUrl}
          </span>
        ),
      },
      {
        id: 'sourcePage',
        header: 'Source Page',
        accessorKey: 'sourcePage',
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className="text-xs block max-w-[160px] truncate"
            title={row.original.sourcePage}
          >
            {row.original.sourcePage}
          </span>
        ),
      },
      {
        id: 'errorCode',
        header: 'Error Code',
        accessorKey: 'errorCode',
        enableSorting: true,
        cell: ({ row }) => <ErrorCodeBadge code={row.original.errorCode} />,
      },
      {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        enableSorting: true,
        cell: ({ row }) => {
          const t = LINK_TYPE_MAP[row.original.type];
          return (
            <ColoredBadge
              label={t?.label ?? row.original.type}
              colorClass={t?.colorClass ?? ''}
            />
          );
        },
      },
      {
        id: 'detectedAt',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span className="font-medium">Detected</span>
          </button>
        ),
        accessorKey: 'detectedAt',
        enableSorting: true,
        cell: ({ row }) => {
          const d = row.original.detectedAt;
          if (!d) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-sm text-muted-foreground">
              {new Date(d).toLocaleDateString()}
            </span>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        enableSorting: true,
        cell: ({ row }) => {
          const s = LINK_STATUS_MAP[row.original.status];
          return (
            <ColoredBadge
              label={s?.label ?? row.original.status}
              colorClass={s?.colorClass ?? ''}
            />
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 220,
        cell: ({ row }) => {
          const isBroken = row.original.status === 'BROKEN';
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  fixMutation.mutate(row.original.id);
                }}
                disabled={fixMutation.isPending || !isBroken}
                title="Mark as Fixed"
              >
                {fixMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                )}
                Fix
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  ignoreMutation.mutate(row.original.id);
                }}
                disabled={ignoreMutation.isPending || !isBroken}
                title="Ignore this link"
              >
                {ignoreMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                )}
                Ignore
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  recheckMutation.mutate(row.original.id);
                }}
                disabled={recheckMutation.isPending}
                title="Reset and recheck"
              >
                {recheckMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                Recheck
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  createRedirectFromBroken(row.original.brokenUrl);
                }}
                disabled={redirectFromBroken.isPending}
                title="Create redirect for this broken URL"
              >
                {redirectFromBroken.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5 mr-1" />
                )}
                Redirect
              </Button>
            </div>
          );
        },
      },
    ],
    [fixMutation, ignoreMutation, recheckMutation, redirectFromBroken],
  );

  // Filter content
  const filterContent = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center rounded-lg border border-border p-0.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setActiveFilter(f.value);
              table.setCurrentPage(1);
            }}
            className={
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors ' +
              (activeFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Broken Links"
        description="Find and fix broken links across your website"
        action={
          <Button
            size="sm"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ScanSearch className="h-4 w-4 mr-2" />
            )}
            Scan Website
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={records}
        isLoading={isLoading}
        totalItems={totalItems}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(field, order) => table.setSortField(field, order)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        searchPlaceholder="Search by URL or source page..."
        searchValue={table.searchValue}
        onSearch={(v) => {
          table.setSearchValue(v);
          table.setCurrentPage(1);
        }}
        getRowId={(row) => row.id}
        emptyMessage="No broken links found. Run a scan to check your website."
        filterContent={filterContent}
      />
    </div>
  );
}
