'use client';

// ============================================================
// PLATFORM PLANS & PRICING — simplified admin UI.
// ============================================================
// Owner sees compact plan cards (Free / Plus / Pro / Max …) with a
// quick Active toggle, a compact price + features + limits summary,
// and an "Edit Plan" button. The Edit Plan button opens a Dialog
// with three compact sections: Basic Information (multi-currency
// price matrix), Feature Access (entitlement checkboxes), Usage
// Limits. A collapsed "Stripe Billing" section holds the
// per-currency Stripe Price IDs and a manual sync button. A
// "+ Create Plan" button at the top-right opens a Create Plan
// dialog (same sections, blank defaults) that POSTs to
// /api/platform/admin/plans.
//
// MULTI-CURRENCY: each plan stores pricesByCurrency +
// stripePriceIdsByCurrency (one entry per supported currency).
// The legacy priceMonthly/priceYearly/currency/stripePriceIdMonthly/
// stripePriceIdYearly fields are snapshots of the platform DEFAULT
// currency — they are derived by the backend, never sent in the
// patch. The Client Billing page derives the customer's currency
// server-side from their IP and looks up pricesByCurrency[currency].
//
// All writes go through /api/platform/admin/plans (GET list,
// POST create) + /api/platform/admin/plans/[planId] (PUT update)
// — owner-only — the same shared plan-config cache the Client
// Billing page and MRR read. Server-side entitlement enforcement
// (hasFeature) and usage-limit checks (checkLimit) consume the
// same data, so toggling a feature off here denies it for clients
// on the next request.
// ============================================================

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, putApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import {
  ErrorState,
  PlanBadge,
} from '@/modules/platform/shared';
import {
  ENTITLEMENT_KEYS,
  ENTITLEMENT_LABELS,
  LIMIT_KEYS,
  LIMIT_LABELS,
  UNLIMITED,
  type EntitlementKey,
} from '@/lib/platform/feature-config';
import type {
  PlanConfigData,
  PlanLimits,
  PricesByCurrency,
  StripePriceIdsByCurrency,
} from '@/lib/platform/plan-config';
import { useAuthStore } from '@/lib/stores/auth-store';

type PlanPatch = Partial<PlanConfigData>;

// -------------------- helpers --------------------

/** Resolve the badge id for the shared PlanBadge component. Falls
 *  back to 'free' for any unknown plan id so future plans still
 *  render with a sensible neutral badge. */
function getPlanBadgeId(planId: string): 'free' | 'plus' | 'pro' | 'max' {
  if (planId === 'free' || planId === 'plus' || planId === 'pro' || planId === 'max') return planId;
  // Legacy 'beta' plan id (pre-migration) → render as 'plus' badge.
  if (planId === 'beta') return 'plus';
  return 'free';
}

// -------------------- Price formatting helpers --------------------

/** Display symbol for a currency code. Plans & Pricing shows a
 *  symbol (not the ISO text code) per the visual spec — e.g. "$7.50"
 *  not "USD 7.50" / "CHF 7.50". The stored currency code in the DB is
 *  unaffected; this is a display-only mapping. Unknown codes default
 *  to '$' so the price always renders as a compact symbol + number. */
function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
  };
  return map[(code ?? '').toUpperCase()] ?? '$';
}

/** Format an integer amount with the display symbol, no decimals.
 *  e.g. (90, 'USD') → "$90"; (0, 'CHF') → "$0". */
