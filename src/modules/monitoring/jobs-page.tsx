'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Activity,
  Loader2,
  Ban,
  ArrowUp,
  TrendingUp,
  Zap,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, EmptyState, StatusBadge } from '@/components/patterns';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime, labelize } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaginatedResponse, JobStatus } from '@/shared/types';

// -------------------- Types --------------------

interface JobRow {
  id: string;
  name: string;
  site?: { id: string; name: string } | null;
  status: JobStatus;
  retries: number;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
}

interface JobStats {
  WAITING: number;
  ACTIVE: number;
  COMPLETED: number;
  FAILED: number;
  RETRYING: number;
  avgDuration?: number;
  longestJob?: number;
  successRate?: number;
  jobsPerMinute?: number;
  workers?: number;
}

// -------------------- Constants --------------------

const STATUS_STYLES: Record<string, { color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  WAITING: { color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', Icon: Clock },
  ACTIVE: { color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', Icon: Activity },
  COMPLETED: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', Icon: CheckCircle2 },
  FAILED: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', Icon: XCircle },
  RETRYING: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', Icon: RotateCcw },
};

// -------------------- Jobs Page --------------------

export function JobsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.jobs.all,
    queryFn: () => getApi<JobStats>('/api/jobs/stats'),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.jobs.list({ page, pageSize: 20 }),
    queryFn: () => getApi<PaginatedResponse<JobRow>>('/api/jobs', { page, pageSize: 20 }),
    staleTime: 5_000,
  });

  const jobs = data?.data ?? [];
  const pagination = data?.pagination;

  const cancelMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/jobs/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      toast.success('Job cancelled');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to cancel job'),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/jobs/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      toast.success('Job retried');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to retry job'),
  });

  const s: JobStats = stats ?? ({} as JobStats);

  return (
    <div className="space-y-6">
      <PageHeader title="Job Monitoring" description="Track background job execution and status" />

      {/* Status Count Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {(Object.entries(STATUS_STYLES) as [JobStatus, typeof STATUS_STYLES[string]][]).map(([status, style]) => {
          const Icon = style.Icon;
          const count = (s as unknown as Record<string, number>)[status] ?? 0;
          return (
            <Card key={status}>
              <CardContent className="p-4 text-center">
                <Icon className={cn('h-5 w-5 mx-auto mb-2', style.color.includes('green') ? 'text-green-500' : style.color.includes('red') ? 'text-red-500' : style.color.includes('amber') ? 'text-amber-500' : style.color.includes('sky') ? 'text-sky-500' : 'text-zinc-500')} />
                <p className="text-2xl font-bold tabular-nums">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{labelize(status)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><ArrowUp className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Avg Duration</span></div><p className="text-lg font-bold tabular-nums">{s.avgDuration != null ? `${(s.avgDuration / 1000).toFixed(1)}s` : '—'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Longest Job</span></div><p className="text-lg font-bold tabular-nums">{s.longestJob != null ? `${(s.longestJob / 1000).toFixed(1)}s` : '—'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Success Rate</span></div><p className="text-lg font-bold tabular-nums">{s.successRate != null ? `${s.successRate.toFixed(1)}%` : '—'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Zap className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Jobs/Min</span></div><p className="text-lg font-bold tabular-nums">{s.jobsPerMinute != null ? s.jobsPerMinute.toFixed(1) : '—'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Workers</span></div><p className="text-lg font-bold tabular-nums">{s.workers ?? '—'}</p></CardContent></Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : jobs.length === 0 ? (
            <EmptyState icon={Clock} title="No jobs" description="No background jobs have been recorded." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Site</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Retries</th>
                    <th className="pb-2 pr-4 font-medium">Started</th>
                    <th className="pb-2 pr-4 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-accent/50">
                      <td className="py-2.5 pr-4 font-medium truncate max-w-[200px]">{job.name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground truncate max-w-[120px]">{job.site?.name ?? '—'}</td>
                      <td className="py-2.5 pr-4"><StatusBadge status={job.status} size="sm" /></td>
                      <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{job.retries}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{formatRelativeTime(job.startedAt)}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{job.duration != null ? `${(job.duration / 1000).toFixed(1)}s` : '—'}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          {(job.status === 'WAITING' || job.status === 'ACTIVE' || job.status === 'RETRYING') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => cancelMutation.mutate(job.id)}
                              disabled={cancelMutation.isPending}
                            >
                              {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {job.status === 'FAILED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => retryMutation.mutate(job.id)}
                              disabled={retryMutation.isPending}
                            >
                              {retryMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                        </div>
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
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
