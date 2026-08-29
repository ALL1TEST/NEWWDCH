'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  Check,
  Receipt,
  Clock,
  Loader2,
  AlertCircle,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import {
  PLANS as STORE_PLANS,
  getPlanBadgeClasses,
  getPlanCardBorderClasses,
  type Plan as StorePlan,
} from '@/lib/stores/subscription-store';
import type { ClientBillingState, Payment, PlanId } from '@/lib/platform/platform-data';
import { PaymentStatusBadge, formatCurrency, formatDate, ErrorState } from '@/modules/platform/shared';

// -------------------- Helpers --------------------

/** Resolve the matching client-side plan definition (for badgeVariant/badgeStyle)
 *  given a backend plan id. Falls back to the first plan so a future plan
 *  still renders with a sensible neutral badge. */
function getStorePlan(planId: string): StorePlan {
  return STORE_PLANS.find((p) => p.id === planId) ?? STORE_PLANS[0];
}

/** The backend plans use interval 'monthly'/'yearly'; the original billing
 *  page rendered '/month' etc. Strip the trailing 'ly' so the visual stays
 *  identical to the previous subscription-store output ('month'/'year'). */
function normalizeInterval(interval: string): string {
  return interval?.replace(/ly$/, '');
}

// -------------------- Component --------------------

