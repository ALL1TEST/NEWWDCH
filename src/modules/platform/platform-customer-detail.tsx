'use client';

// ============================================================
// PLATFORM CUSTOMER DETAIL — full profile for a single SaaS
// customer: account info, plan/subscription, sites, recent
// payments, and recent activity. Suspend / reactivate actions
// use the same server-side API the list page links to.
// ============================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, patchApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import {
  PlatformPageHeader,
  PlatformKpi,
  KpiGridSkeleton,
  ErrorState,
  EmptyState,
  PlanBadge,
  CustomerStatusBadge,
  SubStatusBadge,
  PaymentStatusBadge,
  formatCurrency,
  formatDate,
  formatBytes,
} from './shared';
import type { CustomerDetail } from '@/lib/platform/platform-data';
import { Globe, CreditCard, HardDrive, FileText, ArrowLeft } from 'lucide-react';

export function PlatformCustomerDetailModule() {
  const currentItemId = useNavigationStore((s) => s.currentItemId);
  const navigate = useNavigationStore((s) => s.navigate);
  const qc = useQueryClient();
  const [actionPending, setActionPending] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['platform-customer-detail', currentItemId],
    queryFn: async () => getApi<CustomerDetail>(`/api/platform/admin/customers/${currentItemId}`),
    enabled: !!currentItemId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const handleAction = async (action: 'suspend' | 'reactivate') => {
    if (!currentItemId) return;
    setActionPending(true);
    try {
      await patchApi(`/api/platform/admin/customers/${currentItemId}`, { action });
      await qc.invalidateQueries({ queryKey: ['platform-customer-detail', currentItemId] });
      await qc.invalidateQueries({ queryKey: ['platform-customers'] });
      toast.success(action === 'suspend' ? 'Customer suspended.' : 'Customer reactivated.');
    } catch {
      toast.error('Unable to update customer.');
    } finally {
      setActionPending(false);
    }
  };

  if (isLoading || !currentItemId) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="Customer" subtitle="Customer details." onBack={() => navigate('platform-customers')} />
        <KpiGridSkeleton count={4} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="Customer" subtitle="Customer details." onBack={() => navigate('platform-customers')} />
        <Card><CardContent className="p-6"><ErrorState message="Could not load customer details." onRetry={() => refetch()} /></CardContent></Card>
      </div>
    );
  }

  const isSuspended = data.status === 'SUSPENDED';

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title={data.name}
        subtitle={data.email}
        onBack={() => navigate('platform-customers')}
        actions={
          isSuspended ? (
            <Button size="sm" variant="outline" disabled={actionPending} onClick={() => handleAction('reactivate')}>
              Reactivate
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-600 border-rose-300 hover:border-rose-400" disabled={actionPending} onClick={() => handleAction('suspend')}>
              Suspend
            </Button>
          )
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PlatformKpi label="Sites" value={data.siteCount} sublabel="Active publications" icon={<Globe className="h-4 w-4" />} color="violet" />
        <PlatformKpi label="Plan" value={data.planId.charAt(0).toUpperCase() + data.planId.slice(1)} sublabel={`${data.billingInterval} billing`} icon={<CreditCard className="h-4 w-4" />} color="amber" />
        <PlatformKpi label="Storage Used" value={formatBytes(data.sites.reduce((a, s) => a + s.storageBytes, 0))} sublabel={`Limit: ${formatBytes(data.storageLimitBytes)}`} icon={<HardDrive className="h-4 w-4" />} color="sky" />
        <PlatformKpi label="Articles" value={data.sites.reduce((a, s) => a + s.articles, 0)} sublabel="Across all sites" icon={<FileText className="h-4 w-4" />} color="emerald" />
      </div>

      {/* Account info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium truncate ml-2">{data.email}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Company</span>
              <span className="text-foreground">{data.company ?? '—'}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Country</span>
              <span className="text-foreground">{data.country}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Account Status</span>
              <CustomerStatusBadge status={data.status} />
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span className="text-foreground">{formatDate(data.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <PlanBadge planId={data.planId} />
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <SubStatusBadge status={data.subscriptionStatus} />
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Billing Interval</span>
              <span className="text-foreground capitalize">{data.billingInterval}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Started</span>
              <span className="text-foreground">{formatDate(data.subscriptionStart)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Next Billing</span>
              <span className="text-foreground">{formatDate(data.nextBillingAt)}</span>
            </div>
            {data.trialEnd && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Trial Ends</span>
                  <span className="text-foreground">{formatDate(data.trialEnd)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sites */}
      <Card>
        <CardHeader><CardTitle className="text-base">Sites ({data.sites.length})</CardTitle></CardHeader>
        <CardContent className="p-4">
          {data.sites.length === 0 ? (
            <EmptyState message="No sites for this customer." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Site</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Domain</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground text-center">Articles</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground text-center">Media</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Storage</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.sites.map((s) => (
                    <tr key={s.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{s.domain ?? '—'}</td>
                      <td className="py-2.5 pr-4"><CustomerStatusBadge status={s.status} /></td>
                      <td className="py-2.5 pr-4 text-center">{s.articles}</td>
                      <td className="py-2.5 pr-4 text-center">{s.media}</td>
                      <td className="py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">{formatBytes(s.storageBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent payments */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Payments ({data.payments.length})</CardTitle></CardHeader>
        <CardContent className="p-4">
          {data.payments.length === 0 ? (
            <EmptyState message="No payments recorded." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Date</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Invoice</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Plan</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Method</th>
                    <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.payments.slice(0, 10).map((p) => (
                    <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(p.date)}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{p.invoiceNumber}</td>
                      <td className="py-2.5 pr-4"><PlanBadge planId={p.planId} /></td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{p.method}</td>
                      <td className="py-2.5 pr-4"><PaymentStatusBadge status={p.status} /></td>
                      <td className="py-2.5 text-right font-medium whitespace-nowrap">{formatCurrency(p.amount, p.currency)}</td>
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
