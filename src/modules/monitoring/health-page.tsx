'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  MinusCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, EmptyState, StatusBadge } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime } from '@/lib/utils';

// -------------------- Types --------------------

interface HealthItem {
  name: string;
  status: string;
  lastCheck: string;
  latency: number;
  error?: string;
  version?: string;
  lastSuccess?: string;
}

// -------------------- Helpers --------------------

function HealthIcon({ status }: { status: string }) {
  switch (status) {
    case 'UP':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'DEGRADED':
      return <MinusCircle className="h-5 w-5 text-amber-500" />;
    case 'DOWN':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <MinusCircle className="h-5 w-5 text-zinc-400" />;
  }
}

const CARD_BORDER: Record<string, string> = {
  UP: 'border-green-200 dark:border-green-900/50',
  DEGRADED: 'border-amber-200 dark:border-amber-900/50',
  DOWN: 'border-red-200 dark:border-red-900/50',
};

const CARD_BG: Record<string, string> = {
  UP: 'bg-green-50/50 dark:bg-green-950/20',
  DEGRADED: 'bg-amber-50/50 dark:bg-amber-950/20',
  DOWN: 'bg-red-50/50 dark:bg-red-950/20',
};

// -------------------- Health Page --------------------

export function HealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.health(),
    queryFn: () => getApi<HealthItem[]>('/api/monitoring/health'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Health Checks" description="Monitor all system dependencies and services" />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No health data" description="Health check data is not yet available." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.name} className={cn('border', CARD_BORDER[item.status] ?? '')}>
              <CardContent className={cn('p-4', CARD_BG[item.status] ?? '')}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HealthIcon status={item.status} />
                    <span className="font-medium text-sm">{item.name}</span>
                  </div>
                  <StatusBadge status={item.status} size="sm" />
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Response Time</span>
                    <span className="tabular-nums font-medium text-foreground">{item.latency ?? 0}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Checked</span>
                    <span>{formatRelativeTime(item.lastCheck)}</span>
                  </div>
                  {item.version && (
                    <div className="flex items-center justify-between">
                      <span>Version</span>
                      <span className="font-mono">{item.version}</span>
                    </div>
                  )}
                </div>
                {item.error && (
                  <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1.5 break-all">
                    {item.error}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
