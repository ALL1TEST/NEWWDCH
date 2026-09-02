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
import { useT } from '@/lib/i18n';
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

// labelKey values are resolved via t() at render time (display-only fields;
// the raw status/type values still flow from the API untouched).
const LINK_STATUS_MAP: Record<BrokenLinkStatus, { labelKey: string; colorClass: string }> = {
  BROKEN: { labelKey: 'seo.broken', colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  IGNORED: { labelKey: 'seo.ignored', colorClass: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
  FIXED: { labelKey: 'seo.fixed', colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

const LINK_TYPE_MAP: Record<BrokenLinkType, { labelKey: string; colorClass: string }> = {
  INTERNAL: { labelKey: 'seo.internal', colorClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  EXTERNAL: { labelKey: 'seo.external', colorClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  IMAGE: { labelKey: 'seo.image', colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PDF: { labelKey: 'seo.pdf', colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  ANCHOR: { labelKey: 'seo.anchor', colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

// ==================== Filter Options ====================

type FilterCategory = 'status' | 'type';

// labelKey values are resolved via t() at render time (display-only fields;
// filtering still compares the raw value).
const STATUS_FILTERS: { labelKey: string; value: string; category: FilterCategory }[] = [
  { labelKey: 'seo.all', value: 'all', category: 'status' },
  { labelKey: 'seo.filter404', value: '404', category: 'type' },
  { labelKey: 'seo.filter500', value: '500', category: 'type' },
  { labelKey: 'seo.timeout', value: 'timeout', category: 'type' },
  { labelKey: 'seo.ssl', value: 'ssl', category: 'type' },
  { labelKey: 'seo.internal', value: 'INTERNAL', category: 'type' },
  { labelKey: 'seo.external', value: 'EXTERNAL', category: 'type' },
  { labelKey: 'seo.image', value: 'IMAGE', category: 'type' },
  { labelKey: 'seo.pdf', value: 'PDF', category: 'type' },
  { labelKey: 'seo.anchor', value: 'ANCHOR', category: 'type' },
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
  const { t } = useT();
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
      toast.success(t('seo.linkMarkedFixed'));
    },
    onError: () => {
      toast.error(t('seo.linkMarkFixedFailed'));
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/broken-links/${id}`, { status: 'IGNORED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoBrokenLinks.all });
      toast.success(t('seo.linkIgnored'));
    },
    onError: () => {
      toast.error(t('seo.linkIgnoreFailed'));
    },
  });

  const recheckMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/broken-links/${id}`, { status: 'BROKEN' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoBrokenLinks.all });
      toast.success(t('seo.recheckScheduled'));
    },
    onError: () => {
      toast.error(t('seo.recheckFailed'));
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => postApi('/api/seo/broken-links', null, { params: { action: 'scan' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoBrokenLinks.all });
      toast.success(t('seo.websiteScanInitiated'));
    },
    onError: () => {
      toast.error(t('seo.websiteScanFailed'));
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
      toast.success(t('seo.redirectCreatedHint'));
    },
    onError: () => toast.error(t('seo.redirectCreateFailed')),
  });

  const createRedirectFromBroken = (brokenUrl: string) => redirectFromBroken.mutate(brokenUrl);

  // Columns
  const columns = useMemo<ColumnDef<BrokenLinkRow>[]>(
    () => [
      {
        id: 'brokenUrl',
        header: t('seo.brokenUrl'),
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
        header: t('seo.sourcePage'),
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
        header: t('seo.errorCode'),
        accessorKey: 'errorCode',
        enableSorting: true,
        cell: ({ row }) => <ErrorCodeBadge code={row.original.errorCode} />,
      },
      {
        id: 'type',
        header: t('seo.type'),
        accessorKey: 'type',
        enableSorting: true,
        cell: ({ row }) => {
          const typeInfo = LINK_TYPE_MAP[row.original.type];
          return (
            <ColoredBadge
              label={typeInfo ? t(typeInfo.labelKey) : row.original.type}
              colorClass={typeInfo?.colorClass ?? ''}
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
            <span className="font-medium">{t('seo.detected')}</span>
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
        header: t('common.status'),
        accessorKey: 'status',
        enableSorting: true,
        cell: ({ row }) => {
          const s = LINK_STATUS_MAP[row.original.status];
          return (
            <ColoredBadge
              label={s ? t(s.labelKey) : row.original.status}
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
                title={t('seo.markAsFixed')}
              >
                {fixMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                )}
                {t('seo.fix')}
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
                title={t('seo.ignoreThisLink')}
              >
                {ignoreMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                )}
                {t('seo.ignore')}
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
                title={t('seo.resetAndRecheck')}
              >
                {recheckMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                {t('seo.recheck')}
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
                title={t('seo.createRedirectForBroken')}
              >
                {redirectFromBroken.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5 mr-1" />
                )}
                {t('seo.redirect')}
              </Button>
            </div>
          );
        },
      },
    ],
    [fixMutation, ignoreMutation, recheckMutation, redirectFromBroken, t],
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
            {t(f.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('seo.brokenLinks')}
        description={t('seo.brokenLinksDescription')}
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
            {t('seo.scanWebsite')}
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
        searchPlaceholder={t('seo.searchByUrlOrSource')}
        searchValue={table.searchValue}
        onSearch={(v) => {
          table.setSearchValue(v);
          table.setCurrentPage(1);
        }}
        getRowId={(row) => row.id}
        emptyMessage={t('seo.brokenLinksEmpty')}
        filterContent={filterContent}
      />
    </div>
  );
}
