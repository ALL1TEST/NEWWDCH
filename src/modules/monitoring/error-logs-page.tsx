'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileWarning,
  Search,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader, EmptyState } from '@/components/patterns';
import { getApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaginatedResponse, ErrorLogSeverity } from '@/shared/types';

// -------------------- Types --------------------

interface ErrorLogRow {
  id: string;
  exception: string;
  module: string;
  url?: string;
  user?: { id: string; name: string } | null;
  severity: ErrorLogSeverity;
  isResolved: boolean;
  resolvedBy?: { id: string; name: string } | null;
  createdAt: string;
}

// -------------------- Constants --------------------

const SEVERITY_COLORS: Record<string, string> = {
  DEBUG: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  INFO: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FATAL: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

// -------------------- Error Logs Page --------------------

export function ErrorLogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState<string>('');

  const params: Record<string, string | number | boolean | undefined> = {
    page,
    pageSize: 25,
    severity: severity || undefined,
    module: moduleFilter || undefined,
    isResolved: resolvedFilter === 'resolved' ? true : resolvedFilter === 'unresolved' ? false : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.errorLogs.list(params),
    queryFn: () => getApi<PaginatedResponse<ErrorLogRow>>('/api/monitoring/error-logs', params),
    staleTime: 5_000,
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  const resolveMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/monitoring/error-logs/${id}`, { isResolved: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.errorLogs.all });
      toast.success('Error log resolved');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to resolve'),
  });

  const clearFilters = () => {
    setSeverity('');
    setModuleFilter('');
    setResolvedFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Error Logs" description="View and manage application error logs" />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by module..."
                value={moduleFilter}
                onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
                className="pl-8"
              />
            </div>
            <Select value={severity} onValueChange={(v) => { setSeverity(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-auto">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="DEBUG">Debug</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
                <SelectItem value="FATAL">Fatal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resolvedFilter || 'all'} onValueChange={(v) => { setResolvedFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-auto">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={clearFilters}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : logs.length === 0 ? (
            <EmptyState icon={FileWarning} title="No error logs" description="No error logs match your filters." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Severity</th>
                    <th className="pb-2 pr-4 font-medium">Exception</th>
                    <th className="pb-2 pr-4 font-medium">Module</th>
                    <th className="pb-2 pr-4 font-medium">URL</th>
                    <th className="pb-2 pr-4 font-medium">User</th>
                    <th className="pb-2 pr-4 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className={cn('hover:bg-accent/50', log.isResolved && 'opacity-60')}>
                      <td className="py-2.5 pr-4">
                        <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', SEVERITY_COLORS[log.severity] ?? SEVERITY_COLORS.INFO)}>
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs truncate max-w-[250px]" title={log.exception}>{log.exception}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground text-xs truncate max-w-[120px]">{log.module}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground text-xs truncate max-w-[150px] font-mono">{log.url ?? '—'}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{log.user?.name ?? '—'}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{formatRelativeTime(log.createdAt)}</td>
                      <td className="py-2.5">
                        {!log.isResolved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => resolveMutation.mutate(log.id)}
                            disabled={resolveMutation.isPending}
                          >
                            {resolveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Resolve
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
