'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Globe,
  FileText,
  Eye,
  Sparkles,
  HeartPulse,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  ArrowRight,
  Clock,
  Shield,
  Zap,
  TrendingUp,
  Server,
  Activity,
  BarChart3,
  Search,
  MousePointer,
  Target,
  LayoutGrid,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useSiteStore } from '@/lib/stores/site-store';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import type { PostStatus } from '@/shared/types';

// -------------------- Types --------------------

interface AnalyticsData {
  totalContent: number;
  publishedContent: number;
  totalUsers: number;
  totalMedia: number;
  totalComments: number;
  totalPageViews: number;
  uniqueVisitors: number;
  bounceRate: number;
  avgTimeOnPage: number;
  contentByStatus: { status: string; count: number }[];
  totalSites: number;
  activeSites: number;
  healthScore: number;
  aiArticlesToday: number;
  aiWordsToday: number;
  pendingActions: {
    critical: number;
    warning: number;
    info: number;
  };
  siteBreakdown: SiteBreakdown[];
}

interface SiteBreakdown {
  id: string;
  name: string;
  slug: string;
  status: string;
  _count: { contentItems: number; media: number; comments: number };
}

interface RecentContentItem {
  id: string;
  title: string;
  status: PostStatus;
  author: { name: string; avatar?: string } | null;
  createdAt: string;
  viewCount: number;
}

// -------------------- Traffic mock data --------------------
const TRAFFIC_DATA = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (13 - i));
  return {
    date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    visitors: Math.floor(Math.random() * 400) + 150,
    sessions: Math.floor(Math.random() * 500) + 200,
    pageViews: Math.floor(Math.random() * 700) + 300,
  };
});

// -------------------- Pending Actions Mock --------------------
const MOCK_PENDING_ACTIONS = [
  { id: '1', type: 'CRITICAL' as const, site: 'Tech Blog', message: 'SSL certificate expiring in 3 days', time: '2h ago', action: 'Fix' },
  { id: '2', type: 'CRITICAL' as const, site: 'Finance Blog', message: 'Domain renewal required', time: '5h ago', action: 'Renew' },
  { id: '3', type: 'WARNING' as const, site: 'Travel Blog', message: '4 articles waiting for review', time: '1h ago', action: 'Review' },
  { id: '4', type: 'WARNING' as const, site: 'Marketing', message: '12 new comments need moderation', time: '30m ago', action: 'Moderate' },
  { id: '5', type: 'WARNING' as const, site: 'Tech Blog', message: 'SEO issues detected on 3 pages', time: '4h ago', action: 'Open' },
  { id: '6', type: 'INFO' as const, site: 'Food Blog', message: 'AI draft generated: "Best Pasta Recipes"', time: '15m ago', action: 'Open' },
  { id: '7', type: 'INFO' as const, site: 'Marketing', message: 'Backup completed successfully', time: '1h ago', action: 'View' },
  { id: '8', type: 'INFO' as const, site: 'Travel Blog', message: 'Sitemap submitted to Google', time: '3h ago', action: '' },
];

// -------------------- Status Chart Colors --------------------
const STATUS_CHART_COLORS: Record<string, string> = {
  DRAFT: '#a1a1aa',
  PUBLISHED: '#22c55e',
  IN_REVIEW: '#f59e0b',
  APPROVED: '#10b981',
  UNPUBLISHED: '#f97316',
  ARCHIVED: '#71717a',
};

const SITE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