export function BillingPage() {
  const { t } = useT();
  const queryClient = useQueryClient();

  const billingQuery = useQuery<ClientBillingState>({
    queryKey: ['platform-billing-me'],
    queryFn: () => getApi<ClientBillingState>('/api/platform/billing/me'),
  });

  // Change-plan mutation — only used for FREE plans now. Paid plans go
  // through the checkoutMutation (Stripe Checkout Session).
  const changePlanMutation = useMutation<
    ClientBillingState,
    Error,
    { planId: PlanId; planName: string; isUpgrade: boolean }
  >({
    mutationFn: ({ planId }) =>
      postApi<ClientBillingState>('/api/platform/billing/change-plan', { planId }),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['platform-billing-me'] });
      queryClient.invalidateQueries({ queryKey: ['platform-overview'] });
      toast.success(vars.isUpgrade ? `Upgraded to ${vars.planName}` : `Changed to ${vars.planName}`);
    },
    onError: (err: unknown) => {
      const e = err as { error?: { code?: string; message?: string }; message?: string };
      const code = e?.error?.code;
      if (code === 'CHECKOUT_REQUIRED') {
        toast.error('Paid plans require Stripe checkout. Please use the Upgrade button.');
      } else if (code === 'PLAN_NOT_AVAILABLE') {
        toast.error('This plan is no longer available. Please choose another plan.');
      } else {
        toast.error(e?.error?.message ?? e?.message ?? 'Unable to change plan. Please try again.');
      }
    },
  });

  // Checkout mutation — for PAID plans. Creates a Stripe Checkout Session
  // and redirects to Stripe. Returns 503 when Stripe is not configured and
  // 424 when the plan's Stripe Price ID is not wired.
  const checkoutMutation = useMutation<
    { url: string; sessionId: string },
    Error,
    { planId: PlanId; planName: string; interval: 'monthly' | 'yearly' }
  >({
    mutationFn: ({ planId, interval }) => {
      const res = fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, interval }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          const err = new Error(body?.error?.message ?? 'Checkout failed') as Error & {
            code?: string;
            status?: number;
          };
          err.code = body?.error?.code;
          err.status = r.status;
          throw err;
        }
        return r.json();
      });
      return res.then((j) => j.data as { url: string; sessionId: string });
    },
    onSuccess: (data) => {
      // Redirect to Stripe Checkout.
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; message?: string; status?: number };
      if (e?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
        toast.error(
          'Stripe is not configured on this platform. The admin must set STRIPE_SECRET_KEY in .env to enable real checkout. Free plans can still be selected directly.',
        );
      } else if (e?.code === 'STRIPE_PRICE_NOT_CONFIGURED') {
        toast.error(
          'This plan does not have a Stripe Price ID configured. An admin must wire it via Platform Admin → Edit Plan → Stripe Price ID.',
        );
      } else {
        toast.error(e?.message ?? 'Unable to start checkout. Please try again.');
      }
    },
  });

  const cancelMutation = useMutation<ClientBillingState, Error, void>({
    mutationFn: () => postApi<ClientBillingState>('/api/platform/billing/cancel'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-billing-me'] });
      queryClient.invalidateQueries({ queryKey: ['platform-overview'] });
      toast.success('Subscription cancelled');
    },
    onError: () => {
      toast.error('Unable to cancel subscription. Please try again.');
    },
  });

  // -------------------- Loading --------------------
  if (billingQuery.isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-8 w-40" />
            </div>
          </CardContent>
        </Card>
        <div>
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-8 w-24" />
                  <Separator />
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------- Error --------------------
  if (billingQuery.isError || !billingQuery.data) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t('billing.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('billing.description')}</p>
        </div>
        <Card>
          <CardContent>
            <ErrorState
              message="Unable to load billing data. Please check your connection and try again."
              onRetry={() => billingQuery.refetch()}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------- Loaded --------------------
  const billingState: ClientBillingState = billingQuery.data;

  // Owner / billing-bypass users (billingMode INTERNAL/EXEMPT) get a
  // dedicated panel instead of the plan cards — they have full platform
  // access and are not a paying customer.
  if (billingState.isInternal) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t('billing.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('billing.description')}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('billing.currentPlan')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold text-lg">Internal Account</span>
                  <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30">
                    {billingState.billingMode}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground ml-7">
                  Full platform access — billing bypass. Not counted as a paying customer.
                </p>
              </div>
              <Badge variant="default">active</Badge>
            </div>
            <Separator />
            <ul className="space-y-2">
              {billingState.plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPlan = billingState.plan;
  const otherPlans = billingState.allPlans.filter((p) => p.id !== currentPlan.id);
  const status = billingState.status;
  const trialEnd = billingState.trialEnd;
  const currentPeriodEnd = billingState.currentPeriodEnd ?? billingState.nextBillingAt;
  const freeTrialExpiresAt = billingState.freeTrialExpiresAt;
  const freeTrialExpired = billingState.freeTrialExpired;
  const isCancelled = status === 'cancelled';
  // Use the subscription's billing interval when present, otherwise the plan default.
  const currentInterval = billingState.billingInterval ?? currentPlan.interval;

  const currentStorePlan = getStorePlan(currentPlan.id);

  const isHigherPlan = (plan: { price: number }) => plan.price > currentPlan.price;
  const getActionLabel = (plan: { price: number; isFree: boolean }) => {
    if (plan.isFree) return t('billing.changePlan');
    if (isHigherPlan(plan)) return t('billing.upgrade');
    if (plan.price < currentPlan.price) return t('billing.downgrade');
    return t('billing.changePlan');
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel your subscription?')) {
      cancelMutation.mutate();
    }
  };

  // Handle a plan change / upgrade:
  //   - Free plan → direct change-plan API (no Stripe needed)
  //   - Paid plan → checkout API (Stripe Checkout Session) — if Stripe is
  //     not configured, the mutation onError surfaces a clear message.
  const handleSelectPlan = (plan: { id: PlanId; name: string; price: number; isFree: boolean }) => {
    if (plan.isFree) {
      changePlanMutation.mutate({
        planId: plan.id,
        planName: plan.name,
        isUpgrade: isHigherPlan(plan),
      });
    } else {
      checkoutMutation.mutate({
        planId: plan.id,
        planName: plan.name,
        interval: currentInterval,
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('billing.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('billing.description')}</p>
      </div>

      {/* Free-trial-expired banner — surfaces server-side enforcement */}
      {freeTrialExpired && freeTrialExpiresAt && (
        <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/40">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-300">
                Free trial expired
              </p>
              <p className="text-muted-foreground">
                Your free access expired on {formatDate(freeTrialExpiresAt)}. Upgrade to a paid plan to continue using gated features.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('billing.currentPlan')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-lg">{currentPlan.name}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${getPlanBadgeClasses(currentStorePlan.badgeVariant)}`}
                >
                  {currentPlan.name}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                {currentPlan.price === 0
                  ? t('billing.free')
                  : `${currentPlan.price} ${currentPlan.currency}/${normalizeInterval(currentInterval)}`}
              </p>
            </div>
            <Badge
              variant={status === 'active' ? 'default' : 'outline'}
              className="capitalize"
            >
              {status}
            </Badge>
          </div>

          {/* Current period end / next billing date (DB Subscription source of truth) */}
          {currentPeriodEnd && !isCancelled && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                Next billing: <span className="font-medium text-foreground">{formatDate(currentPeriodEnd)}</span>
              </span>
            </div>
          )}

          {trialEnd && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {t('billing.trialActive')} — ends {formatDate(trialEnd)}
              </span>
            </div>
          )}

          <Separator />

          {isCancelled ? (
            <div className="flex items-center justify-end">
              <p className="text-xs text-muted-foreground italic">
                Your subscription is cancelled
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  {t('billing.managePayment')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={cancelMutation.isPending}
                  onClick={handleCancel}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {t('billing.cancelSubscription')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Plans */}
      <div>
        <h2 className="text-base font-semibold mb-4">{t('billing.otherPlans')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {otherPlans.map((plan) => {
            const storePlan = getStorePlan(plan.id);
            const isBusy =
              (changePlanMutation.isPending && changePlanMutation.variables?.planId === plan.id) ||
              (checkoutMutation.isPending && checkoutMutation.variables?.planId === plan.id);
            return (
              <Card
                key={plan.id}
                className={`relative ${getPlanCardBorderClasses(storePlan.badgeVariant)}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold ${getPlanBadgeClasses(storePlan.badgeVariant)}`}
                    >
                      {plan.name}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-2xl font-bold">
                      {plan.price === 0 ? t('billing.free') : `${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-muted-foreground ml-1">
                        {plan.currency}/{normalizeInterval(plan.interval)}
                      </span>
                    )}
                  </div>
                  <Separator />
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isHigherPlan(plan) ? 'default' : 'outline'}
                    disabled={isBusy}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {getActionLabel(plan)}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('billing.paymentHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {billingState.paymentHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-sm">{t('billing.noPayments')}</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-xs text-muted-foreground">{t('billing.invoice')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">Plan</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">{t('billing.amount')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">{t('billing.status')}</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground">Method</th>
                    <th className="pb-2 font-medium text-xs text-muted-foreground text-right">{t('billing.date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {billingState.paymentHistory.map((p: Payment) => {
                    const planForPayment = billingState.allPlans.find((pl) => pl.id === p.planId);
                    return (
                      <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                        <td className="py-2.5 pr-4">
                          <span className="font-mono text-xs">{p.invoiceNumber}</span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${getPlanBadgeClasses(getStorePlan(p.planId).badgeVariant)}`}
                          >
                            {planForPayment?.name ?? p.planId}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-medium">
                          {formatCurrency(p.amount, p.currency)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <PaymentStatusBadge status={p.status} />
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">{p.method}</td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground">
                          {formatDate(p.date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
