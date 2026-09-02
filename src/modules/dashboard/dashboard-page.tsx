'use client';

import React from 'react';
import {
  Globe,
  FileText,
  Eye,
  Sparkles,
  HeartPulse,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  Server,
  BarChart3,
  MousePointer,
  LayoutGrid,
  Wifi,
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
import { StatusBadge } from '@/components/patterns';
import { useSiteStore } from '@/lib/stores/site-store';
import { useT } from '@/lib/i18n';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import {
  getDashboardData,
  type DashboardScope,
  type SiteBreakdown,
} from './mock-dashboard-data';

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
  const { t } = useT();

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
            {trend === 'up' && <span className="text-xs font-medium text-emerald-500">{t('dashboard.trendingUp')}</span>}
            {trend === 'down' && <span className="text-xs font-medium text-rose-500">{t('dashboard.needsAttention')}</span>}
            {trend === 'neutral' && <span className="text-xs font-medium text-muted-foreground">{t('dashboard.stable')}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Site Grid (All Sites mode) --------------------
function SiteGrid({ sites, onSiteClick }: { sites: SiteBreakdown[]; onSiteClick: (site: SiteBreakdown) => void }) {
  const { t } = useT();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
              {site.status === 'ACTIVE' ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-semibold">{site._count.contentItems}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{t('title.articles')}</p>
              </div>
              <div>
                <p className="text-sm font-semibold">{site._count.media}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{t('title.media')}</p>
              </div>
              <div>
                <p className="text-sm font-semibold">{site._count.comments}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{t('title.comments')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -------------------- Pending Action Item --------------------
function PendingActionItem({
  action,
}: {
  action: ReturnType<typeof getDashboardData>['pendingActions'][number];
}) {
  const { t } = useT();

  const typeStyles = {
    CRITICAL: {
      bg: 'bg-red-50 dark:bg-red-950/30',
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      badge: <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{t('dashboard.critical')}</Badge>,
    },
    WARNING: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[10px] px-1.5 py-0 border-0">{t('dashboard.warning')}</Badge>,
    },
    INFO: {
      bg: '',
      icon: <Info className="h-4 w-4 text-sky-500" />,
      badge: <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t('dashboard.info')}</Badge>,
    },
  };

  const style = typeStyles[action.type];

  return (
    <div className={cn('flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-accent/50 transition-colors', style.bg)}>
      <div className="shrink-0">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground truncate">{action.siteName || t('dashboard.network')}</span>
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
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-20 mt-2" /></CardContent></Card>
      ))}
    </div>
  );
}

// -------------------- Component --------------------

/**
 * The complete CMS dashboard widget suite (everything below the page
 * header): executive KPIs, the Site Network grid, the Pending Action
 * center, the Traffic Overview chart, Recent Content and the Content
 * Pipeline chart. Shared by the Admin User Executive Dashboard AND the
 * Internal Account dashboard (which renders the same full widget
 * content under its own Internal Account identity header).
 */