function formatPriceSymbol(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** Format with 2 decimals — used for the monthly-equivalent of a
 *  yearly price (yearly 90 → "$7.50"). Always two decimals so the
 *  large primary price reads "$7.50" / "$40.83" / "$82.50". */
function formatPriceSymbolMonthlyEquiv(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// -------------------- Plan summary tile --------------------

function PlanSummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-muted/40 px-4 py-2.5">
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// -------------------- Plan Card (compact) --------------------

function PlanSummaryCard({
  plan,
  canEdit,
  billingInterval,
}: {
  plan: PlanConfigData;
  canEdit: boolean;
  billingInterval: 'monthly' | 'yearly';
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  // Quick active toggle — auto-saves immediately (owner-only).
  // Reuses the same PUT endpoint and the same invalidation chain
  // as the full Edit modal so clients see the new status on the
  // next read.
  const activeMutation = useMutation({
    mutationFn: (active: boolean) =>
      putApi<PlanConfigData>(`/api/platform/admin/plans/${plan.planId}`, { active }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
      queryClient.invalidateQueries({ queryKey: ['platform-billing-me'] });
      queryClient.invalidateQueries({ queryKey: ['platform-overview'] });
      toast.success(
        `${data.name} ${data.active ? 'activated' : 'deactivated'} — changes are live for clients.`,
      );
    },
    onError: (err: unknown) => {
      const e = err as { error?: { message?: string }; message?: string };
      toast.error(
        e?.error?.message ?? e?.message ?? 'Unable to change plan status. OWNER access required.',
      );
    },
  });

  // Feature list shown on the card. Prefer the client-facing marketing
  // copy (plan.features); fall back to the structured entitlement labels
  // so a brand-new plan with no marketing copy still surfaces a readable
  // feature list. Either way the data shown is real plan data — no mock.
  const featureItems =
    plan.features.length > 0
      ? plan.features
      : plan.entitlements.map((k) => ENTITLEMENT_LABELS[k as EntitlementKey] ?? k);

  return (
    <>
      <div
        className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card p-8 text-card-foreground transition-colors duration-300 hover:border-foreground/20 ${
          plan.active ? '' : 'opacity-60'
        }`}
      >
        {/* Header: plan name (LARGEST typographic element on the card).
             The price sits BELOW the name on its own row (see price
             block below), not on the same line — so the name has the
             full card width and reads as the clear card heading. Same
             typography (text-5xl font-bold) on Free / Plus / Pro / Max. */}
        <div className="min-w-0">
          <h3 className="text-5xl font-bold tracking-tight text-foreground">{plan.name}</h3>
        </div>

        {/* Price — sits BELOW the plan name on its own row. Reflects
             the global billing-interval selector (Monthly / Yearly).
             The price's LEFT edge aligns with the plan name's first
             letter — the "$" sits directly under "F" of Free, "P" of
             Plus/Pro, "M" of Max (no left breakout, so the price column
             is flush with the name column above it). A RIGHT-side
             breakout (-mr-6, into the card padding p-8) is kept so the
             Yearly layout ($X.XX / month   $X / year) still fits on ONE
             line at wider card widths; flex-wrap lets it wrap gracefully
             at narrower widths. Only the price VALUES change between
             Monthly and Yearly.

             Typography (IDENTICAL in both modes, same on all 4 cards):
               - Main price: text-4xl font-semibold (36px) — slightly
                 smaller than the plan name (text-5xl = 48px), still
                 clearly larger than the labels (so the monthly-equiv
                 reads as the MAIN price)
               - /month, /year: text-sm text-muted-foreground (14px) —
                 small muted (the yearly total is smaller/muted beside
                 the main monthly-equiv price)
               - Free:    $0
               - Monthly: $X / month
               - Yearly:  $X.XX / month   $X / year
             For Yearly, the monthly equivalent (priceYearly / 12,
             computed dynamically, never hardcoded) is the LARGE primary
             price; the actual yearly total is shown smaller and muted
             beside it on the same line. "/ month" belongs to the large
             monthly price; "/ year" belongs to the small yearly total.
             Width budget (measured): card content (p-8) ≈ 245-269px
             (varies with viewport) + right -mr-6 breakout (24px) ≈
             269-293px. Widest case = Max Yearly: $82.50(134) + gap-2(8)
             + /month(55) + gap-2(8) + $990/year(81) = 286px → fits at
             wider card widths, wraps to 2 lines at narrower widths
             (flex-wrap). shrink-0 + whitespace-nowrap + leading-none on
             each price span keep each span's internals from breaking;
             uniform gap-2 (8px) between every price element (no ml-2)
             so wrapped lines stay left-aligned. */}
        <div className="-mr-6 mt-6">
          {plan.isFree ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="shrink-0 whitespace-nowrap text-4xl font-semibold leading-none tracking-tight text-foreground">
                {formatPriceSymbol(0, plan.currency)}
              </span>
            </div>
          ) : billingInterval === 'yearly' ? (
            // Yearly — INLINE: [LARGE $X.XX] [small / month]
            // [small $X / year]. The monthly equivalent (priceYearly /
            // 12) is the dominant large price; the real yearly total
            // stays small/muted beside it.
            //   e.g. Plus →  $7.50 / month   $90 / year
            //        Pro  →  $40.83 / month  $490 / year
            //        Max  →  $82.50 / month  $990 / year
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="shrink-0 whitespace-nowrap text-4xl font-semibold leading-none tracking-tight text-foreground">
                {formatPriceSymbolMonthlyEquiv(plan.priceYearly / 12, plan.currency)}
              </span>
              <span className="whitespace-nowrap text-sm text-muted-foreground">/ month</span>
              <span className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
                {formatPriceSymbol(plan.priceYearly, plan.currency)} / year
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="shrink-0 whitespace-nowrap text-4xl font-semibold leading-none tracking-tight text-foreground">
                {formatPriceSymbol(plan.priceMonthly, plan.currency)}
              </span>
              <span className="whitespace-nowrap text-sm text-muted-foreground">/ month</span>
            </div>
          )}
        </div>

        {/* Thin horizontal divider between the price section and the features section.
             Equidistant from the price above and the feature list below (mt-6 both
             sides) for a consistent, compact vertical rhythm on every card. The
             divider uses -mr-6 (right breakout only) so its left edge aligns with
             the price row + plan name above (flush to the content left) while its
             right edge extends into the card padding to match the price row —
             identical in both modes. */}
        <div className="-mr-6 mt-6 h-px bg-border" aria-hidden />

        {/* Feature items (section label omitted). Same typography on every card:
             text-[15px] leading-normal so features read as a clear medium-size
             block — visibly subordinate to the text-5xl plan name and text-4xl
             price, never competing with them. Check icon is h-4 w-4 with mt-0.5
             so its optical center aligns with the first line of feature text;
             gap-2.5 keeps a consistent icon↔text column gutter; items-start
             pins the icon to the first line even when a feature wraps to 2
             lines, so rows never look vertically misaligned. All cards share
             the card's p-8 left padding, so every feature column starts at the
             same x. */}
        <div className="mt-6">
          <ul className="space-y-2.5">
            {featureItems.length === 0 ? (
              <li className="text-[15px] leading-normal text-muted-foreground">No features configured</li>
            ) : (
              featureItems.map((f, i) => (
                <li key={`${f}-${i}`} className="flex items-start gap-2.5 text-[15px] leading-normal text-card-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{f}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Bottom row — Edit Plan (left, flex-1) + quick active toggle
             (right, shrink-0), pinned to the card bottom. The toggle used
             to live in the header's top-right; it was relocated here so the
             name + price row above can use the full card width and the
             price can sit on the same line as the name. The Edit button
             changed from w-full to flex-1 to share the row with the toggle.
             The toggle's logic (auto-save PUT to /api/platform/admin/plans/
             [planId] with { active }) is unchanged. */}
        <div className="mt-auto flex items-center gap-3 pt-8">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-full"
            disabled={!canEdit}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Plan
          </Button>
          <div className="flex shrink-0 items-center gap-2">
            <Label
              htmlFor={`active-${plan.planId}`}
              className="cursor-pointer text-xs text-muted-foreground"
            >
              {plan.active ? 'Active' : 'Inactive'}
            </Label>
            <Switch
              id={`active-${plan.planId}`}
              checked={plan.active}
              disabled={!canEdit || activeMutation.isPending}
              onCheckedChange={(v) => activeMutation.mutate(v)}
            />
          </div>
        </div>
        {!canEdit && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Editing is restricted to the OWNER role.
          </p>
        )}
      </div>

      {editing && (
        <EditPlanDialog plan={plan} open={editing} onOpenChange={setEditing} />
      )}
    </>
  );
}

// -------------------- Edit Plan Dialog --------------------

function EditPlanDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: PlanConfigData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(plan.name);
  // MULTI-CURRENCY: pricesByCurrency is the AUTHORITATIVE price map
  // (one entry per supported currency, each with monthly + yearly).
  // The legacy priceMonthly/priceYearly/currency snapshot fields are
  // derived from pricesByCurrency[defaultCurrency] by the backend —
  // we don't send them in the patch.
  const [pricesByCurrency, setPricesByCurrency] = useState<PricesByCurrency>(
    plan.pricesByCurrency ?? {},
  );
  const [stripePriceIdsByCurrency, setStripePriceIdsByCurrency] =
    useState<StripePriceIdsByCurrency>(plan.stripePriceIdsByCurrency ?? {});
  // Currency is NOT admin-editable per-plan — it is derived from the
  // platform's default country (CountryPricing). We display it as
  // read-only so the admin knows the platform default currency.
  const currency = plan.currency;
  const [interval, setInterval] = useState<'monthly' | 'yearly'>(plan.interval);
  const [active, setActive] = useState(plan.active);
  const [entitlements, setEntitlements] = useState<string[]>(plan.entitlements);
  const [limits, setLimits] = useState<PlanLimits>(plan.limits);
  // Free-trial duration (only used when ALL prices are 0).
  const [freePlanDurationDays, setFreePlanDurationDays] = useState<string>(
    plan.freePlanDurationDays == null ? '' : String(plan.freePlanDurationDays),
  );
  const [stripeOpen, setStripeOpen] = useState(false);

  // Fetch the platform's SUPPORTED currencies (active CountryPricing
  // rows). The default currency (isDefault: true) is moved to the front
  // so it shows as the first row in the price + Stripe Price ID matrices.
  // Used to drive the multi-currency inputs below.
  const currenciesQuery = useQuery<string[]>({
    queryKey: ['platform-currencies'],
    queryFn: async () => {
      const res = await fetch('/api/platform/admin/countries', { credentials: 'include' });
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json.data ?? []);
      const list = (rows as { currency?: string; isDefault?: boolean }[])
        .filter((r) => r && typeof r === 'object' && r.currency);
      const def = list.find((r) => r.isDefault);
      const set = new Set<string>();
      if (def?.currency) set.add(String(def.currency).toUpperCase());
      for (const r of list) {
        if (r.currency) set.add(String(r.currency).toUpperCase());
      }
      return Array.from(set);
    },
    staleTime: 5 * 60 * 1000,
  });
  const currencies = currenciesQuery.data ?? [];

  // The EditPlanDialog is conditionally rendered by the parent (mounted
  // fresh each time the user opens it), so the useState initializers
  // above already seed local state from the latest server snapshot.
  // No useEffect sync is needed — that would just trigger cascading
  // renders (and the React Compiler correctly flags it). Currency rows
  // not yet in the state are rendered with their default value (0 or '')
  // and added to the state on the first onChange.

  const reset = () => {
    setName(plan.name);
    setPricesByCurrency(plan.pricesByCurrency ?? {});
    setStripePriceIdsByCurrency(plan.stripePriceIdsByCurrency ?? {});
    setInterval(plan.interval);
    setActive(plan.active);
    setEntitlements(plan.entitlements);
    setLimits(plan.limits);
    setFreePlanDurationDays(plan.freePlanDurationDays == null ? '' : String(plan.freePlanDurationDays));
  };

  const saveMutation = useMutation({
    mutationFn: (patch: PlanPatch) =>
      putApi<PlanConfigData>(`/api/platform/admin/plans/${plan.planId}`, patch),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
      queryClient.invalidateQueries({ queryKey: ['platform-billing-me'] });
      queryClient.invalidateQueries({ queryKey: ['platform-overview'] });
      toast.success(`${data.name} updated — changes are now live for clients.`);
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const e = err as { error?: { message?: string }; message?: string };
      toast.error(
        e?.error?.message ?? e?.message ?? 'Unable to save plan. You may need OWNER access.',
      );
    },
  });

  // Sync this plan to Stripe (creates/reuses the Stripe Product + one
  // Stripe Price per (currency, interval) pair and writes the resolved
  // stripePriceIdsByCurrency map back onto the plan row). Surfaces
  // Stripe errors inline so the admin can fix them.
  const syncToStripeMutation = useMutation({
    mutationFn: () =>
      postApi<{
        planId: string;
        stripePriceIdsByCurrency: StripePriceIdsByCurrency;
        created: number;
        defaultCurrencySnapshot: { monthly: string | null; yearly: string | null };
      }>(`/api/platform/admin/plans/${plan.planId}/sync-stripe`),
    onSuccess: (data) => {
      // Reflect the synced per-currency Stripe Price IDs in the local
      // form state so the admin can see them without re-opening the dialog.
      setStripePriceIdsByCurrency(data.stripePriceIdsByCurrency);
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
      toast.success(
        data.created > 0
          ? `Synced to Stripe — ${data.created} new Price(s) created.`
          : 'Stripe Prices are already in sync.',
      );
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; message?: string; error?: { code?: string; message?: string } };
      const code = e?.code ?? e?.error?.code;
      const msg = e?.message ?? e?.error?.message;
      if (code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
        toast.error('Stripe is not connected. Configure credentials in Platform Admin → Stripe Settings first.');
      } else if (code === 'VALIDATION_ERROR') {
        toast.error(msg || 'Free plans do not need Stripe — set a price above 0 first.');
      } else {
        toast.error(msg || 'Unable to sync plan to Stripe.');
      }
    },
  });

  // A plan is free when ALL configured currencies have monthly + yearly
  // prices of 0. The legacy priceMonthly/priceYearly are derived from
  // the default currency's entry in pricesByCurrency.
  const isFreeDerived = Object.values(pricesByCurrency).every(
    (p) => p.monthly === 0 && p.yearly === 0,
  );

  const buildPatch = (): PlanPatch => {
    return {
      name,
      // No priceMonthly/priceYearly/currency in the patch — they're
      // derived from pricesByCurrency[defaultCurrency] by the backend.
      pricesByCurrency,
      interval,
      isFree: isFreeDerived,
      freePlanDurationDays: isFreeDerived ? (freePlanDurationDays.trim() === '' ? null : Number(freePlanDurationDays) || null) : null,
      // No stripePriceIdMonthly/Yearly — they live in
      // stripePriceIdsByCurrency now (controlled via the Stripe section).
      stripePriceIdsByCurrency,
      active,
      // features intentionally omitted — the backend derives the
      // marketing copy from entitlements on the client side now.
      // savePlanConfig preserves the existing value when omitted.
      entitlements,
      limits: { ...limits, storageBytes: Number(limits.storageBytes) || 0 },
    };
  };

  // Stripe sync status — true when at least one currency has any
  // Stripe Price ID set. Used for the inline status text.
  const stripeWired = Object.values(stripePriceIdsByCurrency).some(
    (v) => v.monthly || v.yearly,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base">Edit {plan.name}</DialogTitle>
            <PlanBadge planId={getPlanBadgeId(plan.planId)} />
          </div>
          <DialogDescription className="text-xs">
            Single source of truth — changes propagate to the Client Billing page, MRR and
            server-side entitlement enforcement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* -------------------- Basic Information -------------------- */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Basic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default Currency</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3">
                  <span className="text-sm font-medium tabular-nums">{currency}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">platform</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Auto-resolved from the platform default country. Edit countries in Pricing.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Billing Interval</Label>
                <Select
                  value={interval}
                  onValueChange={(v) => setInterval(v as 'monthly' | 'yearly')}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">monthly</SelectItem>
                    <SelectItem value="yearly">yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 h-9 sm:mt-5">
                <Label
                  htmlFor="dialog-active"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Active
                </Label>
                <Switch
                  id="dialog-active"
                  checked={active}
                  onCheckedChange={setActive}
                />
              </div>
            </div>

            {/* MULTI-CURRENCY PRICE MATRIX — one row per supported
                currency. The currency code is a read-only badge; the
                Monthly + Yearly prices are editable number inputs. Any
                currency not yet in the state defaults to {0, 0} (free).
                The default currency's row mirrors the legacy
                priceMonthly/priceYearly snapshot — kept in sync by the
                backend on save. */}
            <div className="space-y-2">
              <Label className="text-xs">Prices by Currency</Label>
              <div className="space-y-1.5">
                <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] text-muted-foreground px-1">
                  <span>Currency</span>
                  <span>Monthly</span>
                  <span>Yearly</span>
                </div>
                {currencies.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic">
                    Loading supported currencies…
                  </div>
                ) : (
                  currencies.map((code) => (
                    <div key={code} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                      <Badge variant="outline" className="font-mono text-[10px] justify-center h-9">
                        {code}
                      </Badge>
                      <Input
                        type="number"
                        value={pricesByCurrency[code]?.monthly ?? 0}
                        onChange={(e) =>
                          setPricesByCurrency((s) => ({
                            ...s,
                            [code]: {
                              monthly: Number(e.target.value) || 0,
                              yearly: s[code]?.yearly ?? 0,
                            },
                          }))
                        }
                        className="h-9"
                      />
                      <Input
                        type="number"
                        value={pricesByCurrency[code]?.yearly ?? 0}
                        onChange={(e) =>
                          setPricesByCurrency((s) => ({
                            ...s,
                            [code]: {
                              monthly: s[code]?.monthly ?? 0,
                              yearly: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="h-9"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Free plan trial duration — shown only when ALL prices
                are 0 (i.e. this is a free plan). Empty = unlimited. */}
            {isFreeDerived && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Free Access Duration (days)</Label>
                  <Input
                    type="number"
                    value={freePlanDurationDays}
                    onChange={(e) => setFreePlanDurationDays(e.target.value)}
                    className="h-9"
                    placeholder="empty = unlimited"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Server-side enforced: when set, the user&apos;s free trial expires N days after activation.
                    Empty = unlimited free access.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* -------------------- Stripe Billing (optional) -------------------- */}
          <Collapsible open={stripeOpen} onOpenChange={setStripeOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full rounded-md hover:bg-accent/30 px-2 py-1.5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Stripe Billing</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    optional
                  </Badge>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    stripeOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Compact sync row — button on the left, status on the right. */}
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={syncToStripeMutation.isPending}
                  onClick={() => syncToStripeMutation.mutate()}
                >
                  {syncToStripeMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Sync to Stripe
                </Button>
                <div className="text-[11px] text-muted-foreground ml-auto">
                  {stripeWired ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Wired: per-currency Stripe Prices set
                    </span>
                  ) : (
                    <span>Not yet wired. Click the button to create Stripe Prices.</span>
                  )}
                </div>
              </div>
              {/* MULTI-CURRENCY STRIPE PRICE ID GRID — one row per
                  supported currency. Empty string on the input → null
                  on the state so the backend auto-syncs. */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] text-muted-foreground px-1">
                  <span>Currency</span>
                  <span>Monthly Price ID</span>
                  <span>Yearly Price ID</span>
                </div>
                {currencies.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic">
                    Loading supported currencies…
                  </div>
                ) : (
                  currencies.map((code) => (
                    <div key={code} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                      <Badge variant="outline" className="font-mono text-[10px] justify-center h-9">
                        {code}
                      </Badge>
                      <Input
                        value={stripePriceIdsByCurrency[code]?.monthly ?? ''}
                        onChange={(e) =>
                          setStripePriceIdsByCurrency((s) => ({
                            ...s,
                            [code]: {
                              monthly: e.target.value.trim() === '' ? null : e.target.value,
                              yearly: s[code]?.yearly ?? null,
                            },
                          }))
                        }
                        className="h-9 font-mono text-xs"
                        placeholder="price_… (auto-filled after sync)"
                      />
                      <Input
                        value={stripePriceIdsByCurrency[code]?.yearly ?? ''}
                        onChange={(e) =>
                          setStripePriceIdsByCurrency((s) => ({
                            ...s,
                            [code]: {
                              monthly: s[code]?.monthly ?? null,
                              yearly: e.target.value.trim() === '' ? null : e.target.value,
                            },
                          }))
                        }
                        className="h-9 font-mono text-xs"
                        placeholder="price_… (auto-filled after sync)"
                      />
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* -------------------- Feature Access -------------------- */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">Feature Access</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Server-side enforced. Disabled features return 403 to clients.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                {entitlements.length} / {ENTITLEMENT_KEYS.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ENTITLEMENT_KEYS.map((key) => {
                const on = entitlements.includes(key);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setEntitlements((cur) =>
                          on ? cur.filter((k) => k !== key) : [...cur, key],
                        )
                      }
                    />
                    <span className="text-xs font-medium">{ENTITLEMENT_LABELS[key]}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <Separator />

          {/* -------------------- Usage Limits -------------------- */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Usage Limits</h4>
              <span className="text-[10px] text-muted-foreground">
                Use <code className="font-mono px-1 py-0.5 rounded bg-muted">-1</code> for unlimited
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LIMIT_KEYS.map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{LIMIT_LABELS[k]}</Label>
                  <Input
                    type="number"
                    value={String(limits[k])}
                    onChange={(e) =>
                      setLimits((cur) => ({ ...cur, [k]: Number(e.target.value) }))
                    }
                    className="h-9"
                  />
                  {limits[k] === UNLIMITED && (
                    <p className="text-[10px] text-emerald-600 font-medium">Unlimited</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            disabled={saveMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(buildPatch())}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Create Plan Dialog --------------------

const EMPTY_LIMITS: PlanLimits = {
  maxSites: 0,
  storageBytes: 0,
};

/** Derive a planId from a name: lowercase, hyphenated, ASCII-only.
 *  "Enterprise Pro" → "enterprise-pro". Used as a sensible default
 *  the owner can override. */
function derivePlanId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function CreatePlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [planId, setPlanId] = useState('');
  const [planIdTouched, setPlanIdTouched] = useState(false);
  // MULTI-CURRENCY: pricesByCurrency is the AUTHORITATIVE price map
  // (one entry per supported currency, each with monthly + yearly).
  // Starts empty — populated by the user. The legacy
  // priceMonthly/priceYearly/currency snapshot fields are derived from
  // pricesByCurrency[defaultCurrency] by the backend on create.
  const [pricesByCurrency, setPricesByCurrency] = useState<PricesByCurrency>({});
  const [stripePriceIdsByCurrency, setStripePriceIdsByCurrency] =
    useState<StripePriceIdsByCurrency>({});
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [active, setActive] = useState(true);
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [limits, setLimits] = useState<PlanLimits>(EMPTY_LIMITS);
  const [stripeOpen, setStripeOpen] = useState(false);
  // Free-trial duration (only used when ALL prices are 0).
  const [freePlanDurationDays, setFreePlanDurationDays] = useState('');

  // Fetch the platform's SUPPORTED currencies (active CountryPricing
  // rows). The default currency (isDefault: true) is moved to the
  // front so it shows as the first row in the price + Stripe Price ID
  // matrices. Also gives us the default currency for the read-only
  // display in Basic Information (replaces the legacy
  // 'platform-default-currency' query).
  const currenciesQuery = useQuery<string[]>({
    queryKey: ['platform-currencies'],
    queryFn: async () => {
      const res = await fetch('/api/platform/admin/countries', { credentials: 'include' });
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json.data ?? []);
      const list = (rows as { currency?: string; isDefault?: boolean }[])
        .filter((r) => r && typeof r === 'object' && r.currency);
      const def = list.find((r) => r.isDefault);
      const set = new Set<string>();
      if (def?.currency) set.add(String(def.currency).toUpperCase());
      for (const r of list) {
        if (r.currency) set.add(String(r.currency).toUpperCase());
      }
      return Array.from(set);
    },
    staleTime: 5 * 60 * 1000,
  });
  const currencies = currenciesQuery.data ?? [];
  // The platform default currency (first element of the currencies
  // list — the query puts the isDefault row at the front). Fallback
  // 'CHF' when the list is still loading or no countries configured.
  const currency = currencies[0] ?? 'CHF';

  // Existing plan IDs — for live uniqueness validation.
  const existingPlansQuery = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => getApi<PlanConfigData[]>('/api/platform/admin/plans'),
  });
  const existingPlanIds = (existingPlansQuery.data ?? []).map((p) => p.planId);

  // EditPlanDialog is conditionally rendered by the parent, so its
  // useState initializers run on each mount. CreatePlanDialog is
  // also conditionally rendered (mounted only when open === true),
  // so we get the same fresh-state-on-open behavior for free.

  // Auto-derive planId from name unless the owner has manually edited it.
  const effectivePlanId = planIdTouched ? planId : derivePlanId(name);
  const planIdTaken = effectivePlanId.length > 0 && existingPlanIds.includes(effectivePlanId);

  // A plan is free when ALL configured currencies have monthly + yearly
  // prices of 0. An empty pricesByCurrency map is also "free" (vacuously).
  const isFreeDerived = Object.values(pricesByCurrency).every(
    (p) => p.monthly === 0 && p.yearly === 0,
  );

  const createMutation = useMutation({
    mutationFn: () => {
      return postApi<PlanConfigData>('/api/platform/admin/plans', {
        planId: effectivePlanId,
        name,
        // No priceMonthly/priceYearly/currency — the backend derives
        // them from pricesByCurrency[defaultCurrency] on create.
        pricesByCurrency,
        // No stripePriceIdMonthly/Yearly — they live in
        // stripePriceIdsByCurrency now.
        stripePriceIdsByCurrency,
        interval,
        isFree: isFreeDerived,
        freePlanDurationDays: isFreeDerived && freePlanDurationDays.trim() !== '' ? Number(freePlanDurationDays) || null : null,
        active,
        // features intentionally omitted — the backend derives the
        // marketing copy from entitlements on the client side now.
        entitlements,
        limits: { ...limits, storageBytes: Number(limits.storageBytes) || 0 },
        badgeVariant: effectivePlanId,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
      queryClient.invalidateQueries({ queryKey: ['platform-billing-me'] });
      queryClient.invalidateQueries({ queryKey: ['platform-overview'] });
      toast.success(`${data.name} created — now visible to clients on the Client Billing page.`);
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const e = err as { error?: { message?: string }; message?: string };
      toast.error(
        e?.error?.message ?? e?.message ?? 'Unable to create plan. You may need OWNER access.',
      );
    },
  });

  const canCreate =
    name.trim().length > 0 &&
    effectivePlanId.length > 0 &&
    !planIdTaken &&
    !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Create Plan</DialogTitle>
          <DialogDescription className="text-xs">
            Add a new subscription plan. It becomes part of the same shared plan configuration —
            visible to clients on the Client Billing page and enforced server-side via
            hasFeature / checkLimit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* -------------------- Basic Information -------------------- */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Basic Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Plan Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9"
                  placeholder="Enterprise"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default Currency</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3">
                  <span className="text-sm font-medium tabular-nums">{currency}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">platform</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Auto-resolved from the platform default country. Edit countries in Pricing.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Plan ID</Label>
                <Input
                  value={effectivePlanId}
                  onChange={(e) => {
                    setPlanId(e.target.value);
                    setPlanIdTouched(true);
                  }}
                  className={`h-9 font-mono text-xs ${planIdTaken ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  placeholder="auto-derived from name"
                />
                {planIdTaken ? (
                  <p className="text-[10px] text-red-600 font-medium">
                    Plan ID &quot;{effectivePlanId}&quot; is already taken. Choose a unique ID.
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Lowercase, hyphenated. Used as the unique key in the shared plan cache.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Billing Interval</Label>
                <Select
                  value={interval}
                  onValueChange={(v) => setInterval(v as 'monthly' | 'yearly')}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">monthly</SelectItem>
                    <SelectItem value="yearly">yearly</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-between rounded-md border px-3 h-9 mt-1">
                  <Label
                    htmlFor="create-active"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    Active
                  </Label>
                  <Switch
                    id="create-active"
                    checked={active}
                    onCheckedChange={setActive}
                  />
                </div>
              </div>
            </div>

            {/* MULTI-CURRENCY PRICE MATRIX — one row per supported
                currency. Any currency not yet in the state defaults to
                {0, 0} (free); the entry is added to the state on the
                first onChange. The default currency's row mirrors the
                legacy priceMonthly/priceYearly snapshot — derived by the
                backend on create. */}
            <div className="space-y-2">
              <Label className="text-xs">Prices by Currency</Label>
              <div className="space-y-1.5">
                <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] text-muted-foreground px-1">
                  <span>Currency</span>
                  <span>Monthly</span>
                  <span>Yearly</span>
                </div>
                {currencies.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic">
                    Loading supported currencies…
                  </div>
                ) : (
                  currencies.map((code) => (
                    <div key={code} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                      <Badge variant="outline" className="font-mono text-[10px] justify-center h-9">
                        {code}
                      </Badge>
                      <Input
                        type="number"
                        value={pricesByCurrency[code]?.monthly ?? 0}
                        onChange={(e) =>
                          setPricesByCurrency((s) => ({
                            ...s,
                            [code]: {
                              monthly: Number(e.target.value) || 0,
                              yearly: s[code]?.yearly ?? 0,
                            },
                          }))
                        }
                        className="h-9"
                      />
                      <Input
                        type="number"
                        value={pricesByCurrency[code]?.yearly ?? 0}
                        onChange={(e) =>
                          setPricesByCurrency((s) => ({
                            ...s,
                            [code]: {
                              monthly: s[code]?.monthly ?? 0,
                              yearly: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="h-9"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Free plan trial duration — shown only when ALL prices
                are 0 (i.e. this is a free plan). Empty = unlimited. */}
            {isFreeDerived && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Free Access Duration (days)</Label>
                  <Input
                    type="number"
                    value={freePlanDurationDays}
                    onChange={(e) => setFreePlanDurationDays(e.target.value)}
                    className="h-9"
                    placeholder="empty = unlimited"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Server-side enforced: when set, the user&apos;s free trial expires N days
                    after activation. Empty = unlimited free access.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* -------------------- Stripe Billing (optional) -------------------- */}
          <Collapsible open={stripeOpen} onOpenChange={setStripeOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full rounded-md hover:bg-accent/30 px-2 py-1.5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Stripe Billing</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    optional
                  </Badge>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    stripeOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* MULTI-CURRENCY STRIPE PRICE ID GRID — one row per
                  supported currency. Empty string on input → null on
                  state so the backend auto-syncs. Leave empty to let
                  the backend auto-create the Stripe Prices on Save. */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] text-muted-foreground px-1">
                  <span>Currency</span>
                  <span>Monthly Price ID</span>
                  <span>Yearly Price ID</span>
                </div>
                {currencies.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic">
                    Loading supported currencies…
                  </div>
                ) : (
                  currencies.map((code) => (
                    <div key={code} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                      <Badge variant="outline" className="font-mono text-[10px] justify-center h-9">
                        {code}
                      </Badge>
                      <Input
                        value={stripePriceIdsByCurrency[code]?.monthly ?? ''}
                        onChange={(e) =>
                          setStripePriceIdsByCurrency((s) => ({
                            ...s,
                            [code]: {
                              monthly: e.target.value.trim() === '' ? null : e.target.value,
                              yearly: s[code]?.yearly ?? null,
                            },
                          }))
                        }
                        className="h-9 font-mono text-xs"
                        placeholder="price_… (auto-created on Save)"
                      />
                      <Input
                        value={stripePriceIdsByCurrency[code]?.yearly ?? ''}
                        onChange={(e) =>
                          setStripePriceIdsByCurrency((s) => ({
                            ...s,
                            [code]: {
                              monthly: s[code]?.monthly ?? null,
                              yearly: e.target.value.trim() === '' ? null : e.target.value,
                            },
                          }))
                        }
                        className="h-9 font-mono text-xs"
                        placeholder="price_… (auto-created on Save)"
                      />
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* -------------------- Feature Access -------------------- */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">Feature Access</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Server-side enforced. Disabled features return 403 to clients.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                {entitlements.length} / {ENTITLEMENT_KEYS.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ENTITLEMENT_KEYS.map((key) => {
                const on = entitlements.includes(key);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setEntitlements((cur) =>
                          on ? cur.filter((k) => k !== key) : [...cur, key],
                        )
                      }
                    />
                    <span className="text-xs font-medium">{ENTITLEMENT_LABELS[key]}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <Separator />

          {/* -------------------- Usage Limits -------------------- */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Usage Limits</h4>
              <span className="text-[10px] text-muted-foreground">
                Use <code className="font-mono px-1 py-0.5 rounded bg-muted">-1</code> for unlimited
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LIMIT_KEYS.map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{LIMIT_LABELS[k]}</Label>
                  <Input
                    type="number"
                    value={String(limits[k])}
                    onChange={(e) =>
                      setLimits((cur) => ({ ...cur, [k]: Number(e.target.value) }))
                    }
                    className="h-9"
                  />
                  {limits[k] === UNLIMITED && (
                    <p className="text-[10px] text-emerald-600 font-medium">Unlimited</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!canCreate}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Main module --------------------

export function PlatformPlansModule() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';
  const [showCreate, setShowCreate] = useState(false);
  // Billing interval selector — drives the price displayed on every plan
  // card. Monthly is the default. Switching to Yearly shows the yearly
  // price + a small monthly-equivalent.
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');


  const plansQuery = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => getApi<PlanConfigData[]>('/api/platform/admin/plans'),
  });

  const summary = useMemo(() => {
    const plans = plansQuery.data ?? [];
    return {
      total: plans.length,
      paid: plans.filter((p) => !p.isFree).length,
      free: plans.filter((p) => p.isFree).length,
    };
  }, [plansQuery.data]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Premium header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Plans &amp; Pricing
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-[15px]">
            Manage plans, pricing, features and usage limits. Changes are shared with the
            Client Billing page.
          </p>
        </div>
        {isOwner ? (
          <Button
            onClick={() => setShowCreate(true)}
            className="h-10 shrink-0 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        ) : null}
      </div>

      {/* Billing interval selector — Monthly / Yearly */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center rounded-full border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setBillingInterval('monthly')}
            className={`h-8 rounded-full px-5 text-sm font-medium transition-colors ${
              billingInterval === 'monthly'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval('yearly')}
            className={`h-8 rounded-full px-5 text-sm font-medium transition-colors ${
              billingInterval === 'yearly'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {!isOwner && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-950/40">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-300">View-only</p>
            <p className="text-muted-foreground">
              Editing plan pricing, entitlements and limits is restricted to the OWNER role.
            </p>
          </div>
        </div>
      )}

      {/* Premium plan summary */}
      <div className="flex flex-wrap items-center gap-3">
        <PlanSummaryTile label="Plans" value={summary.total} />
        <PlanSummaryTile label="Paid Plans" value={summary.paid} />
        <PlanSummaryTile label="Free Plan" value={summary.free} />
      </div>

      {plansQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex h-[420px] flex-col rounded-3xl border bg-card p-8"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-8 h-12 w-32" />
              <Skeleton className="mt-8 h-px w-full" />
              <div className="mt-6 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
              <Skeleton className="mt-auto h-10 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : plansQuery.isError || !plansQuery.data ? (
        <div className="rounded-3xl border bg-card p-4">
          <ErrorState
            message="Unable to load plan configuration."
            onRetry={() => plansQuery.refetch()}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plansQuery.data.map((plan) => (
            <PlanSummaryCard key={plan.planId} plan={plan} canEdit={isOwner} billingInterval={billingInterval} />
          ))}
        </div>
      )}

      {showCreate && <CreatePlanDialog open={showCreate} onOpenChange={setShowCreate} />}
    </div>
  );
}
