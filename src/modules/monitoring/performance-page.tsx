'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, EmptyState } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';

// -------------------- Types --------------------

interface MetricPoint {
  id: string;
  metricType: string;
  value: number;
  unit: string;
  createdAt: string;
}

interface PerformanceData {
  latest?: MetricPoint;
  avgByType?: Record<string, { avg: number; min: number; max: number; count: number }>;
  history: MetricPoint[];
}

// -------------------- Constants --------------------

const METRIC_TYPES = [
  { value: 'cpu', label: 'CPU' },
  { value: 'ram', label: 'RAM' },
  { value: 'disk', label: 'Disk' },
  { value: 'network', label: 'Network' },
  { value: 'requests', label: 'Requests' },
  { value: 'response_time', label: 'Response Time' },
  { value: 'db_queries', label: 'DB Queries' },
  { value: 'cache_hit_ratio', label: 'Cache Hit Ratio' },
  { value: 'queue_throughput', label: 'Queue Throughput' },
  { value: 'ai_usage', label: 'AI Usage' },
] as const;

// -------------------- Performance Page --------------------

export function PerformancePage() {
  const [selectedType, setSelectedType] = useState<string>('cpu');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.performance({ type: selectedType }),
    queryFn: () => getApi<PerformanceData>('/api/monitoring/performance', { type: selectedType }),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const latest = data?.latest;
  const avg = data?.avgByType?.[selectedType];
  const history = data?.history ?? [];

  // Compute bar heights for mini visualization
  const maxVal = Math.max(...history.map((h) => h.value), 1);
  const bars = history.slice(-20);

  return (
    <div className="space-y-6">
      <PageHeader title="Performance Metrics" description="Monitor system performance across key metrics" />

      {/* Metric Selector */}
      <div className="flex flex-wrap gap-2">
        {METRIC_TYPES.map((mt) => (
          <button
            key={mt.value}
            onClick={() => setSelectedType(mt.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
              selectedType === mt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-accent'
            )}
          >
            {mt.label}
          </button>
        ))}
      </div>

      {/* Current Value Card */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {METRIC_TYPES.find((m) => m.value === selectedType)?.label} — Current
              </p>
              <p className="text-3xl font-bold tabular-nums">
                {latest?.value?.toFixed(1) ?? '—'}
                <span className="text-sm font-normal text-muted-foreground ml-1">{latest?.unit ?? ''}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground mb-1">Average</p>
              <p className="text-3xl font-bold tabular-nums">
                {avg?.avg?.toFixed(1) ?? '—'}
                <span className="text-sm font-normal text-muted-foreground ml-1">{latest?.unit ?? ''}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground mb-1">Range (Min – Max)</p>
              <p className="text-3xl font-bold tabular-nums">
                {avg ? `${avg.min.toFixed(1)} – ${avg.max.toFixed(1)}` : '—'}
                <span className="text-sm font-normal text-muted-foreground ml-1">{latest?.unit ?? ''}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mini Bar Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Trend (Last {bars.length} Readings)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {bars.length === 0 ? (
            <EmptyState icon={BarChart3} title="No metric data" description="No readings available for the selected metric." />
          ) : (
            <div className="flex items-end gap-1 h-24">
              {bars.map((point) => {
                const pct = (point.value / maxVal) * 100;
                const isHigh = pct > 80;
                return (
                  <div
                    key={point.id}
                    className={cn(
                      'flex-1 rounded-t-sm min-w-[4px] transition-all',
                      isHigh ? 'bg-red-400 dark:bg-red-600' : pct > 50 ? 'bg-amber-400 dark:bg-amber-600' : 'bg-green-400 dark:bg-green-600'
                    )}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                    title={`${point.value} ${point.unit} — ${formatRelativeTime(point.createdAt)}`}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Metric History</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No metric history available.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Value</th>
                    <th className="pb-2 pr-4 font-medium">Unit</th>
                    <th className="pb-2 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.slice(-20).reverse().map((point) => (
                    <tr key={point.id} className="hover:bg-accent/50">
                      <td className="py-2 pr-4 tabular-nums font-medium">{point.value.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{point.unit}</td>
                      <td className="py-2 text-muted-foreground">{formatRelativeTime(point.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