// -------------------- KPI Card --------------------
function KpiCard({
  label,
  value,
 sublabel,
 icon,
  trend,
  color = 'default',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'emerald' | 'amber' | 'violet' | 'rose' | 'default';
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
    default: 'bg-muted text-muted-foreground',
  };

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sublabel && (
              <p className="text-xs text-muted-foreground">{sublabel}</p>
            )}
          </div>
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', colorMap[color])}>
            {icon}
          </div>
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
            {trend === 'down' && <AlertTriangle className="h-3 w-3 text-rose-500" />}
            <span className={cn('text-xs font-medium', trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-muted-foreground')}>
              {trend === 'up' ? 'Trending up' : trend === 'down' ? 'Needs attention' : 'Stable'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Site Grid (All Sites mode) --------------------
function SiteGrid({ sites, onSiteClick }: { sites: SiteBreakdown[]; onSiteClick: (site: SiteBreakdown) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {sites.map((site, i) => (
        <Card
          key={site.id}
          className="group hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onSiteClick(site)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: SITE_COLORS[i % SITE_COLORS.length] }}
              >
                {site.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{site.name}</p>
                <p className="text-xs text-muted-foreground truncate">{site.slug}</p>
              </div>
              <Wifi className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-semibold">{site._count.contentItems}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Articles</p>
              </div>
              <div>
                <p className="text-sm font-semibold">{site._count.media}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Media</p>
              </div>
              <div>
                <p className="text-sm font-semibold">{site._count.comments}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Comments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -------------------- Pending Action Item --------------------
function PendingActionItem({ action }: { action: typeof MOCK_PENDING_ACTIONS[number] }) {
  const typeStyles = {
    CRITICAL: {
      bg: 'bg-red-50 dark:bg-red-950/30',
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      badge: <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Critical</Badge>,
    },
    WARNING: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[10px] px-1.5 py-0 border-0">Warning</Badge>,
    },
    INFO: {
      bg: '',
      icon: <Info className="h-4 w-4 text-sky-500" />,
      badge: <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Info</Badge>,
    },
  };

  const style = typeStyles[action.type];

  return (
    <div className={cn('flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-accent/50 transition-colors', style.bg)}>
      <div className="shrink-0">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{action.site}</span>
          {style.badge}
        </div>
        <p className="text-sm truncate mt-0.5">{action.message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:block">{action.time}</span>
        {action.action && (
          <button className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
            {action.action} <ArrowRight className="inline h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// -------------------- Skeletons --------------------
function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-20 mt-2" /></CardContent></Card>
      ))}
    </div>
  );
}

// -------------------- Component --------------------
export function DashboardPage() {
  const isAllSites = useSiteStore((s) => s.isAllSites());
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const setActiveSite = useSiteStore((s) => s.setActiveSite);

  // Fetch analytics summary
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => getApi<AnalyticsData>('/api/analytics'),
    staleTime: 30_000,
  });

  // Fetch recent content
  const { data: recentContentItems, isLoading: contentLoading } = useQuery({
    queryKey: queryKeys.content.list({ pageSize: 8 }),
    queryFn: () => getApi<RecentContentItem[]>('/api/content', { pageSize: 8, sort: 'createdAt', order: 'desc' }),
    staleTime: 30_000,
  });

  const isLoading = analyticsLoading;

  // Chart data
  const statusChartData = React.useMemo(() => {
    if (!analytics?.contentByStatus) return [];
    return analytics.contentByStatus.map((s) => ({
      label: s.status.replace(/_/g, ' '),
      value: s.count,
      status: s.status,
    }));
  }, [analytics]);

  // Title
  const pageTitle = isAllSites ? 'Executive Dashboard' : activeSite ? `${activeSite.name} Dashboard` : 'Dashboard';

  // Handle clicking a site card in All Sites mode → switch to that site
  const handleSiteClick = (site: SiteBreakdown) => {
    setActiveSite(site.id);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAllSites
            ? 'Monitor all sites, manage operations, and track performance across your network.'
            : `Managing content, media, and analytics for ${activeSite?.name ?? 'this site'}.`}
        </p>
      </div>

      {/* Section 1: Executive KPIs */}
      {isLoading ? (
        <KpiGridSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isAllSites && (
            <>
              <KpiCard
                label="Network Health"
                value={`${analytics?.activeSites ?? 0} / ${analytics?.totalSites ?? 0}`}
                sublabel="Sites Online"
                icon={<Server className="h-4 w-4" />}
                trend="up"
                color="emerald"
              />
              <KpiCard
                label="Total Visitors"
                value={(analytics?.uniqueVisitors ?? 0).toLocaleString()}
                sublabel="Last 7 days"
                icon={<Eye className="h-4 w-4" />}
                trend="up"
                color="violet"
              />
            </>
          )}
          <KpiCard
            label="Total Content"
            value={analytics?.totalContent ?? 0}
            sublabel={`${analytics?.publishedContent ?? 0} published`}
            icon={<FileText className="h-4 w-4" />}
            color="default"
          />
          <KpiCard
            label="AI Production"
            value={`${analytics?.aiArticlesToday ?? 0}`}
            sublabel={`${(analytics?.aiWordsToday ?? 0).toLocaleString()} words today`}
            icon={<Sparkles className="h-4 w-4" />}
            color="amber"
          />
          {isAllSites && (
            <KpiCard
              label="Health Score"
              value={`${analytics?.healthScore ?? 97}%`}
              sublabel="SEO + Performance + Uptime"
              icon={<HeartPulse className="h-4 w-4" />}
              trend="up"
              color="emerald"
            />
          )}
          <KpiCard
            label={isAllSites ? 'Media Files' : 'Media Library'}
            value={analytics?.totalMedia ?? 0}
            sublabel="Across all types"
            icon={<LayoutGrid className="h-4 w-4" />}
            color="default"
          />
          <KpiCard
            label="Comments"
            value={analytics?.totalComments ?? 0}
            sublabel="Awaiting moderation"
            icon={<Activity className="h-4 w-4" />}
            color="default"
          />
        </div>
      )}

      {/* Section 2: Site Grid (All Sites only) */}
      {isAllSites && !isLoading && analytics?.siteBreakdown && analytics.siteBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Site Network</CardTitle>
                <CardDescription className="text-xs mt-0.5">Overview of all websites in your network</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                <Wifi className="h-3 w-3 mr-1" />
                {analytics.activeSites} Online
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SiteGrid sites={analytics.siteBreakdown} onSiteClick={handleSiteClick} />
          </CardContent>
        </Card>
      )}

      {/* Section 3: Pending Actions + Traffic */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pending Action Center */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Pending Actions</CardTitle>
                <CardDescription className="text-xs mt-0.5">Items requiring your attention</CardDescription>
              </div>
              <div className="flex gap-1.5">
                {(analytics?.pendingActions.critical ?? 0) > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {analytics.pendingActions.critical} Critical
                  </Badge>
                )}
                {(analytics?.pendingActions.warning ?? 0) > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[10px] px-1.5 py-0 border-0">
                    {analytics.pendingActions.warning} Warning
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {MOCK_PENDING_ACTIONS.map((action) => (
                <PendingActionItem key={action.id} action={action} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Traffic Overview */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Traffic Overview</CardTitle>
                <CardDescription className="text-xs mt-0.5">Visitors, sessions, and page views</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Visitors</span>
                <span className="flex items-center gap-1"><MousePointer className="h-3 w-3" /> Sessions</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={TRAFFIC_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickLine={false} axisLine={false} allowDecimals={false} />
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
                />
                <Area type="monotone" dataKey="visitors" stroke="#8b5cf6" strokeWidth={2} fill="url(#fillVisitors)" />
                <Area type="monotone" dataKey="sessions" stroke="#10b981" strokeWidth={2} fill="url(#fillSessions)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Cross-Site Content Activity + Content Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Recent Content (wider) */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Content{isAllSites ? '' : ''}</CardTitle>
                <CardDescription className="text-xs mt-0.5">Latest articles across {isAllSites ? 'all sites' : 'this site'}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {contentLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : recentContentItems && recentContentItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-xs text-muted-foreground">Title</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground">Status</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground hidden sm:table-cell">Author</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentContentItems.slice(0, 8).map((item) => (
                      <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium truncate max-w-[250px]">{truncate(item.title, 40)}</p>
                        </td>
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={item.status} size="sm" />
                        </td>
                        <td className="py-2.5 pr-4 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{item.author?.name ?? '—'}</span>
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No content yet. Create your first article.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Pipeline Chart */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Content Pipeline</CardTitle>
            <CardDescription className="text-xs mt-0.5">Articles by status</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={statusChartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
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
                    cursor={{ fill: 'var(--muted)', radius: 4 }}
                  />
                  <Bar dataKey="value" name="Articles" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {statusChartData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_CHART_COLORS[entry.status] ?? '#a1a1aa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No content data yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 5: SEO Overview (single site) or System Health (all sites) */}
      {isAllSites ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-semibold">SEO Health</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Indexed Pages</span><span className="text-sm font-medium">94%</span></div>
                <Progress value={94} className="h-1.5" />
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Core Web Vitals</span><span className="text-sm font-medium">91%</span></div>
                <Progress value={91} className="h-1.5" />
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Mobile Friendly</span><span className="text-sm font-medium">98%</span></div>
                <Progress value={98} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-semibold">Performance</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Avg Load Time</span><span className="text-sm font-medium">1.2s</span></div>
                <Progress value={85} className="h-1.5" />
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Uptime (30d)</span><span className="text-sm font-medium">99.9%</span></div>
                <Progress value={99} className="h-1.5" />
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Error Rate</span><span className="text-sm font-medium">0.1%</span></div>
                <Progress value={99} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-violet-500" />
                <p className="text-sm font-semibold">AI Operations</p>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Articles Generated Today</span>
                  <span className="text-sm font-semibold text-amber-600">{analytics?.aiArticlesToday ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Words Generated Today</span>
                  <span className="text-sm font-semibold">{(analytics?.aiWordsToday ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Active Jobs</span>
                  <span className="text-sm font-medium">2</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Queue Size</span>
                  <span className="text-sm font-medium">0</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-semibold">SEO Overview</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Indexed Pages</span><span className="text-sm font-medium">94%</span></div>
                <Progress value={94} className="h-1.5" />
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Average Position</span><span className="text-sm font-medium">12.4</span></div>
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Impressions (7d)</span><span className="text-sm font-medium">2,847</span></div>
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Clicks (7d)</span><span className="text-sm font-medium">412</span></div>
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">CTR</span><span className="text-sm font-medium">14.5%</span></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-semibold">Site Performance</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Page Load</span><span className="text-sm font-medium">1.1s</span></div>
                <Progress value={88} className="h-1.5" />
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Core Web Vitals</span><span className="text-sm font-medium">Pass</span></div>
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Mobile Score</span><span className="text-sm font-medium">96/100</span></div>
                <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Uptime</span><span className="text-sm font-medium">99.9%</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
