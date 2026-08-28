'use client';

// ============================================================
// PLATFORM USAGE / ANALYTICS — platform-wide usage metrics.
// Numbers derive from /api/platform/admin/usage which reads the
// centralized platform dataset. Visual language mirrors
// platform-overview.tsx (same Card/KPI/Badge, same recharts
// tooltip styling).
// ============================================================

import React from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  Globe, FileText, Sparkles, Cpu, HardDrive, Zap, Activity,
} from 'lucide-react';
import {
  PlatformPageHeader, PlatformKpi, KpiGridSkeleton, ErrorState,
  usePlatformApi, formatBytes,
} from './shared';
import type { PlatformUsage } from '@/lib/platform/platform-data';

export function PlatformUsageModule() {
  const { data, isLoading, isError, refetch } = usePlatformApi<PlatformUsage>(
    '/api/platform/admin/usage',
    ['platform-usage'],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="Usage / Analytics" subtitle="Platform-wide usage across all customers." />
        <KpiGridSkeleton count={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="Usage / Analytics" subtitle="Platform-wide usage across all customers." />
        <Card>
          <CardContent className="p-6">
            <ErrorState message="Could not load platform usage. Please retry." onRetry={() => refetch()} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Aggregate values for the breakdown chart. Use the actual numbers from
  // the centralized dataset (no independent hardcoding).
  const chartData = [
    { label: 'Articles', value: data.totalArticles },
    { label: 'AI Articles', value: data.aiArticlesGenerated },
    { label: 'Sites', value: data.totalSites },
    { label: 'Automation Runs', value: data.automationRuns },
  ];

  // Per-bar colors — never indigo/blue. Each bar carries its own Cell.
  const barColors = ['#8b5cf6', '#f59e0b', '#0ea5e9', '#64748b'];

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Usage / Analytics"
        subtitle="Platform-wide usage across all customers."
        actions={
          <Badge variant="outline" className="text-xs">
            <Activity className="h-3 w-3 mr-1" />
            Live snapshot
          </Badge>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <PlatformKpi
          label="Total Sites"
          value={data.totalSites.toLocaleString()}
          sublabel="Across all customers"
          icon={<Globe className="h-4 w-4" />}
          color="sky"
        />
        <PlatformKpi
          label="Total Articles"
          value={data.totalArticles.toLocaleString()}
          sublabel="Published across sites"
          icon={<FileText className="h-4 w-4" />}
          color="violet"
        />
        <PlatformKpi
          label="AI Articles Generated"
          value={data.aiArticlesGenerated.toLocaleString()}
          sublabel="AI-assisted content"
          icon={<Sparkles className="h-4 w-4" />}
          color="amber"
        />
        <PlatformKpi
          label="AI Words Generated"
          value={data.aiWordsGenerated.toLocaleString()}
          sublabel="Cumulative AI output"
          icon={<Cpu className="h-4 w-4" />}
          color="emerald"
        />
        <PlatformKpi
          label="Media Storage Used"
          value={formatBytes(data.mediaStorageBytes)}
          sublabel="Combined customer storage"
          icon={<HardDrive className="h-4 w-4" />}
          color="rose"
        />
        <PlatformKpi
          label="Automation Runs"
          value={data.automationRuns.toLocaleString()}
          sublabel="Scheduled + triggered jobs"
          icon={<Zap className="h-4 w-4" />}
          color="default"
        />
      </div>

      {/* Usage breakdown chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Usage Breakdown</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Relative scale across key platform usage categories
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'var(--muted-foreground)' }}
                itemStyle={{ color: 'var(--popover-foreground)' }}
                formatter={(v: number) => [v.toLocaleString(), 'Count']}
                cursor={{ fill: 'var(--muted)', opacity: 0.25 }}
              />
              <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={barColors[i % barColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
