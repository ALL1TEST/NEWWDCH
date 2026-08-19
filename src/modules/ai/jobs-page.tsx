'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, patchApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { AiJobStatus, AiJobType, PaginatedResponse } from '@/shared/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Search, ChevronLeft, ChevronRight, Loader2, Clock, CheckCircle2, XCircle, RefreshCw, X as XIcon, Eye, Zap,
} from 'lucide-react';

// -------------------- Types --------------------

interface AiJob {
  id: string;
  title: string;
  type: AiJobType;
  status: AiJobStatus;
  providerId: string;
  provider?: { id: string; name: string };
  modelId: string;
  model?: { id: string; name: string };
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  durationMs: number | null;
  cost: number | null;
  createdAt: string;
  updatedAt: string;
}

// -------------------- Constants --------------------

const JOB_STATUS_CONFIG: Record<AiJobStatus, { color: string; icon: React.ElementType }> = {
  PENDING: { color: 'bg-zinc-100 text-zinc-700', icon: Clock },
  RUNNING: { color: 'bg-sky-100 text-sky-700', icon: Loader2 },
  COMPLETED: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  FAILED: { color: 'bg-red-100 text-red-700', icon: XCircle },
  RETRYING: { color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
  CANCELLED: { color: 'bg-zinc-200 text-zinc-500', icon: XIcon },
};

const JOB_TYPE_LABELS: Record<AiJobType, string> = {
  GENERATE_ARTICLE: 'Generate Article',
  REWRITE_CONTENT: 'Rewrite Content',
  SEO_OPTIMIZATION: 'SEO Optimization',
  GENERATE_IMAGES: 'Generate Images',
  TRANSLATE_ARTICLE: 'Translate Article',
  CUSTOM: 'Custom',
};

const JOB_TYPE_COLORS: Record<AiJobType, string> = {
  GENERATE_ARTICLE: 'bg-emerald-100 text-emerald-700',
  REWRITE_CONTENT: 'bg-violet-100 text-violet-700',
  SEO_OPTIMIZATION: 'bg-orange-100 text-orange-700',
  GENERATE_IMAGES: 'bg-pink-100 text-pink-700',
  TRANSLATE_ARTICLE: 'bg-sky-100 text-sky-700',
  CUSTOM: 'bg-zinc-100 text-zinc-700',
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'RETRYING', label: 'Retrying' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// -------------------- Component --------------------

export function JobsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [detailJob, setDetailJob] = useState<AiJob | null>(null);

  // Fetch jobs
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.aiJobs.list({ page, pageSize, search, status: statusFilter, type: typeFilter }),
    queryFn: () => getApi<PaginatedResponse<AiJob>>('/api/ai/jobs', {
      page, pageSize,
      search: search || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
    }),
  });

  const jobs = data?.data ?? [];
  const pagination = data?.pagination;

  // Auto-refresh for running jobs
  const hasRunning = jobs.some((j) => j.status === 'RUNNING' || j.status === 'RETRYING' || j.status === 'PENDING');
  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [hasRunning, refetch]);

  // Fetch single job detail
  const { data: jobDetail } = useQuery({
    queryKey: queryKeys.aiJobs.detail(detailJob?.id ?? ''),
    queryFn: () => getApi<AiJob>(`/api/ai/jobs/${detailJob!.id}`),
    enabled: !!detailJob,
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/ai/jobs/${id}`, { status: 'CANCELLED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiJobs.all });
      toast.success('Job cancelled');
      setDetailJob(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to cancel'),
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/jobs/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiJobs.all });
      toast.success('Job retried');
      setDetailJob(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to retry'),
  });

  // KPI calculations
  const totalCount = pagination?.total ?? 0;
  const runningCount = jobs.filter((j) => j.status === 'RUNNING').length;
  const failedCount = jobs.filter((j) => j.status === 'FAILED').length;
  const completedToday = jobs.filter((j) => j.status === 'COMPLETED' && new Date(j.createdAt).toDateString() === new Date().toDateString()).length;

  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-100"><Clock className="h-4 w-4 text-zinc-600" /></div>
            <div>
              <p className="text-xs text-zinc-500">Total Jobs</p>
              <p className="text-xl font-bold">{isLoading ? <Skeleton className="h-6 w-10 inline-block" /> : totalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-100"><Loader2 className="h-4 w-4 text-sky-600" /></div>
            <div>
              <p className="text-xs text-zinc-500">Running</p>
              <p className="text-xl font-bold">{isLoading ? <Skeleton className="h-6 w-10 inline-block" /> : runningCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><XCircle className="h-4 w-4 text-red-600" /></div>
            <div>
              <p className="text-xs text-zinc-500">Failed</p>
              <p className="text-xl font-bold">{isLoading ? <Skeleton className="h-6 w-10 inline-block" /> : failedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
            <div>
              <p className="text-xs text-zinc-500">Completed Today</p>
              <p className="text-xl font-bold">{isLoading ? <Skeleton className="h-6 w-10 inline-block" /> : completedToday}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input placeholder="Search jobs..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Provider</TableHead>
                  <TableHead className="hidden lg:table-cell">Model</TableHead>
                  <TableHead className="hidden md:table-cell">Duration</TableHead>
                  <TableHead className="hidden lg:table-cell">Cost</TableHead>
                  <TableHead className="hidden xl:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                    ))}</TableRow>
                  ))
                ) : isError ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-zinc-500">Failed to load jobs</TableCell></TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-zinc-500">
                    <Zap className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                    No jobs found.
                  </TableCell></TableRow>
                ) : jobs.map((job) => {
                  const statusConf = JOB_STATUS_CONFIG[job.status];
                  const StatusIcon = statusConf.icon;
                  return (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{job.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={JOB_TYPE_COLORS[job.type]}>{JOB_TYPE_LABELS[job.type]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusConf.color}>
                          <StatusIcon className={`h-3 w-3 mr-1 ${job.status === 'RUNNING' || job.status === 'RETRYING' ? 'animate-spin' : ''}`} />
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{job.provider?.name ?? '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm max-w-[150px] truncate">{job.model?.name ?? '—'}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{formatDuration(job.durationMs)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{job.cost != null ? `$${job.cost.toFixed(4)}` : '—'}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-zinc-500">{new Date(job.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailJob(job)}><Eye className="h-3.5 w-3.5" /></Button>
                          {job.status === 'FAILED' && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => retryMutation.mutate(job.id)} disabled={retryMutation.isPending}>
                              <RefreshCw className={`h-3.5 w-3.5 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          {(job.status === 'PENDING' || job.status === 'RUNNING') && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => cancelMutation.mutate(job.id)}><XIcon className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar />
          </ScrollArea>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-zinc-500">{(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Detail Dialog */}
      <Dialog open={!!detailJob} onOpenChange={(open) => { if (!open) setDetailJob(null); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Details{jobDetail ? ` — ${jobDetail.title}` : ''}</DialogTitle>
          </DialogHeader>
          {jobDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-zinc-500">Status</p><Badge variant="secondary" className={JOB_STATUS_CONFIG[jobDetail.status].color}>{jobDetail.status}</Badge></div>
                <div><p className="text-xs text-zinc-500">Type</p><Badge variant="secondary" className={JOB_TYPE_COLORS[jobDetail.type]}>{JOB_TYPE_LABELS[jobDetail.type]}</Badge></div>
                <div><p className="text-xs text-zinc-500">Duration</p><p className="text-sm font-medium">{formatDuration(jobDetail.durationMs)}</p></div>
                <div><p className="text-xs text-zinc-500">Cost</p><p className="text-sm font-medium">{jobDetail.cost != null ? `$${jobDetail.cost.toFixed(4)}` : '—'}</p></div>
                <div><p className="text-xs text-zinc-500">Provider</p><p className="text-sm font-medium">{jobDetail.provider?.name ?? '—'}</p></div>
                <div><p className="text-xs text-zinc-500">Model</p><p className="text-sm font-medium">{jobDetail.model?.name ?? '—'}</p></div>
              </div>

              {jobDetail.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-600 mb-1">Error</p>
                  <p className="text-sm text-red-700">{jobDetail.error}</p>
                </div>
              )}

              {jobDetail.input && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-1">Input</p>
                  <pre className="bg-zinc-50 rounded-lg p-3 text-xs overflow-auto max-h-[200px]">{JSON.stringify(jobDetail.input, null, 2)}</pre>
                </div>
              )}

              {jobDetail.output && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-1">Output</p>
                  <pre className="bg-zinc-50 rounded-lg p-3 text-xs overflow-auto max-h-[200px]">{JSON.stringify(jobDetail.output, null, 2)}</pre>
                </div>
              )}

              <Separator />

              <div className="flex gap-2">
                {jobDetail.status === 'FAILED' && (
                  <Button variant="outline" onClick={() => retryMutation.mutate(jobDetail.id)} disabled={retryMutation.isPending}>
                    {retryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <RefreshCw className="h-4 w-4 mr-2" /> Retry
                  </Button>
                )}
                {(jobDetail.status === 'PENDING' || jobDetail.status === 'RUNNING') && (
                  <Button variant="outline" className="text-red-600" onClick={() => cancelMutation.mutate(jobDetail.id)}>
                    <XIcon className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
