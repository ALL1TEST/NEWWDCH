'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitBranch, AlertTriangle, ExternalLink, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable, useDataTable, ColumnDefHelper, PageHeader,
} from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, truncate } from '@/lib/utils';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { useT } from '@/lib/i18n';

interface InternalLinkItem {
  contentId: string;
  title: string;
  slug: string;
  internalLinks: number;
  externalLinks: number;
  incomingLinks: number;
  isOrphan: boolean;
}

interface InternalLinksData {
  items: InternalLinkItem[];
  orphans: string[];
  summary: {
    totalItems: number;
    totalInternalLinks: number;
    totalExternalLinks: number;
    orphanCount: number;
  };
}

export function SeoInternalLinksPage() {
  const { t } = useT();
  const table = useDataTable({ initialSortField: 'title', initialSortOrder: 'asc', initialPageSize: DEFAULT_PAGE_SIZE });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.seoInternalLinks.all,
    queryFn: () => getApi<InternalLinksData>('/api/seo/internal-links'),
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const summary = data?.summary ?? { totalItems: 0, totalInternalLinks: 0, totalExternalLinks: 0, orphanCount: 0 };

  const columns = useMemo<ColumnDef<InternalLinkItem>[]>(
    () => [
      ColumnDefHelper.textColumn<InternalLinkItem>({ id: 'title', header: t('seo.page'), accessorKey: 'title', truncate: 50 }),
      { id: 'slug', header: t('seo.slug'), accessorKey: 'slug', cell: ({ row }) => <span className="font-mono text-xs">/{row.original.slug}</span> },
      { id: 'internalLinks', header: t('seo.internalLinks'), accessorKey: 'internalLinks', enableSorting: true, cell: ({ row }) => <span className={cn('tabular-nums text-sm', row.original.internalLinks === 0 && 'text-red-600 dark:text-red-400 font-medium')}>{row.original.internalLinks}</span> },
      { id: 'externalLinks', header: t('seo.externalLinks'), accessorKey: 'externalLinks', enableSorting: true, cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.externalLinks}</span> },
      { id: 'incomingLinks', header: t('seo.incomingLinks'), accessorKey: 'incomingLinks', enableSorting: true, cell: ({ row }) => <span className={cn('tabular-nums text-sm', row.original.incomingLinks === 0 && 'text-amber-600 dark:text-amber-400 font-medium')}>{row.original.incomingLinks}</span> },
      { id: 'isOrphan', header: t('common.status'), accessorKey: 'isOrphan', enableSorting: true, cell: ({ row }) => row.original.isOrphan ? (
        <Badge variant="outline" className="border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium"><AlertTriangle className="h-3 w-3 mr-1" />{t('seo.orphan')}</Badge>
      ) : (
        <Badge variant="outline" className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">{t('seo.connected')}</Badge>
      )},
    ],
    [t],
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t('seo.internalLinksTitle')} description={t('seo.internalLinksDescription')} breadcrumbs={false} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">{t('seo.totalPages')}</p><p className="text-lg font-bold tabular-nums">{summary.totalItems}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">{t('seo.internalLinks')}</p><p className="text-lg font-bold tabular-nums">{summary.totalInternalLinks}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">{t('seo.externalLinks')}</p><p className="text-lg font-bold tabular-nums">{summary.totalExternalLinks}</p></Card>
        <Card className="p-3"><p className={cn('text-xs', summary.orphanCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>{t('seo.orphanPages')}</p><p className={cn('text-lg font-bold tabular-nums', summary.orphanCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>{summary.orphanCount}</p></Card>
      </div>

      <DataTable
        columns={columns} data={items} isLoading={isLoading} totalItems={items.length}
        pageSize={table.pageSize} currentPage={table.currentPage} onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)} sortField={table.sortField} sortOrder={table.sortOrder}
        searchPlaceholder={t('seo.searchByTitle')} searchValue={table.searchValue} onSearch={(v) => { table.setSearchValue(v); table.setCurrentPage(1); }}
        getRowId={(row) => row.contentId} emptyMessage={t('seo.noContentFound')}
      />
    </div>
  );
}
