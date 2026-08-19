'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck, Loader2, AlertTriangle, Info, ChevronDown, ChevronRight,
  RefreshCw, CheckCircle2, XCircle, Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable, useDataTable, ColumnDefHelper, PageHeader,
} from '@/components/patterns';
import { getApi, postApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, truncate } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';

interface SeoIssueRow {
  id: string;
  severity: string;
  resourceType: string;
  resourceId: string | null;
  pageUrl: string;
  problem: string;
  recommendation: string;
  isResolved: boolean;
  createdAt: string;
}

const SEVERITY_STYLES: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  WARNING: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  INFO: { color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30' },
};

function inferCategory(problem: string): string {
  const p = problem.toLowerCase();
  if (p.includes('canonical') || p.includes('redirect')) return 'Technical Issues';
  if (p.includes('h1') || p.includes('h2') || p.includes('meta title') || p.includes('meta description') || p.includes('content') || p.includes('readability') || p.includes('image') || p.includes('alt')) return 'Content Issues';
  if (p.includes('index') || p.includes('noindex')) return 'Indexing Issues';
  if (p.includes('schema') || p.includes('structured') || p.includes('json-ld')) return 'Structured Data Issues';
  if (p.includes('link') || p.includes('orphan') || p.includes('broken')) return 'Link Issues';
  return 'Technical Issues';
}

export function SeoAuditPage() {
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);

  const table = useDataTable({ initialSortField: 'createdAt', initialSortOrder: 'desc', initialPageSize: DEFAULT_PAGE_SIZE });

  const queryParams = useMemo(() => ({
    page: table.currentPage,
    pageSize: table.pageSize,
    sort: table.sortField,
    order: table.sortOrder,
    search: table.searchValue || undefined,
    severity: severityFilter !== 'all' ? severityFilter : undefined,
  }), [table.currentPage, table.pageSize, table.sortField, table.sortOrder, table.searchValue, severityFilter]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.seoIssues.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<SeoIssueRow>>('/api/seo/issues', queryParams),
    staleTime: 10_000,
  });

  const issues = data?.data ?? [];
  const totalItems = data?.pagination?.total ?? 0;

  const auditMutation = useMutation({
    mutationFn: () => postApi('/api/seo/issues?action=audit'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all }); toast.success('SEO audit completed'); },
    onError: () => toast.error('Audit failed'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/issues/${id}`, { isResolved: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all }); toast.success('Issue marked as resolved'); },
  });

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, SeoIssueRow[]> = {};
    for (const issue of issues) {
      if (!showResolved && issue.isResolved) continue;
      const cat = inferCategory(issue.problem);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(issue);
    }
    return groups;
  }, [issues, showResolved]);

  const columns = useMemo<ColumnDef<SeoIssueRow>[]>(
    () => [
      { id: 'severity', header: 'Severity', accessorKey: 'severity', cell: ({ row }) => { const s = SEVERITY_STYLES[row.original.severity]; return s ? <Badge variant="outline" className={cn('border-transparent font-medium gap-1', s.bg, s.color)}>{row.original.severity}</Badge> : row.original.severity; } },
      { id: 'pageUrl', header: 'URL', accessorKey: 'pageUrl', cell: ({ row }) => <span className="font-mono text-xs truncate block max-w-[180px]" title={row.original.pageUrl}>{row.original.pageUrl}</span> },
      { id: 'problem', header: 'Problem', accessorKey: 'problem', cell: ({ row }) => <span className="text-sm truncate block max-w-[250px]" title={row.original.problem}>{row.original.problem}</span> },
      { id: 'recommendation', header: 'Fix', accessorKey: 'recommendation', cell: ({ row }) => <span className="text-xs text-muted-foreground truncate block max-w-[200px]" title={row.original.recommendation}>{row.original.recommendation}</span> },
      { id: 'isResolved', header: 'Status', accessorKey: 'isResolved', cell: ({ row }) => row.original.isResolved ? <Badge variant="outline" className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Resolved</Badge> : <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Open</Badge> },
      { id: 'actions', header: '', size: 80, cell: ({ row }) => !row.original.isResolved && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); resolveMutation.mutate(row.original.id); }} disabled={resolveMutation.isPending}>{resolveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}Resolve</Button> },
    ],
    [resolveMutation],
  );

  const severityCounts = useMemo(() => {
    const c: Record<string, number> = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    for (const i of issues) if (!i.isResolved && c[i.severity] !== undefined) c[i.severity]++;
    return c;
  }, [issues]);

  const filterContent = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center rounded-lg border border-border p-0.5">
        {['all', 'CRITICAL', 'WARNING', 'INFO'].map((f) => (
          <button key={f} onClick={() => { setSeverityFilter(f); table.setCurrentPage(1); }}
            className={cn('px-2.5 py-1 text-xs font-medium rounded-md transition-colors', severityFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-2">
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="rounded border-border" />
        Show Resolved
      </label>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="SEO Audit"
        description="Run a comprehensive technical SEO audit of your content"
        action={(
          <Button size="sm" onClick={() => auditMutation.mutate()} disabled={auditMutation.isPending}>
            {auditMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
            Run SEO Audit
          </Button>
        )}
      />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><p className="text-xs text-red-600 dark:text-red-400">Critical</p><p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{severityCounts.CRITICAL}</p></Card>
        <Card className="p-3"><p className="text-xs text-amber-600 dark:text-amber-400">Warnings</p><p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{severityCounts.WARNING}</p></Card>
        <Card className="p-3"><p className="text-xs text-sky-600 dark:text-sky-400">Info</p><p className="text-lg font-bold tabular-nums text-sky-600 dark:text-sky-400">{severityCounts.INFO}</p></Card>
      </div>

      <DataTable
        columns={columns} data={issues} isLoading={isLoading} totalItems={totalItems}
        pageSize={table.pageSize} currentPage={table.currentPage} onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)} sortField={table.sortField} sortOrder={table.sortOrder}
        searchPlaceholder="Search issues..." searchValue={table.searchValue} onSearch={(v) => { table.setSearchValue(v); table.setCurrentPage(1); }}
        getRowId={(row) => row.id} emptyMessage="No SEO issues found. Run an audit to scan your content."
        filterContent={filterContent}
      />
    </div>
  );
}
