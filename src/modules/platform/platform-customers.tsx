'use client';

// ============================================================
// PLATFORM CUSTOMERS — list every SaaS customer on the platform
// with search + plan/status filters. Clicking a row opens the
// customer detail view.
// ============================================================

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import {
  PlatformPageHeader,
  SearchInput,
  FilterSelect,
  TableSkeleton,
  ErrorState,
  EmptyState,
  usePlatformApi,
  PlanBadge,
  CustomerStatusBadge,
  SubStatusBadge,
  formatDate,
} from './shared';
import type { Customer, PlanId, SubscriptionStatus } from '@/lib/platform/platform-data';
import { Eye } from 'lucide-react';

type CustomerRow = Customer & { siteCount: number };

export function PlatformCustomersModule() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [planId, setPlanId] = useState<PlanId | 'all'>('all');
  const [status, setStatus] = useState<SubscriptionStatus | 'all'>('all');
  const navigate = useNavigationStore((s) => s.navigate);

  // Debounce the search input so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (planId !== 'all') params.set('planId', planId);
  if (status !== 'all') params.set('status', status);
  const path = `/api/platform/admin/customers${params.toString() ? `?${params}` : ''}`;
  const { data, isLoading, isError, refetch } = usePlatformApi<CustomerRow[]>(
    path,
    ['platform-customers', debouncedSearch, planId, status],
  );

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Customers"
        subtitle="All SaaS customers on the platform."
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, company…"
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
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <TableSkeleton rows={10} cols={7} />
          ) : isError ? (
            <ErrorState
              message="Could not load customers. Please retry."
              onRetry={() => refetch()}
            />
          ) : !data || data.length === 0 ? (
            <EmptyState message="No customers found." />
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {data.length} customer{data.length === 1 ? '' : 's'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Customer</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Company</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Plan</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Sub. Status</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Account</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground text-center">Sites</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Country</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Created</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-accent/30 transition-colors"
                      >
                        <td className="py-2.5 pr-4">
                          <p className="font-medium truncate max-w-[180px]">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.email}</p>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground truncate max-w-[140px]">
                          {c.company ?? '—'}
                        </td>
                        <td className="py-2.5 pr-4"><PlanBadge planId={c.planId} /></td>
                        <td className="py-2.5 pr-4"><SubStatusBadge status={c.subscriptionStatus} /></td>
                        <td className="py-2.5 pr-4"><CustomerStatusBadge status={c.status} /></td>
                        <td className="py-2.5 pr-4 text-center font-medium">{c.siteCount}</td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">{c.country}</td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(c.createdAt)}
                        </td>
                        <td className="py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => navigate('platform-customer-detail', c.id)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>
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
