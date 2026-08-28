'use client';

// ============================================================
// PLATFORM SUBSCRIPTIONS — list every subscription on the
// platform with status + plan filters. Clicking a row opens
// the customer detail view.
// ============================================================

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import {
  PlatformPageHeader,
  FilterSelect,
  TableSkeleton,
  ErrorState,
  EmptyState,
  usePlatformApi,
  PlanBadge,
  SubStatusBadge,
  formatCurrency,
  formatDate,
} from './shared';
import type { Customer, PlanId, SubscriptionStatus } from '@/lib/platform/platform-data';

type SubscriptionRow = Customer & { planName: string; monthlyPrice: number };

export function PlatformSubscriptionsModule() {
  const [status, setStatus] = useState<SubscriptionStatus | 'all'>('all');
  const [planId, setPlanId] = useState<PlanId | 'all'>('all');
  const navigate = useNavigationStore((s) => s.navigate);

  const path = `/api/platform/admin/subscriptions?status=${status}&planId=${planId}`;
  const { data, isLoading, isError, refetch } = usePlatformApi<SubscriptionRow[]>(
    path,
    ['platform-subscriptions', status, planId],
  );

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Subscriptions"
        subtitle="All subscriptions across the platform."
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'trial', label: 'Trial' },
            { value: 'past_due', label: 'Past Due' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'expired', label: 'Expired' },
          ]}
        />
        <FilterSelect
          value={planId}
          onChange={setPlanId}
          options={[
            { value: 'beta', label: 'Beta' },
            { value: 'pro', label: 'Pro' },
            { value: 'max', label: 'Max' },
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : isError ? (
            <ErrorState
              message="Could not load subscriptions. Please retry."
              onRetry={() => refetch()}
            />
          ) : !data || data.length === 0 ? (
            <EmptyState message="No subscriptions found." />
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {data.length} subscription{data.length === 1 ? '' : 's'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Customer</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Plan</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Status</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Billing</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground text-right">Price</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Start</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground">Next Billing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.map((sub) => (
                      <tr
                        key={sub.id}
                        className="hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => navigate('platform-customer-detail', sub.id)}
                      >
                        <td className="py-2.5 pr-4">
                          <p className="font-medium truncate max-w-[180px]">{sub.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{sub.email}</p>
                        </td>
                        <td className="py-2.5 pr-4"><PlanBadge planId={sub.planId} /></td>
                        <td className="py-2.5 pr-4"><SubStatusBadge status={sub.subscriptionStatus} /></td>
                        <td className="py-2.5 pr-4 capitalize">{sub.billingInterval}</td>
                        <td className="py-2.5 pr-4 text-right font-medium whitespace-nowrap">
                          {formatCurrency(sub.monthlyPrice)} /mo
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(sub.subscriptionStart)}
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(sub.nextBillingAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
