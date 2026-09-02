'use client';

// ============================================================
// PLATFORM OVERVIEW — the executive admin dashboard.
// All numbers derive from /api/platform/admin/overview which reads
// the single centralized platform dataset. Nothing here hardcodes
// metrics independently.
// ============================================================

import React, { useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useT } from '@/lib/i18n';
import {
  Users, CreditCard, DollarSign, Globe, TrendingUp,
  HeartPulse, AlertCircle, AlertTriangle, Info, ArrowRight,
  Activity, Loader2,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  PlatformPageHeader, PlatformKpi, KpiGridSkeleton, ErrorState,
  PlanBadge, SubStatusBadge, PaymentStatusBadge,
  usePlatformApi, formatCurrency, formatDate,
} from './shared';
import type { PlatformOverview } from '@/lib/platform/platform-data';

export function PlatformOverviewModule() {
  const { t } = useT();
  const { data, isLoading, isError, refetch } = usePlatformApi<PlatformOverview>(
    '/api/platform/admin/overview',
    ['platform-overview'],
  );
  const navigate = useNavigationStore((s) => s.navigate);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh handler: re-fetches the Overview dataset from
  // /api/platform/admin/overview. Because every metric, chart, list and
  // alert on this page derives from the single `data` object, one refetch
  // refreshes everything (KPIs, Revenue Overview, Subscription Overview,
  // Recent Customers, Recent Payments, Admin Alerts). Shows a loading
  // state, prevents duplicate refreshes while one is in flight, restores
  // the normal button state afterwards and surfaces errors via toast —
  // without reloading the browser page.
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await refetch();
      if (result.isError) {
        toast.error(t('platformOverview.refreshError'));
      } else {
        toast.success(t('platformOverview.refreshed'));
      }
    } catch {
      toast.error(t('platformOverview.refreshError'));
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title={t('title.platformOverview')} subtitle={t('platformOverview.subtitle')} />
        <KpiGridSkeleton count={4} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title={t('title.platformOverview')} subtitle={t('platformOverview.subtitle')} />
        <Card><CardContent className="p-6"><ErrorState message={t('platformOverview.loadError')} onRetry={() => refetch()} /></CardContent></Card>
      </div>
    );
  }

  const activePct = data.totalCustomers > 0 ? Math.round((data.activeSubscriptions / data.totalCustomers) * 100) : 0;
  const lastRevenue = data.revenueSeries[data.revenueSeries.length - 1]?.revenue ?? 0;
  const prevRevenue = data.revenueSeries[data.revenueSeries.length - 2]?.revenue ?? 0;
  const revenueTrendUp = lastRevenue >= prevRevenue;

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title={t('title.platformOverview')}
        subtitle={t('platformOverview.subtitle')}
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <Activity className="h-4 w-4 mr-1.5" />}
            {isRefreshing ? t('platformOverview.refreshing') : t('common.refresh')}
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PlatformKpi
          label={t('platformOverview.totalCustomers')}
          value={data.totalCustomers}
          sublabel={t('platformOverview.activeAccounts')}
          icon={<Users className="h-4 w-4" />}
          color="violet"
        />
        <PlatformKpi
          label={t('platformOverview.activeSubscriptions')}
          value={data.activeSubscriptions}
          sublabel={`${activePct}% ${t('platformOverview.ofCustomers')}`}
          icon={<CreditCard className="h-4 w-4" />}
          color="emerald"
          trend="up"
        />
        <PlatformKpi
          label={t('platformOverview.mrr')}
          value={formatCurrency(data.mrr, data.currency)}
          sublabel={t('platformOverview.fromActivePaidSubscriptions')}
          icon={<DollarSign className="h-4 w-4" />}
          color="amber"
          trend={revenueTrendUp ? 'up' : 'down'}
        />
        <PlatformKpi
          label={t('platformOverview.totalSites')}
          value={data.totalSites}
          sublabel={t('platformOverview.acrossAllCustomers')}
          icon={<Globe className="h-4 w-4" />}
          color="sky"
        />
      </div>

      {/* Revenue + Subscription overview */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Revenue Overview */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('platformOverview.revenueOverview')}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t('platformOverview.revenueTrend')}</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                {formatCurrency(lastRevenue, data.currency)} {t('platformOverview.thisMonth')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.revenueSeries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--muted-foreground)' }}
                  itemStyle={{ color: 'var(--popover-foreground)' }}
                  formatter={(v: number) => [`${data.currency} ${v.toLocaleString()}`, 'MRR']}
                />
                <Area type="monotone" dataKey="revenue" name="MRR" stroke="#10b981" strokeWidth={2} fill="url(#fillRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subscription Overview */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('platformOverview.subscriptionOverview')}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{t('platformOverview.planDistributionStatus')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Plan distribution */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t('platformOverview.byPlan')}</p>
              <div className="space-y-2">
                {data.planDistribution.map((p) => {
                  const pct = data.totalCustomers > 0 ? Math.round((p.count / data.totalCustomers) * 100) : 0;
                  return (
                    <div key={p.planId} className="flex items-center gap-3">
                      <div className="w-16 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <PlanBadge planId={p.planId} />
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                      </div>
                      <span className="text-xs font-medium w-8 text-right">{p.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Status counts */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t('platformOverview.byStatus')}</p>
              <div className="flex flex-wrap gap-2">
                {data.statusCounts.map((s) => (
                  <div key={s.status} className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted/60">
                    <SubStatusBadge status={s.status} />
                    <span className="text-xs font-semibold">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Customers + Recent Payments */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Customers */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('platformOverview.recentCustomers')}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t('platformOverview.latestSignups')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('platform-customers')}>
                {t('platformOverview.viewAll')} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-xs text-muted-foreground">{t('platformOverview.customer')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">{t('platformOverview.plan')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">{t('common.status')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">{t('platformOverview.sites')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">{t('platformOverview.joined')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.recentCustomers.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => navigate('platform-customer-detail', c.id)}
                    >
                      <td className="py-2.5 pr-4">
                        <p className="font-medium truncate max-w-[160px]">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{c.email}</p>
                      </td>
                      <td className="py-2.5 pr-4"><PlanBadge planId={c.planId} /></td>
                      <td className="py-2.5 pr-4"><SubStatusBadge status={c.subscriptionStatus} /></td>
                      <td className="py-2.5 pr-4 text-right font-medium">{c.siteCount}</td>
                      <td className="py-2.5 text-right text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t('platformOverview.recentPayments')}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t('platformOverview.latestTransactions')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('platform-payments')}>
                {t('platformOverview.viewAll')} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-xs text-muted-foreground">{t('platformOverview.customer')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">{t('platformOverview.plan')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">{t('platformOverview.amount')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">{t('common.status')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">{t('platformOverview.date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.recentPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium truncate max-w-[140px]">{p.customerName}</p>
                      </td>
                      <td className="py-2.5 pr-4"><PlanBadge planId={p.planId} /></td>
                      <td className="py-2.5 pr-4 text-right font-medium">{formatCurrency(p.amount, p.currency)}</td>
                      <td className="py-2.5 pr-4"><PaymentStatusBadge status={p.status} /></td>
                      <td className="py-2.5 text-right text-xs text-muted-foreground">{formatDate(p.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('platformOverview.adminAlerts')}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{t('platformOverview.alertsDescription')}</CardDescription>
            </div>
            {data.alerts.length > 0 && (
              <Badge variant="outline" className="text-xs">{data.alerts.length} {t('platformOverview.activeCount')}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data.alerts.length > 0 ? (
            <div className="space-y-2">
              {data.alerts.map((a) => <AlertRow key={a.id} alert={a} onNavigate={navigate} />)}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <HeartPulse className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('platformOverview.allClear')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Sub-components --------------------

function AlertRow({ alert, onNavigate }: { alert: PlatformOverview['alerts'][number]; onNavigate: (mod: string, id?: string | null) => void }) {
  const { t } = useT();
  const map = {
    critical: { icon: <AlertCircle className="h-4 w-4 text-rose-500" />, cls: 'bg-rose-50 dark:bg-rose-950/30', badge: <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{t('platformOverview.severityCritical')}</Badge> },
    warning: { icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, cls: 'bg-amber-50 dark:bg-amber-950/30', badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[10px] px-1.5 py-0 border-0">{t('platformOverview.severityWarning')}</Badge> },
    info: { icon: <Info className="h-4 w-4 text-sky-500" />, cls: '', badge: <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t('platformOverview.severityInfo')}</Badge> },
  };
  const s = map[alert.severity];
  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-accent/50 transition-colors ${s.cls}`}>
      <div className="shrink-0">{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{alert.title}</span>
          {s.badge}
        </div>
        <p className="text-sm truncate mt-0.5">{alert.message}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs shrink-0"
        onClick={() => onNavigate(alert.action.module)}
      >
        {alert.action.label} <ArrowRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}
