'use client';

// ============================================================
// PLATFORM PAYMENTS — list every payment transaction across
// the platform. Search is debounced (300ms) and dispatched
// server-side; status filtering is server-side too. A small
// paid-summary (count + total) is derived from the returned
// array, never hardcoded.
//
// Scope: this page is FINANCIAL ONLY. Each row surfaces the
// transaction ID (Stripe PaymentIntent ID, with the Charge ID
// beneath), invoice reference (human invoice number + Stripe
// invoice ID), customer reference (name + email), plan, amount
// + currency, payment status (paid / pending / failed /
// refunded — refunds and failures are first-class statuses,
// not a separate UI), payment method metadata (derived from
// the stored card details, e.g. "Visa ••4242"), and date.
// Customer-management UI (sites, storage, account status,
// suspend/reactivate) lives on the Customers page + customer
// detail page — it is NOT duplicated here.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import {
  PlatformPageHeader,
  SearchInput,
  FilterSelect,
  TableSkeleton,
  ErrorState,
  EmptyState,
  usePlatformApi,
  PlanBadge,
  PaymentStatusBadge,
  formatCurrency,
  formatDate,
} from './shared';
import type { Payment, PaymentStatus } from '@/lib/platform/platform-data';

type PaymentRow = Payment & { customerName: string; customerEmail: string };

export function PlatformPaymentsModule() {
  const { t } = useT();
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const path = `/api/platform/admin/payments?status=${status}${
    debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''
  }`;
  const { data, isLoading, isError, refetch } = usePlatformApi<PaymentRow[]>(
    path,
    ['platform-payments', status, debouncedSearch],
  );

  const paidSummary = useMemo(() => {
    if (!data) return { count: 0, total: 0 };
    const paid = data.filter((p) => p.status === 'paid');
    return {
      count: paid.length,
      total: paid.reduce((a, p) => a + p.amount, 0),
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title={t('title.platformPayments')}
        subtitle={t('platformPayments.subtitle')}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('platformPayments.searchPlaceholder')}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          allLabel={t('platformPayments.allStatuses')}
          options={[
            { value: 'paid', label: t('platformPayments.statusPaid') },
            { value: 'pending', label: t('platformPayments.statusPending') },
            { value: 'failed', label: t('platformPayments.statusFailed') },
            { value: 'refunded', label: t('platformPayments.statusRefunded') },
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : isError ? (
            <ErrorState
              message={t('platformPayments.loadError')}
              onRetry={() => refetch()}
            />
          ) : !data || data.length === 0 ? (
            <EmptyState message={t('platformPayments.empty')} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-xs text-muted-foreground">
                  {data.length} {data.length === 1 ? t('platformPayments.paymentOne') : t('platformPayments.paymentMany')}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground">{paidSummary.count}</span> {t('platformPayments.paidCount')}
                  </span>
                  <span>
                    {t('platformPayments.paidTotal')}{' '}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(paidSummary.total)}
                    </span>
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">{t('platformPayments.transaction')}</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">{t('platformPayments.invoice')}</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">{t('platformPayments.customer')}</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">{t('platformPayments.plan')}</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground text-right">{t('platformPayments.amount')}</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">{t('common.status')}</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">{t('platformPayments.method')}</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground text-right">{t('platformPayments.date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.map((p) => (
                      <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {/* Stripe PaymentIntent ID is the real "transaction
                              ID"; fall back to the internal record id when
                              Stripe isn't configured. */}
                          {p.stripePaymentIntentId ? (
                            <span>{p.stripePaymentIntentId}</span>
                          ) : (
                            <span>{p.id}</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                          <span>{p.invoiceNumber}</span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <p className="font-medium truncate max-w-[140px]">{p.customerName}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {p.customerEmail}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4"><PlanBadge planId={p.planId} /></td>
                        <td className="py-2.5 pr-4 text-right font-medium whitespace-nowrap">
                          {formatCurrency(p.amount, p.currency)}
                        </td>
                        <td className="py-2.5 pr-4"><PaymentStatusBadge status={p.status} /></td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">{p.method}</td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(p.date)}
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
