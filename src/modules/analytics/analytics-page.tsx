'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Eye,
  Users,
  Clock,
  TrendingUp,
  BarChart3,
  PieChartIcon,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useChartTheme } from '@/lib/chart-theme';
import { useT } from '@/lib/i18n';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { PostStatus, ChartDataPoint } from '@/shared/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// -------------------- Types --------------------

interface AnalyticsSummary {
  totalPageViews: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  bounceRate: number;
}

interface TopContentItem {
  id: string;
  title: string;
  views: number;
  status: PostStatus;
}

interface ActivityEvent {
  id: string;
  action: string;
  description: string;
  user: { name: string; avatar?: string };
  createdAt: string;
}

// -------------------- Date Range Presets --------------------

// i18n: labelKey resolves through t() at render time (see
// DATE_PRESETS.map in the component below) so the labels follow
// the selected language while the query values stay stable.
const DATE_PRESETS = [
  { labelKey: 'analytics.presetToday', value: 'today' },
  { labelKey: 'analytics.preset7d', value: '7d' },
  { labelKey: 'analytics.preset30d', value: '30d' },
  { labelKey: 'analytics.preset90d', value: '90d' },
  { labelKey: 'analytics.presetCustom', value: 'custom' },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]['value'];

// -------------------- Pie Colors --------------------

const STATUS_PIE_COLORS: Record<string, string> = {
  PUBLISHED: '#22c55e',
  DRAFT: '#71717a',
  IN_REVIEW: '#f59e0b',
  APPROVED: '#10b981',
  ARCHIVED: '#a1a1aa',
  UNPUBLISHED: '#f97316',
};

const BAR_COLOR = '#6366f1';

// -------------------- Stat Card --------------------

function StatCard({
  title,
  value,
  icon: Icon,
  suffix,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  suffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------- Main Component --------------------

export function AnalyticsPage() {
  const { t } = useT();
  // Shared theme-aware chart palette (see lib/chart-theme.ts).
  const chart = useChartTheme();
  const [preset, setPreset] = useState<DatePreset>('30d');

  // Fetch summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: queryKeys.analytics.overview({ range: preset }),
    queryFn: () => getApi<AnalyticsSummary>('/api/analytics', { range: preset }),
    staleTime: 30_000,
  });

  // Fetch top content for bar chart
  const { data: topContent, isLoading: contentLoading } = useQuery({
    queryKey: queryKeys.analytics.topContent({ range: preset }),
    queryFn: () => getApi<TopContentItem[]>('/api/analytics/top-content', { range: preset, limit: 10 }),
    staleTime: 30_000,
  });

  // Fetch content for status distribution
  const { data: contentList } = useQuery({
    queryKey: queryKeys.content.list({ pageSize: 1000 }),
    queryFn: () => getApi<{ data: { status: PostStatus }[] }>('/api/content', { pageSize: 1000 }),
    staleTime: 60_000,
  });

  // Fetch recent activity
  const { data: activityEvents, isLoading: activityLoading } = useQuery({
    queryKey: queryKeys.analytics.events({ limit: 20 }),
    queryFn: () => getApi<ActivityEvent[]>('/api/analytics/events', { limit: 20 }),
    staleTime: 30_000,
  });

  // ---- Chart Data Derivation ----

  const barChartData = useMemo(() => {
    if (!topContent) return [];
    return topContent
      .map((item) => ({
        name: item.title.length > 20 ? `${item.title.slice(0, 20)}...` : item.title,
        views: item.views,
      }));
  }, [topContent]);

  const pieChartData = useMemo(() => {
    if (!contentList?.data) return [];
    const counts: Record<string, number> = {};
    contentList.data.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count,
      status,
    }));
  }, [contentList]);

  const safeSummary = summary ?? { totalPageViews: 0, uniqueVisitors: 0, avgTimeOnPage: 0, bounceRate: 0 };

  return (
    <div className="space-y-6">
      <PageHeader title={t('analytics.title')} description={t('analytics.pageDescription')} />

      {/* Date Range Selector */}
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((p) => (
          <Button
            key={p.value}
            variant={preset === p.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPreset(p.value)}
          >
            {t(p.labelKey)}
          </Button>
        ))}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('analytics.totalPageViews')}
          value={safeSummary.totalPageViews}
          icon={Eye}
        />
        <StatCard
          title={t('analytics.uniqueVisitors')}
          value={safeSummary.uniqueVisitors}
          icon={Users}
        />
        <StatCard
          title={t('analytics.avgTimeOnPage')}
          value={`${Math.round(safeSummary.avgTimeOnPage)}s`}
          icon={Clock}
        />
        <StatCard
          title={t('analytics.bounceRate')}
          value={`${safeSummary.bounceRate.toFixed(1)}`}
          suffix="%"
          icon={TrendingUp}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Content Performance Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />{t('analytics.contentPerformance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contentLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">{t('common.loading')}</div>
            ) : barChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">{t('analytics.noContentData')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chart.grid} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: chart.textMuted }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: chart.textMuted }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={chart.tooltipStyle}
                    labelStyle={chart.tooltipLabelStyle}
                    itemStyle={chart.tooltipItemStyle}
                    cursor={{ fill: chart.mutedBg, opacity: 0.5 }}
                  />
                  <Bar dataKey="views" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Content Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />{t('analytics.contentStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">{t('analytics.noDataAvailable')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieChartData.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_PIE_COLORS[entry.status] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chart.tooltipStyle}
                    labelStyle={chart.tooltipLabelStyle}
                    itemStyle={chart.tooltipItemStyle}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Traffic Sources Placeholder + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Sources Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />{t('analytics.trafficSources')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
              <Activity className="h-8 w-8 opacity-30" />
              <p>{t('analytics.trafficSourcesDescription')}</p>
              <p className="text-xs">{t('analytics.trafficSourcesHint')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('analytics.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
            ) : !activityEvents || activityEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t('analytics.noRecentActivity')}</div>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {activityEvents.map((event, i) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'h-2 w-2 rounded-full mt-1.5 shrink-0',
                        i === 0 ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                      )} />
                      {i < activityEvents.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] border-transparent bg-muted font-medium shrink-0">
                          {event.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatRelativeTime(event.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5 truncate">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('analytics.byPrefix')}{event.user?.name ?? t('analytics.systemUser')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
