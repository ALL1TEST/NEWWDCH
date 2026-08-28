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
import {
  Users, CreditCard, DollarSign, Globe, TrendingUp, Server,
  HeartPulse, AlertCircle, AlertTriangle, Info, ArrowRight, FileText,
  Sparkles, HardDrive, Activity, Cpu, Loader2,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  PlatformPageHeader, PlatformKpi, KpiGridSkeleton, ErrorState,
  PlanBadge, SubStatusBadge, PaymentStatusBadge, HealthBadge,
  usePlatformApi, formatCurrency, formatDate, formatBytes,
} from './shared';
import type { PlatformOverview } from '@/lib/platform/platform-data';

export function PlatformOverviewModule() {
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
  // Recent Customers, Recent Payments, Platform Usage, Admin Alerts,
  // System Health). Shows a loading state, prevents duplicate refreshes
  // while one is in flight, restores the normal button state afterwards
  // and surfaces errors via toast — without reloading the browser page.
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await refetch();
      if (result.isError) {
        toast.error('Could not refresh overview. Please try again.');
      } else {
        toast.success('Overview data refreshed.');
      }
    } catch {
      toast.error('Could not refresh overview. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="Platform Overview" subtitle="Monitor customers, subscriptions, revenue, usage, and platform health." />
        <KpiGridSkeleton count={4} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="Platform Overview" subtitle="Monitor customers, subscriptions, revenue, usage, and platform health." />
        <Card><CardContent className="p-6"><ErrorState message="Could not load platform overview. Please retry." onRetry={() => refetch()} /></CardContent></Card>
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
        title="Platform Overview"
        subtitle="Monitor customers, subscriptions, revenue, usage, and platform health."
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <Activity className="h-4 w-4 mr-1.5" />}
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PlatformKpi
          label="Total Customers"
          value={data.totalCustomers}
          sublabel="Active accounts"
          icon={<Users className="h-4 w-4" />}
          color="violet"
        />
        <PlatformKpi
          label="Active Subscriptions"
          value={data.activeSubscriptions}
          sublabel={`${activePct}% of customers`}
          icon={<CreditCard className="h-4 w-4" />}
          color="emerald"
          trend="up"
        />
        <PlatformKpi
          label="Monthly Recurring Revenue"
          value={formatCurrency(data.mrr, data.currency)}
          sublabel="From active paid subscriptions"
          icon={<DollarSign className="h-4 w-4" />}
          color="amber"
          trend={revenueTrendUp ? 'up' : 'down'}
        />
        <PlatformKpi
          label="Total Sites"
          value={data.totalSites}
          sublabel="Across all customers"
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
                <CardTitle className="text-base">Revenue Overview</CardTitle>
                <CardDescription className="text-xs mt-0.5">Monthly recurring revenue trend (last 8 months)</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                {formatCurrency(lastRevenue, data.currency)} this month
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
            <CardTitle className="text-base">Subscription Overview</CardTitle>
            <CardDescription className="text-xs mt-0.5">Plan distribution + status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Plan distribution */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">By Plan</p>
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
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">By Status</p>
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
                <CardTitle className="text-base">Recent Customers</CardTitle>
                <CardDescription className="text-xs mt-0.5">Latest sign-ups</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('platform-customers')}>
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-xs text-muted-foreground">Customer</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">Plan</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Sites</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Joined</th>
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
                <CardTitle className="text-base">Recent Payments</CardTitle>
                <CardDescription className="text-xs mt-0.5">Latest transactions</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('platform-payments')}>
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-xs text-muted-foreground">Customer</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">Plan</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Amount</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Date</th>
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

      {/* Platform Usage + Admin Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Platform Usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Platform Usage</CardTitle>
            <CardDescription className="text-xs mt-0.5">Aggregated across all customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <UsageTile icon={<Globe className="h-4 w-4" />} label="Total Sites" value={data.usage.totalSites} color="text-sky-600" />
              <UsageTile icon={<FileText className="h-4 w-4" />} label="Articles" value={data.usage.totalArticles.toLocaleString()} color="text-violet-600" />
              <UsageTile icon={<Sparkles className="h-4 w-4" />} label="AI Articles" value={data.usage.aiArticlesGenerated.toLocaleString()} color="text-amber-600" />
              <UsageTile icon={<Cpu className="h-4 w-4" />} label="AI Words" value={data.usage.aiWordsGenerated.toLocaleString()} color="text-emerald-600" />
              <UsageTile icon={<HardDrive className="h-4 w-4" />} label="Storage" value={formatBytes(data.usage.mediaStorageBytes)} color="text-rose-600" />
              <UsageTile icon={<Server className="h-4 w-4" />} label="Automation Runs" value={data.usage.automationRuns.toLocaleString()} color="text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Admin Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Admin Alerts</CardTitle>
                <CardDescription className="text-xs mt-0.5">Platform-level items needing attention</CardDescription>
              </div>
              {data.alerts.length > 0 && (
                <Badge variant="outline" className="text-xs">{data.alerts.length} active</Badge>
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
                <p className="text-sm">All clear — no platform alerts.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader className="pb-3">
          <div>
            <CardTitle className="text-base">System Health</CardTitle>
            <CardDescription className="text-xs mt-0.5">Platform infrastructure status</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.systemHealth.map((h) => (
              <div key={h.key} className="rounded-lg border border-border p-3 text-center">
                <HealthBadge status={h.status} />
                <p className="text-xs font-medium mt-2">{h.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{h.latencyMs}ms</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Sub-components --------------------

function UsageTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold tracking-tight mt-1">{value}</p>
    </div>
  );
}

function AlertRow({ alert, onNavigate }: { alert: PlatformOverview['alerts'][number]; onNavigate: (mod: string, id?: string | null) => void }) {
  const map = {
    critical: { icon: <AlertCircle className="h-4 w-4 text-rose-500" />, cls: 'bg-rose-50 dark:bg-rose-950/30', badge: <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Critical</Badge> },
    warning: { icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, cls: 'bg-amber-50 dark:bg-amber-950/30', badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[10px] px-1.5 py-0 border-0">Warning</Badge> },
    info: { icon: <Info className="h-4 w-4 text-sky-500" />, cls: '', badge: <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Info</Badge> },
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
