'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
import { ENTITLEMENT_LABELS, UNLIMITED, type EntitlementKey } from '@/lib/platform/feature-config';
import { formatMoney } from '@/lib/platform/currency-catalog';
import { PaymentStatusBadge, formatCurrency, formatDate, ErrorState } from '@/modules/platform/shared';

// -------------------- Helpers --------------------

/** Resolve the matching client-side plan definition (for badgeVariant/badgeStyle)
 *  given a backend plan id. Falls back to the first plan so a future plan
 *  still renders with a sensible neutral badge. */
function getStorePlan(planId: string): StorePlan {
  return STORE_PLANS.find((p) => p.id === planId) ?? STORE_PLANS[0];
}

// -------------------- Multi-currency + derived feature helpers --------------------

const GB_FACTOR = 1024 * 1024 * 1024;

/** Server-side currency resolution context (from /api/platform/billing/me
 *  → customerCurrencyResolution). The customer never selects a currency —
 *  the server detects it from the request IP. */
interface CustomerCurrencyResolution {
  currency: string;
  countryCode: string;
  countryName: string;
  source: 'ip' | 'default' | 'local';
}

/** Server-resolved FINAL price for one plan (from /api/platform/billing/me
 *  → planPricing[planId]). Computed by the same resolveCustomerPricing
 *  the checkout route uses — the price/currency displayed here is exactly
 *  what Stripe charges. */
interface ServerPlanPricing {
  planId: string;
  currency: string;
  monthly: number;
  yearly: number;
  source: 'ip' | 'default' | 'local' | 'plan';
  supported: boolean;
  detectedCurrency: string;
  countryCode: string;
  countryName: string;
  regional: boolean;
}

type BillingStateWithCurrency = ClientBillingState & {
  customerCurrencyResolution?: CustomerCurrencyResolution;
  customerCurrency?: string;
  customerCountryCode?: string;
  customerCountryName?: string;
  currencySource?: 'ip' | 'default' | 'local';
  planPricing?: Record<string, ServerPlanPricing>;
};

/** Resolve the price + currency to display for a plan. Prefers the
 *  SERVER-RESOLVED pricing (planPricing — the same values checkout
 *  charges); falls back to a local pricesByCurrency lookup for older
 *  API responses. */
function resolvePlanPricing(
  plan: {
    id: string;
    pricesByCurrency?: Record<string, { monthly: number; yearly: number }>;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    interval: 'monthly' | 'yearly';
  },
  serverPricing: ServerPlanPricing | undefined,
  customerCurrency: string,
): { monthly: number; yearly: number; currency: string } {
  if (serverPricing) {
    return {
      monthly: serverPricing.monthly,
      yearly: serverPricing.yearly,
      currency: serverPricing.currency,
    };
  }
  // Legacy fallback — local lookup (display only).
  const entry = plan.pricesByCurrency?.[customerCurrency];
  if (entry) return { monthly: entry.monthly, yearly: entry.yearly, currency: customerCurrency };
  return { monthly: plan.priceMonthly, yearly: plan.priceYearly, currency: plan.currency };
}

/** One customer-facing plan feature: a label line (rendered with a ✓)
 *  plus optional indented sub-lines. Used for the Platform AI block —
 *  its description + the plan's AI usage limits sit NEXT TO the ✓
 *  Platform AI feature so the customer immediately understands what
 *  is included (never "✓ Platform AI" alone when Platform AI is
 *  enabled). */
interface PlanFeatureItem {
  label: string;
  subLines?: string[];
}

/** Compact AI-limit number for the customer-facing plan cards:
 *  200000 → "200K", 25000 → "25K", 1500 → "1.5K", 100 → "100",
 *  -1 → "Unlimited". */
