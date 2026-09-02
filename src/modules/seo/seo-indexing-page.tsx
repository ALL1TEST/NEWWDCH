'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  ExternalLink,
  Loader2,
  ScanSearch,
  Globe,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import type { PaginatedResponse, IndexingStatusType } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';

// ==================== Types ====================

interface IndexingRow {
  id: string;
  title: string;
  url: string;
  status: IndexingStatusType;
  lastCrawl: string | null;
  lastIndexed: string | null;
  coverageError: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== Status Colors ====================

// labelKey values are resolved via t() at render time (display-only fields;
// the raw status value still flows from the API untouched).
const INDEXING_STATUS_MAP: Record<IndexingStatusType, { labelKey: string; colorClass: string }> = {
  INDEXED: { labelKey: 'seo.statusIndexed', colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  PENDING: { labelKey: 'seo.statusPending', colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  EXCLUDED: { labelKey: 'seo.statusExcluded', colorClass: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
  DISCOVERED: { labelKey: 'seo.statusDiscovered', colorClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  ERROR: { labelKey: 'seo.statusError', colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

// ==================== Filter Options ====================

// labelKey values are resolved via t() at render time (display-only fields;
// filtering still compares the raw value).
const STATUS_FILTERS: { labelKey: string; value: string }[] = [
  { labelKey: 'seo.all', value: 'all' },
  { labelKey: 'seo.errors', value: 'ERROR' },
  { labelKey: 'seo.statusPending', value: 'PENDING' },
  { labelKey: 'seo.statusIndexed', value: 'INDEXED' },
  { labelKey: 'seo.notIndexed', value: 'EXCLUDED' },
  { labelKey: 'seo.statusDiscovered', value: 'DISCOVERED' },
];

// ==================== Helper ====================

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString();
}

function IndexingStatusBadge({ status }: { status: IndexingStatusType }) {
  const { t } = useT();
  const mapping = INDEXING_STATUS_MAP[status];
  return (
    <Badge
      variant="outline"
      className={
        'border-transparent font-medium px-1.5 py-0 text-[10px] leading-4 ' +
        (mapping?.colorClass ?? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300')
      }
    >
      {mapping ? t(mapping.labelKey) : status}
    </Badge>
  );
}

// ==================== Main Page ====================

export function SeoIndexingPage() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const table = useDataTable({
    initialSortField: 'updatedAt',
    initialSortOrder: 'desc',
    initialPageSize: DEFAULT_PAGE_SIZE,
  });

  const queryParams = useMemo(
    () => ({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    [table.currentPage, table.pageSize, table.sortField, table.sortOrder, table.searchValue, statusFilter],
  );

  // Query
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.seoIndexing.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<IndexingRow>>('/api/seo/indexing', queryParams),
    staleTime: 10_000,
  });

  const records = data?.data ?? [];
  const totalItems = data?.pagination?.total ?? 0;

  // Mutations
  const requestIndexingMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/indexing/${id}`, null, { params: { action: 'request-indexing' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIndexing.all });
      toast.success(t('seo.indexingSubmitted'));
    },
    onError: () => {
      toast.error(t('seo.indexingRequestFailed'));
    },
  });

  const refreshStatusMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/indexing/${id}`, null, { params: { action: 'refresh' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIndexing.all });
      toast.success(t('seo.statusRefreshed'));
    },
    onError: () => {
      toast.error(t('seo.statusRefreshFailed'));
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => postApi('/api/seo/indexing', null, { params: { action: 'scan' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIndexing.all });
      toast.success(t('seo.scanInitiated'));
    },
    onError: () => {
      toast.error(t('seo.scanFailed'));
    },
  });

  const bulkRequestMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => patchApi(`/api/seo/indexing/${id}`, null, { params: { action: 'request-indexing' } })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIndexing.all });
      table.clearSelection();
      toast.success(`${t('seo.indexingRequestedFor')} ${table.selectedIds.length} ${t('seo.urlsSuffix')}`);
    },
    onError: () => {
      toast.error(t('seo.bulkIndexingFailed'));
    },
  });

  // Columns
  const columns = useMemo<ColumnDef<IndexingRow>[]>(
    () => [
      ColumnDefHelper.textColumn<IndexingRow>({
        id: 'title',
        header: t('seo.title'),
        accessorKey: 'title',
        truncate: 50,
      }),
      ColumnDefHelper.textColumn<IndexingRow>({
        id: 'url',
        header: t('seo.url'),
        accessorKey: 'url',
        className: 'font-mono text-xs',
        truncate: 60,
      }),
      {
        id: 'status',
        header: t('common.status'),
        accessorKey: 'status',
        enableSorting: true,
        cell: ({ row }) => <IndexingStatusBadge status={row.original.status} />,
      },
      {
        id: 'lastCrawl',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span className="font-medium">{t('seo.lastCrawl')}</span>
          </button>
        ),
        accessorKey: 'lastCrawl',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.lastCrawl)}
          </span>
        ),
      },
      {
        id: 'lastIndexed',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <span className="font-medium">{t('seo.lastIndexed')}</span>
          </button>
        ),
        accessorKey: 'lastIndexed',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.lastIndexed)}
          </span>
        ),
      },
      {
        id: 'coverageError',
        header: t('seo.coverageError'),
        accessorKey: 'coverageError',
        enableSorting: false,
        cell: ({ row }) => {
          const err = row.original.coverageError;
          if (!err) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-sm text-red-600 dark:text-red-400" title={err}>
              {truncate(err, 40)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 140,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                requestIndexingMutation.mutate(row.original.id);
              }}
              disabled={requestIndexingMutation.isPending}
            >
              {requestIndexingMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : null}
              {t('seo.request')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                refreshStatusMutation.mutate(row.original.id);
              }}
              disabled={refreshStatusMutation.isPending}
              title={t('seo.refreshStatus')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="sr-only">{t('seo.refreshStatus')}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://www.google.com/search?q=site:${encodeURIComponent(row.original.url)}`, '_blank');
              }}
              title={t('seo.openInGoogle')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="sr-only">{t('seo.openInGoogle')}</span>
            </Button>
          </div>
        ),
      },
    ],
    [requestIndexingMutation, refreshStatusMutation, t],
  );

  // Filter content
  const filterContent = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center rounded-lg border border-border p-0.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatusFilter(f.value);
              table.setCurrentPage(1);
            }}
            className={
              'px-3 py-1 text-xs font-medium rounded-md transition-colors ' +
              (statusFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('seo.indexingTitle')}
        description={t('seo.indexingDescription')}
        breadcrumbs={false}
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
            {t('seo.scanContent')}
          </Button>
        }
      />

      <Card className="border-sky-200 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/10">
        <CardContent className="p-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <p className="text-xs text-sky-700 dark:text-sky-300">
            {t('seo.indexingInfoBanner')}
          </p>
        </CardContent>
      </Card>

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
        searchPlaceholder={t('seo.searchByTitleOrUrl')}
        searchValue={table.searchValue}
        onSearch={(v) => {
          table.setSearchValue(v);
          table.setCurrentPage(1);
        }}
        getRowId={(row) => row.id}
        emptyMessage={t('seo.noIndexingRecords')}
        filterContent={filterContent}
        selectedIds={table.selectedIds}
        onSelectionChange={table.setSelectedIds}
        bulkActions={[
          {
            label: t('seo.requestIndexing'),
            onClick: (ids) => bulkRequestMutation.mutate(ids),
            icon: <Globe className="h-3.5 w-3.5 mr-1.5" />,
            disabled: bulkRequestMutation.isPending,
          },
        ]}
      />
    </div>
  );
}
