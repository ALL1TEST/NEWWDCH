'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, EmptyState } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { Wifi, WifiOff, AlertTriangle, Clock, Zap, ChevronRight } from 'lucide-react';

// -------------------- Types --------------------

interface ServiceStatus {
  name: string;
  status: string;
  latency?: number;
  lastSuccess?: string;
  lastError?: string;
  quotaInfo?: string;
  provider?: string;
}

interface ApiStatusData {
  services: ServiceStatus[];
  summary?: {
    up: number;
    down: number;
    degraded: number;
    disabled: number;
  };
}

// -------------------- Helpers --------------------

function StatusDot({ status }: { status: string }) {
  if (status === 'CONNECTED' || status === 'UP' || status === 'OK') return <div className="h-2.5 w-2.5 rounded-full bg-green-500" />;
  if (status === 'DISCONNECTED' || status === 'DOWN') return <WifiOff className="h-4 w-4 text-red-500" />;
  if (status === 'ERROR') return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (status === 'DEGRADED' || status === 'WARNING') return <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />;
  return <div className="h-2.5 w-2.5 rounded-full bg-zinc-400" />;
}

const STATUS_LABEL_COLORS: Record<string, string> = {
  CONNECTED: 'text-green-600 dark:text-green-400',
  UP: 'text-green-600 dark:text-green-400',
  OK: 'text-green-600 dark:text-green-400',
  DISCONNECTED: 'text-red-600 dark:text-red-400',
  DOWN: 'text-red-600 dark:text-red-400',
  ERROR: 'text-red-600 dark:text-red-400',
  DEGRADED: 'text-amber-600 dark:text-amber-400',
  WARNING: 'text-amber-600 dark:text-amber-400',
  DISABLED: 'text-zinc-500 dark:text-zinc-400',
};

// -------------------- API Status Page --------------------

export function ApiStatusPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.apiStatus(),
    queryFn: () => getApi<ApiStatusData>('/api/monitoring/api-status'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const services = data?.services ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader title="API Status" description="Monitor external service connectivity and health" />
      <Button variant="outline" onClick={() => useNavigationStore.getState().navigate('api')} className="gap-2">
        Manage API <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Wifi className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Connected</span></div><p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{summary.up}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><WifiOff className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Disconnected</span></div><p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{summary.down}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Degraded</span></div><p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary.degraded}</p></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-zinc-400" /><span className="text-xs text-muted-foreground">Disabled</span></div><p className="text-2xl font-bold tabular-nums text-zinc-500">{summary.disabled}</p></CardContent></Card>
        </div>
      )}

      {/* Service Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-28 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState icon={Wifi} title="No services" description="No external services configured." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((svc) => (
            <Card key={svc.name} className={cn(
              'border',
              (svc.status === 'CONNECTED' || svc.status === 'UP' || svc.status === 'OK') && 'border-green-200 dark:border-green-900/50',
              (svc.status === 'ERROR' || svc.status === 'DOWN' || svc.status === 'DISCONNECTED') && 'border-red-200 dark:border-red-900/50',
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{svc.name}</span>
                  <StatusDot status={svc.status} />
                </div>
                <p className={cn('text-sm font-semibold mb-2', STATUS_LABEL_COLORS[svc.status] ?? 'text-zinc-500')}>
                  {svc.status === 'CONNECTED' ? 'Connected' : svc.status === 'DISCONNECTED' ? 'Disconnected' : svc.status === 'ERROR' ? 'Error' : svc.status === 'DEGRADED' ? 'Degraded' : svc.status}
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {svc.latency != null && (
                    <div className="flex items-center justify-between">
                      <span>Latency</span>
                      <span className="tabular-nums font-medium text-foreground">{svc.latency}ms</span>
                    </div>
                  )}
                  {svc.lastSuccess && (
                    <div className="flex items-center justify-between">
                      <span>Last Success</span>
                      <span>{formatRelativeTime(svc.lastSuccess)}</span>
                    </div>
                  )}
                  {svc.lastError && (
                    <div className="flex items-center justify-between">
                      <span>Last Error</span>
                      <span>{formatRelativeTime(svc.lastError)}</span>
                    </div>
                  )}
                  {svc.quotaInfo && (
                    <div className="flex items-center justify-between">
                      <span>Quota</span>
                      <Zap className="h-3 w-3 text-amber-500" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