function formatAiCount(n: number): string {
  if (n === UNLIMITED) return 'Unlimited';
  if (n >= 1000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? String(k) : k.toFixed(1)}K`;
  }
  return String(n);
}

/** Derive the customer-facing feature list from the plan's entitlements +
 *  a few standard items (max sites, storage, support tier). Uses the
 *  legacy plan.features array when it has entries (legacy compat for
 *  plans that still have manually-maintained marketing copy, e.g. the
 *  synthetic Internal plan). The structured entitlements are the
 *  single source of truth — the admin no longer maintains a separate
 *  marketing list per plan.
 *
 *  PLATFORM AI: the ✓ Platform AI feature item carries its own
 *  description ("AI provided by the platform") plus the plan's AI
 *  usage limits (article + image generations per month — words/tokens
 *  are never metered) as nested sub-lines — shown ONLY while Platform
 *  AI is enabled (Client's Own AI API-only plans never show platform AI
 *  limits; own-API usage is not counted against them). */
function derivePlanFeatures(plan: {
  features: string[];
  entitlements: string[];
  isFree: boolean;
  limits: {
    maxSites: number;
    storageBytes: number;
    aiArticlesPerMonth?: number;
    aiImagesPerMonth?: number;
  };
}): PlanFeatureItem[] {
  if (plan.features.length > 0) {
    // Legacy marketing copy — plain items, no sub-lines.
    return plan.features.map((f) => ({ label: f }));
  }
  const items: PlanFeatureItem[] = [];
  items.push(
    plan.limits.maxSites === -1
      ? { label: 'Unlimited sites' }
      : { label: `Up to ${plan.limits.maxSites} sites` },
  );
  const gb = plan.limits.storageBytes / GB_FACTOR;
  if (gb >= 1) {
    items.push({ label: `${Math.floor(gb)} GB storage` });
  } else if (plan.limits.storageBytes > 0) {
    items.push({ label: `${plan.limits.storageBytes} bytes storage` });
  } else {
    items.push({ label: 'No storage' });
  }
  items.push({ label: plan.isFree ? 'Community support' : 'Priority support' });
  // Enabled features — ONLY the enabled ones are displayed (each
  // entitlement key renders its label). Platform AI nests its limits
  // directly next to the feature; Client's Own AI API states that
  // platform AI limits do not apply to it. The legacy 'ai_content'
  // alias is skipped (it duplicates the AI feature keys).
  for (const e of plan.entitlements) {
    if (e === 'ai_content') continue;
    const label = ENTITLEMENT_LABELS[e as EntitlementKey];
    if (!label) continue;
    if (e === 'ai_platform') {
      const articles = plan.limits.aiArticlesPerMonth ?? 0;
      const images = plan.limits.aiImagesPerMonth ?? 0;
      // Display-only: the monthly usage-limit logic is unchanged; the
      // customer-facing lines just drop the "/ month" suffix (they are
      // usage limits, not prices) and render as separate lines.
      items.push({
        label,
        subLines: [
          'AI provided by the platform',
          `${formatAiCount(articles)} AI articles`,
          `${formatAiCount(images)} AI images`,
        ],
      });
      continue;
    }
    if (e === 'ai_client') {
      items.push({
        label,
        subLines: ["Your own AI provider — platform AI usage limits don't apply"],
      });
      continue;
    }
    items.push({ label });
  }
  return items;
}

/** Render the derived plan feature items — one ✓ row per item with
 *  optional indented sub-lines (the Platform AI limits next to the
 *  ✓ Platform AI feature). */
function PlanFeatureList({ items }: { items: PlanFeatureItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={`${item.label}-${idx}`} className="flex items-start gap-2 text-sm">
          <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="block">{item.label}</span>
            {item.subLines?.map((s) => (
              <span key={s} className="block text-xs text-muted-foreground leading-snug mt-0.5">
                {s}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

// -------------------- Component --------------------

export function BillingPage() {
  const { t } = useT();
  const queryClient = useQueryClient();

  // ONE global billing period (Monthly / Yearly) shared by ALL plan
  // cards — selected via the single selector ABOVE the plans grid
  // (never repeated inside a card). null = not chosen yet → defaults
  // to the CURRENT subscription's interval until the customer picks.
  // Plans that don't support the selected period keep showing their
  // only enabled period (see the card logic below). Declared before
  // the early returns below (hooks order).
  const [globalPeriod, setGlobalPeriod] = useState<'monthly' | 'yearly' | null>(null);

  const billingQuery = useQuery<BillingStateWithCurrency>({
    queryKey: ['platform-billing-me'],
    queryFn: () => getApi<BillingStateWithCurrency>('/api/platform/billing/me'),
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
          'Stripe is not configured on this platform. An admin must connect Stripe in Platform Admin → Stripe Settings to enable real checkout. Free plans can still be selected directly.',
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
      <div className="max-w-6xl mx-auto space-y-8">
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-44 rounded-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex flex-col flex-1">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-10 w-32 mt-4" />
                  <Separator className="my-5" />
                  <div className="space-y-2 flex-1">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-9 w-full mt-6" />
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
      <div className="max-w-6xl mx-auto space-y-8">
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
  const billingState: BillingStateWithCurrency = billingQuery.data;

  // Owner / billing-bypass users (billingMode INTERNAL/EXEMPT) get a
  // dedicated panel instead of the plan cards — they have full platform
  // access and are not a paying customer.
  if (billingState.isInternal) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
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
            <PlanFeatureList items={derivePlanFeatures(billingState.plan)} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Customer's resolved currency + country (server-side IP geolocation
  // via /api/platform/billing/me → customerCurrencyResolution). Falls
  // back to the plan's default currency when no resolution is present
  // (e.g. legacy customer without the new server-side resolution).
  const customerCurrencyResolution = billingState.customerCurrencyResolution;
  const customerCurrency =
    customerCurrencyResolution?.currency ?? billingState.plan.currency;
  const customerCountryName = customerCurrencyResolution?.countryName;
  const currencySource = customerCurrencyResolution?.source;

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

  // ---- ONE global Monthly / Yearly selector (above all plans) ----
  // Rendered only when at least one OTHER plan supports yearly billing
  // (when no plan does, the selector is not shown at all). It controls
  // the displayed billing period for every plan card; plans that don't
  // support the selected period keep showing their ONLY enabled period
  // (existing billing logic — a disabled period is never displayed and
  // never sent to checkout, so no invalid/fake price can appear).
  // Before the customer picks, it defaults to the current subscription's
  // interval (the period they are actually billed on).
  const showPeriodSelector = otherPlans.some((p) => p.billingYearly ?? true);
  const effectivePeriod: 'monthly' | 'yearly' =
    globalPeriod ?? (currentInterval === 'yearly' ? 'yearly' : 'monthly');

  const currentStorePlan = getStorePlan(currentPlan.id);

  // Server-resolved FINAL pricing per plan — the same resolveCustomerPricing
  // values the checkout route charges (falls back to a local lookup for
  // older API responses).
  const planPricing = billingState.planPricing;
  const currentPricing = resolvePlanPricing(currentPlan, planPricing?.[currentPlan.id], customerCurrency);
  // The CURRENT subscription's price = the price for the interval the
  // subscription is actually on (monthly price / yearly total).
  const currentPrice =
    currentInterval === 'yearly' ? currentPricing.yearly : currentPricing.monthly;
  const currentDisplayCurrency = currentPricing.currency;
  // Price suffix: explicit "/ month" | "/ year" next to the displayed
  // amount — consistent with the redesigned plan cards (also removes
  // any ambiguity when a card's period differs from the global one).

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
  //   - Paid plan → checkout API (Stripe Checkout Session) — the body
  //     sends ONLY planId + interval; the currency/price is resolved
  //     SERVER-SIDE from the request IP (the frontend cannot pick it).
  //     The interval is the card's DISPLAYED billing period — the
  //     global Monthly/Yearly selection when the plan supports it,
  //     otherwise the plan's only enabled period (the backend rejects
  //     a disabled interval) — so the charged amount always matches.
  const handleSelectPlan = (
    plan: {
      id: PlanId;
      name: string;
      price: number;
      isFree: boolean;
      billingMonthly?: boolean;
      billingYearly?: boolean;
      interval: 'monthly' | 'yearly';
    },
    interval: 'monthly' | 'yearly',
  ) => {
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
        interval,
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t('billing.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('billing.description')}</p>
        {/* Auto Currency indicator — shows the customer's resolved
            currency + the source (IP-detected / platform default /
            local development). The server resolves this from the
            request IP; the client cannot change currency manually. */}
        {currencySource && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono">
              Currency: {customerCurrency}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {currencySource === 'ip'
                ? `Auto-detected from your location${customerCountryName ? ` (${customerCountryName})` : ''}`
                : currencySource === 'default'
                  ? 'Platform default'
                  : 'Local development'}
            </span>
          </div>
        )}
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-2xl font-semibold tracking-tight">{currentPlan.name}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${getPlanBadgeClasses(currentStorePlan.badgeVariant)}`}
                >
                  {currentPlan.name}
                </Badge>
              </div>
              {/* Same price treatment as the redesigned plan cards —
                  large amount + explicit period suffix (display only;
                  the price source and suffix logic are unchanged). */}
              <div className="flex items-baseline gap-1.5 ml-7">
                <span className="text-3xl font-bold tracking-tight">
                  {currentPrice === 0
                    ? t('billing.free')
                    : formatMoney(currentPrice, currentDisplayCurrency)}
                </span>
                {currentPrice > 0 && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    / {currentInterval === 'yearly' ? 'year' : 'month'}
                  </span>
                )}
              </div>
              {currentPrice > 0 &&
                planPricing?.[currentPlan.id] &&
                planPricing[currentPlan.id].supported &&
                customerCountryName && (
                  <p className="text-[11px] text-muted-foreground ml-7">
                    Priced for {customerCountryName} ({currentDisplayCurrency})
                  </p>
                )}
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

          {/* Included in your plan — the plan's usage limits (sites,
              storage) plus the ENABLED feature checkmarks (disabled
              features are never displayed). Platform AI shows its AI
              limits NESTED next to the ✓ Platform AI feature (only
              while Platform AI is enabled). Same derivation as the
              plan cards. */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Included in your plan
            </p>
            <PlanFeatureList items={derivePlanFeatures(currentPlan)} />
          </div>

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

      {/* Other Plans — ONE global Monthly / Yearly selector above ALL
          cards (never repeated inside a card). Card layout: large plan
          name → large price → divider → feature list with check icons →
          action button pinned to the bottom. */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-base font-semibold">{t('billing.otherPlans')}</h2>
          {/* Global billing-period selector — shown only when at least
              one available plan supports yearly billing; it then drives
              the displayed billing period of every plan card below. */}
          {showPeriodSelector && (
            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex items-center rounded-full border bg-muted/40 p-1"
            >
              <button
                type="button"
                onClick={() => setGlobalPeriod('monthly')}
                aria-pressed={effectivePeriod === 'monthly'}
                className={`h-8 rounded-full px-5 text-xs font-medium transition-colors ${
                  effectivePeriod === 'monthly'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setGlobalPeriod('yearly')}
                aria-pressed={effectivePeriod === 'yearly'}
                className={`h-8 rounded-full px-5 text-xs font-medium transition-colors ${
                  effectivePeriod === 'yearly'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Yearly
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {otherPlans.map((plan) => {
            const storePlan = getStorePlan(plan.id);
            // Server-resolved FINAL price — the same values checkout charges.
            const planPricingResolved = resolvePlanPricing(plan, planPricing?.[plan.id], customerCurrency);
            const planDisplayCurrency = planPricingResolved.currency;
            const planSupported = planPricing?.[plan.id]?.supported ?? true;
            // ---- Enabled billing periods (admin-configured per plan) ----
            const planHasMonthly = plan.billingMonthly ?? true;
            const planHasYearly = plan.billingYearly ?? true;
            // The card's displayed period: the GLOBAL selection when this
            // plan supports it; otherwise the plan's ONLY enabled period
            // (pinned — existing billing logic: a disabled period is
            // never displayed and never sent to checkout, so no
            // invalid/fake price can appear; the backend rejects a
            // disabled interval too).
            const followsSelection =
              effectivePeriod === 'monthly' ? planHasMonthly : planHasYearly;
            const cardInterval: 'monthly' | 'yearly' = followsSelection
              ? effectivePeriod
              : planHasMonthly
                ? 'monthly'
                : planHasYearly
                  ? 'yearly'
                  : plan.interval;
            const planPrice =
              cardInterval === 'yearly' ? planPricingResolved.yearly : planPricingResolved.monthly;
            const isBusy =
              (changePlanMutation.isPending && changePlanMutation.variables?.planId === plan.id) ||
              (checkoutMutation.isPending && checkoutMutation.variables?.planId === plan.id);
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${getPlanCardBorderClasses(storePlan.badgeVariant)}`}
              >
                <CardContent className="flex flex-col flex-1">
                  {/* Large plan name — keeps the plan's color identity via
                      the card border + its soft badge. */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                      {plan.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold shrink-0 ${getPlanBadgeClasses(storePlan.badgeVariant)}`}
                    >
                      {plan.name}
                    </Badge>
                  </div>
                  {/* Large price — explicit period suffix so the amount is
                      always unambiguous (also for pinned-period cards). */}
                  <div className="mt-4">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-bold tracking-tight text-foreground">
                        {planPrice === 0 ? t('billing.free') : formatMoney(planPrice, planDisplayCurrency)}
                      </span>
                      {planPrice > 0 && (
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          / {cardInterval === 'yearly' ? 'year' : 'month'}
                        </span>
                      )}
                    </div>
                    {/* A plan that cannot follow the global selection keeps
                        its only enabled period — stated explicitly (never
                        an invalid price for the selected period). */}
                    {!plan.isFree && !followsSelection && planHasMonthly !== planHasYearly && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {planHasMonthly ? 'Monthly billing only' : 'Yearly billing only'}
                      </p>
                    )}
                    {planPrice > 0 && customerCountryName && planSupported && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Priced for {customerCountryName} ({planDisplayCurrency})
                      </p>
                    )}
                    {planPrice > 0 && !planSupported && planPricing?.[plan.id] && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Priced in {planDisplayCurrency} (plan default) — {planPricing[plan.id].detectedCurrency} not
                        configured for this plan
                      </p>
                    )}
                  </div>
                  <Separator className="my-5" />
                  {/* Feature list with check icons */}
                  <div className="flex-1">
                    <PlanFeatureList items={derivePlanFeatures(plan)} />
                  </div>
                  {/* Action button pinned to the card bottom (label +
                      behavior unchanged: Upgrade / Downgrade / Change
                      Plan per the existing subscription logic). */}
                  <Button
                    className="mt-6 w-full"
                    variant={isHigherPlan(plan) ? 'default' : 'outline'}
                    disabled={isBusy}
                    onClick={() => handleSelectPlan(plan, cardInterval)}
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