export function DashboardWidgets() {
  const { t } = useT();

  const isAllSites = useSiteStore((s) => s.isAllSites());
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const setActiveSite = useSiteStore((s) => s.setActiveSite);
  const sites = useSiteStore((s) => s.sites);
  const isInitialized = useSiteStore((s) => s.isInitialized);

  // Single source of truth: derive ALL dashboard data from the mock service.
  const scope: DashboardScope = isAllSites
    ? 'all'
    : activeSite
      ? { type: 'site', siteId: activeSite.id }
      : 'all';

  const data = React.useMemo(
    () => getDashboardData(sites, scope),
    [sites, scope],
  );

  // Show skeletons only while sites are still loading for the first time.
  const isLoading = !isInitialized && sites.length === 0;

  // Chart data derived from the single source.
  const statusChartData = React.useMemo(
    () =>
      data.contentByStatus.map((s) => ({
        label: s.status.replace(/_/g, ' '),
        value: s.count,
        status: s.status,
      })),
    [data.contentByStatus],
  );

  // Recent content — the most recent articles from the SAME mock dataset.
  const recentContentItems = React.useMemo(
    () =>
      [...data.content]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [data.content],
  );

  // Handle clicking a site card in All Sites mode → switch to that site
  const handleSiteClick = (site: SiteBreakdown) => {
    setActiveSite(site.id);
  };

  return (
    <div className="space-y-6">
      {/* Widget sections (KPIs, Site Network, Pending Actions,
          Traffic, Recent Content, Content Pipeline) */}
      {/* Section 1: Executive KPIs */}
      {isLoading ? (
        <KpiGridSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {isAllSites && (
            <KpiCard
              label={t('dashboard.networkHealth')}
              value={`${data.activeSites} / ${data.totalSites}`}
              sublabel={t('dashboard.sitesOnline')}
              icon={<Server className="h-4 w-4" />}
              trend="up"
              color="emerald"
            />
          )}
          <KpiCard
            label={t('dashboard.totalVisitors')}
            value={data.uniqueVisitors7d.toLocaleString()}
            sublabel={t('dashboard.last7Days')}
            icon={<Eye className="h-4 w-4" />}
            trend="up"
            color="violet"
          />
          <KpiCard
            label={t('dashboard.totalContent')}
            value={data.totalContent}
            sublabel={`${data.publishedContent} ${t('dashboard.publishedSuffix')}`}
            icon={<FileText className="h-4 w-4" />}
            color="default"
          />
          <KpiCard
            label={t('dashboard.aiProduction')}
            value={`${data.aiArticlesToday}`}
            sublabel={`${data.aiWordsToday.toLocaleString()} ${t('dashboard.wordsTodaySuffix')}`}
            icon={<Sparkles className="h-4 w-4" />}
            color="amber"
          />
          <KpiCard
            label={t('dashboard.healthScore')}
            value={`${data.healthScore}%`}
            sublabel={t('dashboard.healthScoreSub')}
            icon={<HeartPulse className="h-4 w-4" />}
            trend="up"
            color="emerald"
          />
        </div>
      )}

      {/* Section 2: Site Grid (All Sites only) */}
      {isAllSites && !isLoading && data.siteBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('dashboard.siteNetwork')}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t('dashboard.siteNetworkDescription')}</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                <Wifi className="h-3 w-3 mr-1" />
                {data.activeSites} {t('dashboard.onlineSuffix')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SiteGrid sites={data.siteBreakdown} onSiteClick={handleSiteClick} />
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
                <CardTitle className="text-base">{t('dashboard.pendingActions')}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t('dashboard.pendingActionsDescription')}</CardDescription>
              </div>
              <div className="flex gap-1.5">
                {data.pendingActionsSummary.critical > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {data.pendingActionsSummary.critical} {t('dashboard.criticalCount')}
                  </Badge>
                )}
                {data.pendingActionsSummary.warning > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[10px] px-1.5 py-0 border-0">
                    {data.pendingActionsSummary.warning} {t('dashboard.warningCount')}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.pendingActions.length > 0 ? (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {data.pendingActions.map((action) => (
                  <PendingActionItem key={action.id} action={action} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('dashboard.noPendingActions')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Traffic Overview */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('dashboard.trafficOverview')}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t('dashboard.trafficDescription')}</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {t('dashboard.visitors')}</span>
                <span className="flex items-center gap-1"><MousePointer className="h-3 w-3" /> {t('dashboard.sessions')}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.traffic.length > 0 ? (
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={data.traffic} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('dashboard.noTrafficData')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Recent Content + Content Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Recent Content (wider) */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('dashboard.recentContent')}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{`${t('dashboard.latestArticlesPrefix')} ${isAllSites ? t('dashboard.allSites') : t('dashboard.thisSite')}`}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentContentItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-xs text-muted-foreground">{t('dashboard.title')}</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground">{t('common.status')}</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground hidden sm:table-cell">{t('dashboard.author')}</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground text-right">{t('dashboard.date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentContentItems.map((item) => (
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
                <p className="text-sm">{t('dashboard.noContentYet')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Pipeline Chart */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.contentPipeline')}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {`${t('dashboard.articlesByStatus')} (${statusChartData.reduce((acc, s) => acc + s.value, 0)} ${t('dashboard.totalSuffix')})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length > 0 ? (
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
                  <Bar dataKey="value" name={t('title.articles')} radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {statusChartData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_CHART_COLORS[entry.status] ?? '#a1a1aa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('dashboard.noContentData')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// -------------------- Page wrapper --------------------

/**
 * The Admin User (client CMS) Executive Dashboard page: the site-scope
 * aware page header (Executive Dashboard / "<Site> Dashboard") above
 * the shared full widget suite.
 */
export function DashboardPage() {
  const { t } = useT();

  const isAllSites = useSiteStore((s) => s.isAllSites());
  const activeSite = useSiteStore((s) => s.getActiveSite());

  // Title
  const pageTitle = isAllSites
    ? t('title.executiveDashboard')
    : activeSite
      ? `${activeSite.name} ${t('dashboard.dashboardSuffix')}`
      : t('title.dashboard');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAllSites
            ? t('dashboard.descriptionAll')
            : `${t('dashboard.managingForPrefix')} ${activeSite?.name ?? t('dashboard.thisSite')}.`}
        </p>
      </div>

      <DashboardWidgets />
    </div>
  );
}
