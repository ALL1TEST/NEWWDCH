'use client';

// ============================================================
// PLATFORM SYSTEM HEALTH — infrastructure status board.
// All values are DEMO/MOCK data sourced from the centralized
// platform dataset. They are NOT real monitoring. A clear
// banner states this. Visual language mirrors
// platform-overview.tsx.
// ============================================================

import React from 'react';
import { useMemo } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Server, Info, AlertTriangle, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PlatformPageHeader, HealthBadge, ErrorState, usePlatformApi,
} from './shared';
import type { SystemHealthItem } from '@/lib/platform/platform-data';

export function PlatformSystemHealthModule() {
  const { data, isLoading, isError, refetch } = usePlatformApi<SystemHealthItem[]>(
    '/api/platform/admin/system-health',
    ['platform-system-health'],
  );

  // Derived counts for the summary line. All-operational vs. degraded/down.
  const summary = useMemo(() => {
    if (!data) return { allOk: false, degraded: 0, down: 0, total: 0 };
    const degraded = data.filter((d) => d.status === 'degraded').length;
    const down = data.filter((d) => d.status === 'down').length;
    return { allOk: degraded === 0 && down === 0, degraded, down, total: data.length };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="System Health" subtitle="Platform infrastructure status (demo data)." />
        <DemoBanner />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="System Health" subtitle="Platform infrastructure status (demo data)." />
        <Card>
          <CardContent className="p-6">
            <ErrorState message="Could not load system health. Please retry." onRetry={() => refetch()} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader title="System Health" subtitle="Platform infrastructure status (demo data)." />

      {/* Demo-data banner — explicit so no one mistakes mock health for real monitoring */}
      <DemoBanner />

      {/* Summary line */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center',
                summary.allOk
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
              )}
            >
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {summary.allOk
                  ? 'All systems operational'
                  : `${summary.degraded} degraded${summary.down > 0 ? `, ${summary.down} down` : ''}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.total} services monitored (demo)
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              summary.allOk
                ? 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400'
                : 'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
            )}
          >
            {summary.allOk ? 'Operational' : 'Issues detected'}
          </Badge>
        </CardContent>
      </Card>

      {/* Health cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {data.map((h) => (
          <HealthCard key={h.key} item={h} />
        ))}
      </div>
    </div>
  );
}

// -------------------- Sub-components --------------------

function DemoBanner() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Info className="h-4 w-4" />
          </div>
          <div className="text-sm text-muted-foreground">
            Statuses below are demo data. Connect real health checks in production.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_BORDER: Record<SystemHealthItem['status'], string> = {
  operational: 'border-l-emerald-500',
  degraded: 'border-l-amber-500',
  down: 'border-l-rose-500',
};

const STATUS_ICON: Record<SystemHealthItem['status'], React.ReactNode> = {
  operational: <HeartPulse className="h-4 w-4 text-emerald-500" />,
  degraded: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  down: <Info className="h-4 w-4 text-rose-500" />,
};

function HealthCard({ item }: { item: SystemHealthItem }) {
  return (
    <Card className={cn('border-l-4', STATUS_BORDER[item.status])}>
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0">{STATUS_ICON[item.status]}</span>
            <p className="text-sm font-semibold truncate">{item.label}</p>
          </div>
        </div>
        <HealthBadge status={item.status} />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Server className="h-3 w-3" />
          <span>{item.latencyMs}ms latency</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{item.note}</p>
      </CardContent>
    </Card>
  );
}
