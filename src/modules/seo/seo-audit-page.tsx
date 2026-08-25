'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck, Loader2, CheckCircle2, RotateCcw, ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable, useDataTable, PageHeader,
} from '@/components/patterns';
import { getApi, postApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';

// -------------------- Types --------------------

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

// -------------------- Expandable Text Component --------------------
// Uses a ref + scrollWidth measurement to detect overflow reliably,
// regardless of font size or column width. "Read more" / "Read less"
// appears on its own line below the text, only when the content overflows.

function ExpandableText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);

  // Measure whether the text overflows its container.
  // We compare scrollWidth (full content width) to clientWidth (visible width).
  React.useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    // Only measure when collapsed — when expanded the full text is shown
    // and we already know it was overflowing.
    if (expanded) return;
    // Use a small delay to let the table layout settle
    const measure = () => {
      const el = textRef.current;
      if (!el) return;
      // scrollWidth includes overflow; clientWidth is the visible box
      // Add 2px tolerance to avoid false positives from sub-pixel rounding
      setOverflows(el.scrollWidth > el.clientWidth + 2);
    };
    measure();
    // Re-measure on resize (table column widths can change)
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, text]);

  if (!text) return <span className={cn('text-muted-foreground', className)}>—</span>;

  return (
    <div className="min-w-0 max-w-[250px]">
      <span
        ref={textRef}
        className={cn(
          'block overflow-hidden',
          expanded ? 'whitespace-normal break-words' : 'text-ellipsis whitespace-nowrap',
          className,
        )}
        title={expanded ? undefined : text}
      >
        {text}
      </span>
      {overflows && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="mt-0.5 text-primary hover:underline text-xs font-medium block"
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

// -------------------- URL Cell Component --------------------
// Truncated with ellipsis, tooltip on hover, clickable to open in new tab.
// No "Read more" button.

function UrlCell({ url }: { url: string }) {
  const fullUrl = url.startsWith('http') ? url : `https://cms.example.com${url}`;

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-0.5 max-w-full"
      title={url}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="truncate block max-w-[180px]">{url}</span>
      <ExternalLink className="h-2.5 w-2.5 opacity-50 shrink-0" />
    </a>
  );
}

// -------------------- Main Component --------------------

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
    isResolved: showResolved ? undefined : 'false',
  }), [table.currentPage, table.pageSize, table.sortField, table.sortOrder, table.searchValue, severityFilter, showResolved]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.seoIssues.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<SeoIssueRow>>('/api/seo/issues', queryParams),
    staleTime: 10_000,
  });

  const issues = data?.data ?? [];
  const totalItems = data?.pagination?.total ?? 0;

  // Fetch severity counts (unresolved only) via 3 lightweight pagination queries
  const { data: criticalData } = useQuery({
    queryKey: ['seo-issues', 'count', 'CRITICAL'],
    queryFn: () => getApi<PaginatedResponse<SeoIssueRow>>('/api/seo/issues', { pageSize: 1, isResolved: 'false', severity: 'CRITICAL' }),
    staleTime: 10_000,
  });
  const { data: warningData } = useQuery({
    queryKey: ['seo-issues', 'count', 'WARNING'],
    queryFn: () => getApi<PaginatedResponse<SeoIssueRow>>('/api/seo/issues', { pageSize: 1, isResolved: 'false', severity: 'WARNING' }),
    staleTime: 10_000,
  });
  const { data: infoData } = useQuery({
    queryKey: ['seo-issues', 'count', 'INFO'],
    queryFn: () => getApi<PaginatedResponse<SeoIssueRow>>('/api/seo/issues', { pageSize: 1, isResolved: 'false', severity: 'INFO' }),
    staleTime: 10_000,
  });

  const auditMutation = useMutation({
    mutationFn: () => postApi('/api/seo/issues?action=audit'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all });
      queryClient.invalidateQueries({ queryKey: ['seo-issues'] });
      queryClient.invalidateQueries({ queryKey: ['seo-overview'] });
      toast.success('SEO audit completed');
    },
    onError: () => toast.error('Audit failed'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/issues/${id}`, { isResolved: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all });
      queryClient.invalidateQueries({ queryKey: ['seo-issues'] });
      queryClient.invalidateQueries({ queryKey: ['seo-overview'] });
      toast.success('Issue marked as resolved');
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/issues/${id}`, { isResolved: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all });
      queryClient.invalidateQueries({ queryKey: ['seo-issues'] });
      queryClient.invalidateQueries({ queryKey: ['seo-overview'] });
      toast.success('Issue reopened');
    },
  });

  const columns = useMemo<ColumnDef<SeoIssueRow>[]>(
    () => [
      {
        id: 'severity',
        header: 'Severity',
        accessorKey: 'severity',
        size: 100,
        cell: ({ row }) => {
          const s = SEVERITY_STYLES[row.original.severity];
          return s
            ? <Badge variant="outline" className={cn('border-transparent font-medium', s.bg, s.color)}>{row.original.severity}</Badge>
            : row.original.severity;
        },
      },
      {
        id: 'pageUrl',
        header: 'URL',
        accessorKey: 'pageUrl',
        size: 200,
        cell: ({ row }) => <UrlCell url={row.original.pageUrl} />,
      },
      {
        id: 'problem',
        header: 'Problem',
        accessorKey: 'problem',
        size: 250,
        cell: ({ row }) => (
          <ExpandableText text={row.original.problem} className="text-sm" />
        ),
      },
      {
        id: 'recommendation',
        header: 'Fix',
        accessorKey: 'recommendation',
        size: 250,
        cell: ({ row }) => (
          <ExpandableText text={row.original.recommendation} className="text-xs text-muted-foreground" />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 110,
        cell: ({ row }) => {
          if (row.original.isResolved) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reopenMutation.mutate(row.original.id);
                }}
                disabled={reopenMutation.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:bg-muted hover:text-foreground hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reopenMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RotateCcw className="h-3.5 w-3.5" />}
                Reopen
              </button>
            );
          }
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resolveMutation.mutate(row.original.id);
              }}
              disabled={resolveMutation.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/20 dark:hover:text-green-400 dark:hover:border-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resolveMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="h-3.5 w-3.5" />}
              Resolve
            </button>
          );
        },
      },
    ],
    [resolveMutation, reopenMutation],
  );

  const severityCounts = useMemo(() => {
    return {
      CRITICAL: criticalData?.pagination?.total ?? 0,
      WARNING: warningData?.pagination?.total ?? 0,
      INFO: infoData?.pagination?.total ?? 0,
    };
  }, [criticalData, warningData, infoData]);

  const filterContent = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center rounded-lg border border-border p-0.5">
        {['all', 'CRITICAL', 'WARNING', 'INFO'].map((f) => (
          <button
            key={f}
            onClick={() => { setSeverityFilter(f); table.setCurrentPage(1); }}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              severityFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-2">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => setShowResolved(e.target.checked)}
          className="rounded border-border"
        />
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
        <Card
          className={cn('p-3 cursor-pointer transition-colors hover:bg-muted/50', severityFilter === 'CRITICAL' && 'ring-2 ring-red-300 dark:ring-red-700')}
          onClick={() => { setSeverityFilter(severityFilter === 'CRITICAL' ? 'all' : 'CRITICAL'); table.setCurrentPage(1); }}
        >
          <p className="text-xs text-red-600 dark:text-red-400">Critical</p>
          <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{severityCounts.CRITICAL}</p>
        </Card>
        <Card
          className={cn('p-3 cursor-pointer transition-colors hover:bg-muted/50', severityFilter === 'WARNING' && 'ring-2 ring-amber-300 dark:ring-amber-700')}
          onClick={() => { setSeverityFilter(severityFilter === 'WARNING' ? 'all' : 'WARNING'); table.setCurrentPage(1); }}
        >
          <p className="text-xs text-amber-600 dark:text-amber-400">Warnings</p>
          <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{severityCounts.WARNING}</p>
        </Card>
        <Card
          className={cn('p-3 cursor-pointer transition-colors hover:bg-muted/50', severityFilter === 'INFO' && 'ring-2 ring-sky-300 dark:ring-sky-700')}
          onClick={() => { setSeverityFilter(severityFilter === 'INFO' ? 'all' : 'INFO'); table.setCurrentPage(1); }}
        >
          <p className="text-xs text-sky-600 dark:text-sky-400">Info</p>
          <p className="text-lg font-bold tabular-nums text-sky-600 dark:text-sky-400">{severityCounts.INFO}</p>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={issues}
        isLoading={isLoading}
        totalItems={totalItems}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        searchPlaceholder="Search issues..."
        searchValue={table.searchValue}
        onSearch={(v) => { table.setSearchValue(v); table.setCurrentPage(1); }}
        getRowId={(row) => row.id}
        emptyMessage="No SEO issues found. Run an audit to scan your content."
        filterContent={filterContent}
      />
    </div>
  );
}
