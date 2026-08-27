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
      ColumnDefHelper.textColumn<InternalLinkItem>({ id: 'title', header: 'Page', accessorKey: 'title', truncate: 50 }),
      { id: 'slug', header: 'Slug', accessorKey: 'slug', cell: ({ row }) => <span className="font-mono text-xs">/{row.original.slug}</span> },
      { id: 'internalLinks', header: 'Internal Links', accessorKey: 'internalLinks', enableSorting: true, cell: ({ row }) => <span className={cn('tabular-nums text-sm', row.original.internalLinks === 0 && 'text-red-600 dark:text-red-400 font-medium')}>{row.original.internalLinks}</span> },
      { id: 'externalLinks', header: 'External Links', accessorKey: 'externalLinks', enableSorting: true, cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.externalLinks}</span> },
      { id: 'incomingLinks', header: 'Incoming Links', accessorKey: 'incomingLinks', enableSorting: true, cell: ({ row }) => <span className={cn('tabular-nums text-sm', row.original.incomingLinks === 0 && 'text-amber-600 dark:text-amber-400 font-medium')}>{row.original.incomingLinks}</span> },
      { id: 'isOrphan', header: 'Status', accessorKey: 'isOrphan', enableSorting: true, cell: ({ row }) => row.original.isOrphan ? (
        <Badge variant="outline" className="border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium"><AlertTriangle className="h-3 w-3 mr-1" />Orphan</Badge>
      ) : (
        <Badge variant="outline" className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Connected</Badge>
      )},
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Internal Links" description="Analyze internal linking structure and discover orphan pages" breadcrumbs={false} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Total Pages</p><p className="text-lg font-bold tabular-nums">{summary.totalItems}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Internal Links</p><p className="text-lg font-bold tabular-nums">{summary.totalInternalLinks}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">External Links</p><p className="text-lg font-bold tabular-nums">{summary.totalExternalLinks}</p></Card>
        <Card className="p-3"><p className={cn('text-xs', summary.orphanCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>Orphan Pages</p><p className={cn('text-lg font-bold tabular-nums', summary.orphanCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>{summary.orphanCount}</p></Card>
      </div>

      <DataTable
        columns={columns} data={items} isLoading={isLoading} totalItems={items.length}
        pageSize={table.pageSize} currentPage={table.currentPage} onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)} sortField={table.sortField} sortOrder={table.sortOrder}
        searchPlaceholder="Search by title..." searchValue={table.searchValue} onSearch={(v) => { table.setSearchValue(v); table.setCurrentPage(1); }}
        getRowId={(row) => row.contentId} emptyMessage="No content found."
      />
    </div>
  );
}
