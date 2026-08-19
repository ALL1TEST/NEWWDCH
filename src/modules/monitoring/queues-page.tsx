'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ListTodo,
  Clock,
  XCircle,
  Activity,
  Timer,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, EmptyState } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

// -------------------- Types --------------------

interface QueueStats {
  WAITING?: number;
  ACTIVE?: number;
  COMPLETED?: number;
  FAILED?: number;
  RETRYING?: number;
  runningWorkers?: number;
  avgProcessingTime?: number;
  throughputPerMinute?: number;
}

// -------------------- Helpers --------------------

function StatCard({ icon: Icon, label, value, color, iconColor }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color?: string;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardContent className={cn('p-4', color)}>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn('h-4 w-4', iconColor ?? 'text-muted-foreground')} />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

// -------------------- Queues Page --------------------

export function QueuesPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.jobs.all,
    queryFn: () => getApi<QueueStats>('/api/jobs/stats'),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const s = data ?? {};

  const totalQueued = (s.WAITING ?? 0) + (s.ACTIVE ?? 0) + (s.RETRYING ?? 0);
  const totalJobs = (s.WAITING ?? 0) + (s.ACTIVE ?? 0) + (s.COMPLETED ?? 0) + (s.FAILED ?? 0) + (s.RETRYING ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Queue Monitoring" description="Monitor background job queue status and throughput" />

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
            <StatCard icon={ListTodo} label="Queue Length" value={totalQueued} />
            <StatCard icon={Clock} label="Delayed Jobs" value={s.RETRYING ?? 0} iconColor="text-amber-500" />
            <StatCard icon={XCircle} label="Failed Jobs" value={s.FAILED ?? 0} iconColor="text-red-500" color="bg-red-50/50 dark:bg-red-950/20" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
            <StatCard icon={Activity} label="Running Workers" value={s.runningWorkers ?? '—'} />
            <StatCard icon={Timer} label="Avg Processing Time" value={s.avgProcessingTime != null ? `${(s.avgProcessingTime / 1000).toFixed(2)}s` : '—'} />
            <StatCard icon={Zap} label="Queue Throughput" value={s.throughputPerMinute != null ? `${s.throughputPerMinute.toFixed(1)}/min` : '—'} />
          </div>

          {/* Queue Status Visualization */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Queue Distribution</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {totalJobs === 0 ? (
                <EmptyState icon={CheckCircle2} title="Queue is empty" description="No jobs in the queue." />
              ) : (
                <div className="space-y-3">
                  {(
                    [
                      { status: 'WAITING', count: s.WAITING ?? 0, color: 'bg-zinc-400' },
                      { status: 'ACTIVE', count: s.ACTIVE ?? 0, color: 'bg-sky-500' },
                      { status: 'COMPLETED', count: s.COMPLETED ?? 0, color: 'bg-green-500' },
                      { status: 'FAILED', count: s.FAILED ?? 0, color: 'bg-red-500' },
                      { status: 'RETRYING', count: s.RETRYING ?? 0, color: 'bg-amber-500' },
                    ] as const
                  ).map((item) => {
                    const pct = totalJobs > 0 ? (item.count / totalJobs) * 100 : 0;
                    return (
                      <div key={item.status} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.status.replace(/_/g, ' ')}</span>
                          <span className="tabular-nums font-medium">{item.count} <span className="text-muted-foreground font-normal">({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={cn('h-full rounded-full transition-all', item.color)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
