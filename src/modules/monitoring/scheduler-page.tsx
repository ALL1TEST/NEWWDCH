'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, EmptyState, StatusBadge } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { formatRelativeTime } from '@/lib/utils';
import { Clock } from 'lucide-react';

// -------------------- Types --------------------

interface SchedulerRow {
  id: string;
  jobName: string;
  type: string;
  status: string;
  cronExpression: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  duration: number | null;
  runCount: number;
  failCount: number;
}

// -------------------- Scheduler Page --------------------

export function SchedulerPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.schedulerLogs(),
    queryFn: () => getApi<SchedulerRow[]>('/api/monitoring/scheduler'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Scheduler" description="View scheduled jobs and cron task status" />

      {isLoading ? (
        <Card><CardContent className="p-4"><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card>
      ) : rows.length === 0 ? (
        <EmptyState icon={Clock} title="No scheduled jobs" description="No scheduler entries found." />
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Job Name</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Cron</th>
                    <th className="pb-2 pr-4 font-medium">Last Run</th>
                    <th className="pb-2 pr-4 font-medium">Next Run</th>
                    <th className="pb-2 pr-4 font-medium">Duration</th>
                    <th className="pb-2 pr-4 font-medium">Runs</th>
                    <th className="pb-2 font-medium">Fails</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-accent/50">
                      <td className="py-2.5 pr-4 font-medium truncate max-w-[180px]">{row.jobName}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground text-xs">{row.type}</td>
                      <td className="py-2.5 pr-4"><StatusBadge status={row.status} size="sm" /></td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{row.cronExpression}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{row.lastRunAt ? formatRelativeTime(row.lastRunAt) : '—'}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{row.nextRunAt ? formatRelativeTime(row.nextRunAt) : '—'}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{row.duration != null ? `${(row.duration / 1000).toFixed(1)}s` : '—'}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{row.runCount}</td>
                      <td className="py-2.5 tabular-nums text-red-600 dark:text-red-400">{row.failCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
