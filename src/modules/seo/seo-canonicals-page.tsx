'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Link2, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Loader2, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable, useDataTable, ColumnDefHelper, PageHeader,
} from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, truncate } from '@/lib/utils';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';

interface CanonicalItem {
  contentId: string;
  title: string;
  slug: string;
  canonicalUrl: string | null;
  status: 'OK' | 'MISSING' | 'DUPLICATE' | 'EXTERNAL' | 'INVALID';
  issue: string | null;
}

interface CanonicalData {
  items: CanonicalItem[];
  summary: { total: number; ok: number; missing: number; duplicate: number; external: number; invalid: number };
}

const STATUS_MAP: Record<string, { label: string; colorClass: string }> = {
  OK: { label: 'OK', colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  MISSING: { label: 'Missing', colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  DUPLICATE: { label: 'Duplicate', colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  EXTERNAL: { label: 'External', colorClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  INVALID: { label: 'Invalid', colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export function SeoCanonicalsPage() {
  const table = useDataTable({ initialSortField: 'title', initialSortOrder: 'asc', initialPageSize: DEFAULT_PAGE_SIZE });
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.seoCanonicals.all,
    queryFn: () => getApi<CanonicalData>('/api/seo/canonicals'),
    staleTime: 30_000,
  });

  const allItems = data?.items ?? [];
  const summary = data?.summary ?? { total: 0, ok: 0, missing: 0, duplicate: 0, external: 0, invalid: 0 };

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return allItems;
    return allItems.filter((i) => i.status === statusFilter);
  }, [allItems, statusFilter]);

  const columns = useMemo<ColumnDef<CanonicalItem>[]>(
    () => [
      ColumnDefHelper.textColumn<CanonicalItem>({ id: 'title', header: 'Page', accessorKey: 'title', truncate: 50 }),
      { id: 'slug', header: 'Slug', accessorKey: 'slug', cell: ({ row }) => <span className="font-mono text-xs">/{row.original.slug}</span> },
      { id: 'canonicalUrl', header: 'Canonical URL', accessorKey: 'canonicalUrl', cell: ({ row }) => <span className="font-mono text-xs truncate block max-w-[250px]" title={row.original.canonicalUrl ?? ''}>{row.original.canonicalUrl || '—'}</span> },
      { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => { const s = STATUS_MAP[row.original.status]; return s ? <Badge variant="outline" className={cn('border-transparent font-medium', s.colorClass)}>{s.label}</Badge> : row.original.status; } },
      { id: 'issue', header: 'Issue', accessorKey: 'issue', cell: ({ row }) => <span className="text-xs text-muted-foreground truncate block max-w-[200px]" title={row.original.issue ?? ''}>{row.original.issue || '—'}</span> },
    ],
    [],
  );

  const FILTERS = [
    { label: 'All', value: 'all' },
    { label: 'OK', value: 'OK' },
    { label: 'Missing', value: 'MISSING' },
    { label: 'Duplicate', value: 'DUPLICATE' },
    { label: 'External', value: 'EXTERNAL' },
    { label: 'Invalid', value: 'INVALID' },
  ];

  const filterContent = (
    <div className="flex items-center rounded-lg border border-border p-0.5">
      {FILTERS.map((f) => (
        <button key={f.value} onClick={() => { setStatusFilter(f.value); table.setCurrentPage(1); }}
          className={cn('px-2.5 py-1 text-xs font-medium rounded-md transition-colors', statusFilter === f.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {f.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Canonical URLs" description="Manage and inspect canonical URL configuration across your content" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold tabular-nums">{summary.total}</p></Card>
        <Card className="p-3"><p className="text-xs text-green-600 dark:text-green-400">OK</p><p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">{summary.ok}</p></Card>
        <Card className="p-3"><p className="text-xs text-red-600 dark:text-red-400">Missing</p><p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{summary.missing}</p></Card>
        <Card className="p-3"><p className="text-xs text-amber-600 dark:text-amber-400">Duplicate</p><p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary.duplicate}</p></Card>
        <Card className="p-3"><p className="text-xs text-violet-600 dark:text-violet-400">External</p><p className="text-lg font-bold tabular-nums text-violet-600 dark:text-violet-400">{summary.external}</p></Card>
      </div>

      <DataTable
        columns={columns} data={filteredItems} isLoading={isLoading} totalItems={filteredItems.length}
        pageSize={table.pageSize} currentPage={table.currentPage} onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)} sortField={table.sortField} sortOrder={table.sortOrder}
        searchPlaceholder="Search by title..." searchValue={table.searchValue} onSearch={(v) => { table.setSearchValue(v); table.setCurrentPage(1); }}
        getRowId={(row) => row.contentId} emptyMessage="No canonical issues found." filterContent={filterContent}
      />
    </div>
  );
}
