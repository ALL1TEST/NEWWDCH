'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  DollarSign,
  Clock,
  TrendingUp,
  Hash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, EmptyState } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

// -------------------- Types --------------------

interface AiStatsSummary {
  totalRequests: number;
  totalCost: number;
  avgLatency: number;
  successRate: number;
  totalTokens: number;
}

interface AiProviderStat {
  provider: string;
  model?: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  avgLatency: number;
  errorRate: number;
  successRate: number;
}

interface AiStatsData {
 summary: AiStatsSummary;
  byProvider?: AiProviderStat[];
}

// -------------------- Constants --------------------

const RANGES = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
] as const;

// -------------------- AI Monitoring Page --------------------

export function AiMonitoringPage() {
  const [range, setRange] = useState<string>('30d');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.aiStats({ range }),
    queryFn: () => getApi<AiStatsData>('/api/monitoring/ai-stats', { range }),
    staleTime: 30_000,
  });

  const summary = data?.summary;
  const providers = data?.byProvider ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="AI Monitoring" description="Track AI provider usage, costs, and performance" />

      {/* Range Selector */}
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
              range === r.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-accent'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Sparkles className="h-4 w-4 text-violet-500" /><span className="text-xs text-muted-foreground">Total Requests</span></div>
              <p className="text-2xl font-bold tabular-nums">{summary?.totalRequests ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Total Cost</span></div>
              <p className="text-2xl font-bold tabular-nums">${summary?.totalCost?.toFixed(2) ?? '0.00'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Avg Latency</span></div>
              <p className="text-2xl font-bold tabular-nums">{summary?.avgLatency?.toFixed(0) ?? '—'}ms</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Success Rate</span></div>
              <p className="text-2xl font-bold tabular-nums">{summary?.successRate != null ? `${summary.successRate.toFixed(1)}%` : '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Hash className="h-4 w-4 text-sky-500" /><span className="text-xs text-muted-foreground">Total Tokens</span></div>
              <p className="text-2xl font-bold tabular-nums">{(summary?.totalTokens ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provider Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usage by Provider</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {providers.length === 0 ? (
            <EmptyState icon={Sparkles} title="No AI usage data" description="No AI requests have been made in this period." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Provider</th>
                    <th className="pb-2 pr-4 font-medium">Model</th>
                    <th className="pb-2 pr-4 font-medium">Requests</th>
                    <th className="pb-2 pr-4 font-medium">Tokens (In/Out/Total)</th>
                    <th className="pb-2 pr-4 font-medium">Cost</th>
                    <th className="pb-2 pr-4 font-medium">Avg Latency</th>
                    <th className="pb-2 pr-4 font-medium">Error Rate</th>
                    <th className="pb-2 font-medium">Success Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {providers.map((prov) => (
                    <tr key={prov.provider} className="hover:bg-accent/50">
                      <td className="py-2.5 pr-4 font-medium">{prov.provider}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground text-xs">{prov.model ?? '—'}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{prov.requests}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-xs text-muted-foreground">{prov.inputTokens.toLocaleString()} / {prov.outputTokens.toLocaleString()} / {prov.totalTokens.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 tabular-nums">${prov.cost.toFixed(2)}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{prov.avgLatency.toFixed(0)}ms</td>
                      <td className="py-2.5 pr-4 tabular-nums">{prov.errorRate.toFixed(1)}%</td>
                      <td className="py-2.5 tabular-nums">
                        <span className={cn('text-xs font-medium', prov.successRate >= 95 ? 'text-green-600 dark:text-green-400' : prov.successRate >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
                          {prov.successRate.toFixed(1)}%
                        </span>
                      </td>
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
