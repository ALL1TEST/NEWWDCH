'use client';

// ============================================================
// PLATFORM PLANS & PRICING — simplified admin UI.
// ============================================================
// Owner sees compact plan cards (Free / Plus / Pro / Max …) with a
// quick Active toggle, a compact price + features + limits summary,
// and an "Edit Plan" button. The Edit Plan modal has ONE base price
// configuration per plan — NO per-currency matrix:
//
//   Basic Information: Name · Default/Fallback Currency (country/
//   currency selector: 🇺🇸 United States — USD — $) · Auto Currency
//   toggle · Monthly/Yearly Price (only for enabled periods) · Billing
//   Periods checkboxes · Active
//   then: Stripe Billing (sync + status) · Feature Access · Usage
//   Limits.
//
// AUTO CURRENCY: each plan carries an autoCurrency flag. When ON,
// the customer's currency is resolved SERVER-SIDE from their IP
// (country → currency → plan price for that currency → fallback to
// the plan default when unsupported) — the admin never picks the
// customer's currency. When OFF, every customer is billed in the
// plan's default currency. Per-currency prices (e.g. 90 MAD) come
// from the PLATFORM-level regional config (CountryPricing), not
// from this modal.
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
  PLAN_EDITOR_FEATURE_KEYS,
  ENTITLEMENT_LABELS,
  ENTITLEMENT_DESCRIPTIONS,
  AI_MODE_PLATFORM,
  AI_MODE_CLIENT,
  CORE_LIMIT_KEYS,
  AI_LIMIT_KEYS,
  LIMIT_LABELS,
  UNLIMITED,
  aiModeOfEntitlements,
  type AiMode,
  type EntitlementKey,
} from '@/lib/platform/feature-config';
import type {
  PlanConfigData,
  PlanLimits,
  StripePriceIdsByCurrency,
} from '@/lib/platform/plan-config';
import {
  SELECTABLE_CURRENCIES,
  formatMoney,
  type SelectableCurrency,
} from '@/lib/platform/currency-catalog';
import { useAuthStore } from '@/lib/stores/auth-store';

type PlanPatch = Partial<PlanConfigData>;

// -------------------- Flag + currency option rendering --------------------

/** REAL flag image (self-hosted /flags/{countryCode}.svg). Emoji
 *  flags are NOT used — they render as plain country-code text
 *  ("GB", "US", "MA") on Windows, which reads as a code prefix in
 *  the "[Flag] Country Name — CODE — Symbol" selector row. */
function FlagImg({
  countryCode,
  className = 'h-3.5 w-5 shrink-0 rounded-[2px] object-cover',
}: {
  countryCode: string;
  className?: string;
}) {
  return (
    <img
      src={`/flags/${countryCode.toLowerCase()}.svg`}
      alt=""
      aria-hidden
      className={className}
      loading="lazy"
    />
  );
}

/** One row of the Default Currency selector:
 *  [flag image] Country Name — Currency Code — Currency Symbol
 *  (e.g. "[🇬🇧] United Kingdom — GBP — £" — no country-code text
 *  before the country name). */
function CurrencyOption({ c }: { c: SelectableCurrency }) {
  return (
    <span className="flex items-center gap-1.5">
      <FlagImg countryCode={c.countryCode} />
      <span>{c.countryName}</span>
      <span className="text-muted-foreground">
        — {c.code} — {c.symbol}
      </span>
    </span>
  );
}

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

// -------------------- Billing-periods shared UI --------------------

/** Billing Periods checkboxes — control which checkout options EXIST
 *  for the plan. The selection drives the client billing page (only
 *  enabled periods are shown), checkout validation (disabled periods
 *  are rejected 400 server-side), and the Stripe sync (disabled
 *  periods never get a Stripe Price). At least one must stay on. */
function BillingPeriodsCheckboxes({
  monthly,
  yearly,
  onMonthlyChange,
  onYearlyChange,
  idPrefix,
}: {
  monthly: boolean;
  yearly: boolean;
  onMonthlyChange: (v: boolean) => void;
  onYearlyChange: (v: boolean) => void;
  idPrefix: string;
}) {
  const valid = monthly || yearly;
  return (
    <div className="space-y-1">
      <Label className="text-xs">Billing Periods</Label>
      <div className="grid grid-cols-2 gap-2">
        <label
          htmlFor={`${idPrefix}-billing-monthly`}
          className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/40 transition-colors"
        >
          <input
            id={`${idPrefix}-billing-monthly`}
            type="checkbox"
            className="h-4 w-4 accent-foreground"
            checked={monthly}
            onChange={(e) => onMonthlyChange(e.target.checked)}
          />
          <span className="text-xs font-medium">Monthly</span>
        </label>
        <label
          htmlFor={`${idPrefix}-billing-yearly`}
          className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/40 transition-colors"
        >
          <input
            id={`${idPrefix}-billing-yearly`}
            type="checkbox"
            className="h-4 w-4 accent-foreground"
            checked={yearly}
            onChange={(e) => onYearlyChange(e.target.checked)}
          />
          <span className="text-xs font-medium">Yearly</span>
        </label>
      </div>
      {!valid && (
        <p className="text-[10px] text-red-600 font-medium" role="alert">
          At least one billing period (Monthly or Yearly) must be enabled.
        </p>
      )}
    </div>
  );
}

// -------------------- Feature Access / Usage Limits shared UI --------------------

/** Count the editor-visible enabled features (the 8 checkboxes + AI
 *  Tools counting as one when either mode is selected). */
function countEditorFeatures(entitlements: readonly string[]): number {
  const simple = PLAN_EDITOR_FEATURE_KEYS.filter((k) => entitlements.includes(k)).length;
  const ai = aiModeOfEntitlements(entitlements) !== 'none' ? 1 : 0;
  return simple + ai;
}

const EDITOR_FEATURE_TOTAL = PLAN_EDITOR_FEATURE_KEYS.length + 1; // 8 + AI Tools

/** Toggle one simple (checkbox) feature key in the entitlements state. */
function toggleFeature(cur: string[], key: string): string[] {
  return cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
}

/** Select an AI Tools mode (mutually exclusive). Selecting the already
 *  active mode turns AI OFF — the same interaction model as a radio
 *  group with an implicit "none" state. Never leaves both modes on. */
function setAiMode(cur: string[], mode: AiMode): string[] {
  const withoutAi = cur.filter((k) => k !== AI_MODE_PLATFORM && k !== AI_MODE_CLIENT && k !== 'ai_content');
  if (mode === 'platform') return [...withoutAi, AI_MODE_PLATFORM];
  if (mode === 'client') return [...withoutAi, AI_MODE_CLIENT];
  return withoutAi;
}

/** One selectable option row of the AI Tools block — radio-style. */
function AiModeOption({
  selected,
  title,
  description,
  onSelect,
  id,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer transition-colors ${
        selected ? 'border-foreground/30 bg-accent/50' : 'hover:bg-accent/40'
      }`}
    >
      <input
        id={id}
        type="radio"
        name="ai-tools-mode"
        className="mt-0.5 h-4 w-4 accent-foreground"
        checked={selected}
        onChange={onSelect}
        onClick={(e) => {
          // Clicking the selected option again → turn AI OFF (none).
          if (selected) {
            e.preventDefault();
            onSelect();
          }
        }}
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium">{title}</span>
        <span className="block text-[10px] text-muted-foreground mt-0.5">{description}</span>
      </span>
    </label>
  );
}

/** Feature Access section — shared by the Create + Edit Plan dialogs.
 *  8 simple checkbox features + the AI Tools two-mode block
 *  (Platform AI / Client's Own AI API — mutually exclusive; neither
 *  selected = AI disabled). Custom Domains and White Label are not
 *  offered: site identity is client-owned, not a plan entitlement. */
function FeatureAccessSection({
  entitlements,
  onChange,
  idPrefix,
}: {
  entitlements: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  const aiMode = aiModeOfEntitlements(entitlements);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">Feature Access</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Server-side enforced. Disabled features return 403 to clients.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
          {countEditorFeatures(entitlements)} / {EDITOR_FEATURE_TOTAL}
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PLAN_EDITOR_FEATURE_KEYS.map((key) => {
          const on = entitlements.includes(key);
          return (
            <label
              key={key}
              htmlFor={`${idPrefix}-feature-${key}`}
              title={ENTITLEMENT_DESCRIPTIONS[key]}
              className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/40 transition-colors"
            >
              <input
                id={`${idPrefix}-feature-${key}`}
                type="checkbox"
                className="h-4 w-4 accent-foreground"
                checked={on}
                onChange={() => onChange(toggleFeature(entitlements, key))}
              />
              <span className="text-xs font-medium">{ENTITLEMENT_LABELS[key]}</span>
            </label>
          );
        })}
      </div>
      {/* AI Tools — two mutually exclusive modes (NOT a simple boolean). */}
      <div className="space-y-1.5 rounded-md border p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">AI Tools</span>
          <span className="text-[10px] text-muted-foreground">
            {aiMode === 'platform' ? 'Platform AI' : aiMode === 'client' ? "Client's Own AI API" : 'Disabled'}
          </span>
        </div>
        <AiModeOption
          id={`${idPrefix}-ai-platform`}
          selected={aiMode === 'platform'}
          title="Platform AI"
          description="Platform provides and pays for the AI API — subject to the AI usage limits below."
          onSelect={() => onChange(setAiMode(entitlements, aiMode === 'platform' ? 'none' : 'platform'))}
        />
        <AiModeOption
          id={`${idPrefix}-ai-client`}
          selected={aiMode === 'client'}
          title="Client's Own AI API"
          description="Client connects and manages their own AI provider — no platform AI usage limits."
          onSelect={() => onChange(setAiMode(entitlements, aiMode === 'client' ? 'none' : 'client'))}
        />
      </div>
    </section>
  );
}

/** Usage Limits section — shared by the Create + Edit Plan dialogs.
 *  Core limits (Max Sites, Storage) always shown. The three Platform AI
 *  usage limits appear ONLY while the plan uses Platform AI — hidden
 *  (and stored as 0) for Client's Own AI API and AI-disabled plans. */
function UsageLimitsSection({
  limits,
  onChange,
  aiMode,
}: {
  limits: PlanLimits;
  onChange: (next: PlanLimits) => void;
  aiMode: AiMode;
}) {
  const showAiLimits = aiMode === 'platform';
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Usage Limits</h4>
        <span className="text-[10px] text-muted-foreground">
          Use <code className="font-mono px-1 py-0.5 rounded bg-muted">-1</code> for unlimited
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CORE_LIMIT_KEYS.map((k) => (
          <div key={k} className="space-y-1">
            <Label className="text-xs">{LIMIT_LABELS[k]}</Label>
            <Input
              type="number"
              value={String(limits[k])}
              onChange={(e) => onChange({ ...limits, [k]: Number(e.target.value) })}
              className="h-9"
            />
            {limits[k] === UNLIMITED && (
              <p className="text-[10px] text-emerald-600 font-medium">Unlimited</p>
            )}
          </div>
        ))}
        {showAiLimits &&
          AI_LIMIT_KEYS.map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{LIMIT_LABELS[k]}</Label>
              <Input
                type="number"
                value={String(limits[k])}
                onChange={(e) => onChange({ ...limits, [k]: Number(e.target.value) })}
                className="h-9"
              />
              {limits[k] === UNLIMITED && (
                <p className="text-[10px] text-emerald-600 font-medium">Unlimited</p>
              )}
            </div>
          ))}
      </div>
    </section>
  );
}

// -------------------- Price formatting --------------------
// formatMoney comes from the shared currency catalog (client-safe):
//   (9, 'USD') → "$9" · (90, 'MAD') → "90 MAD" · (9, 'CHF') → "CHF 9".

/** Format the LARGE primary price on a plan card — integer amounts.
 *  e.g. (90, 'MAD') → "90 MAD"; (0, 'CHF') → "CHF 0". */
function formatPriceSymbol(amount: number, currency: string): string {
  return formatMoney(amount, currency, 0);
}

/** Format with 2 decimals — used for the monthly-equivalent of a
 *  yearly price (yearly 90 → "CHF 7.50"). Always two decimals so the
 *  large primary price reads "$7.50" / "CHF 40.83" / "€82.50". */
function formatPriceSymbolMonthlyEquiv(amount: number, currency: string): string {
  return formatMoney(amount, currency, 2);
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

  // The card shows the price for the plan's ENABLED billing periods:
  //   - both periods   → follows the global Monthly/Yearly selector
  //   - monthly only   → ALWAYS monthly (a disabled period never shows)
  //   - yearly only    → ALWAYS yearly ("$X / year", no monthly option)
  const effectiveInterval: 'monthly' | 'yearly' =
    plan.billingMonthly && plan.billingYearly
      ? billingInterval
      : plan.billingMonthly
        ? 'monthly'
        : 'yearly';

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
          ) : effectiveInterval === 'yearly' && !plan.billingMonthly ? (
            // YEARLY-ONLY plan — there is no monthly option, so the
            // yearly total IS the primary price ("$90 / year"). No
            // monthly-equivalent is shown (that would advertise a
            // monthly option the plan does not offer).
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="shrink-0 whitespace-nowrap text-4xl font-semibold leading-none tracking-tight text-foreground">
                {formatPriceSymbol(plan.priceYearly, plan.currency)}
              </span>
              <span className="whitespace-nowrap text-sm text-muted-foreground">/ year</span>
            </div>
          ) : effectiveInterval === 'yearly' ? (
            // Both periods — INLINE: [LARGE $X.XX] [small / month]
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
  // ONE base price configuration — the plan's default/fallback
  // currency (country/currency selector) + monthly/yearly prices
  // denominated in it. NO per-currency matrix: other currency prices
  // (e.g. 90 MAD) are platform-level regional config, resolved
  // server-side per customer.
  const [currency, setCurrency] = useState((plan.currency ?? 'CHF').toUpperCase());
  const [autoCurrency, setAutoCurrency] = useState(plan.autoCurrency ?? true);
  const [priceMonthly, setPriceMonthly] = useState(String(plan.priceMonthly ?? 0));
  const [priceYearly, setPriceYearly] = useState(String(plan.priceYearly ?? 0));
  // ENABLED BILLING PERIODS — which checkout options exist for the
  // plan (replaces the old single-value Billing Interval dropdown).
  const [billingMonthly, setBillingMonthly] = useState(plan.billingMonthly ?? true);
  const [billingYearly, setBillingYearly] = useState(plan.billingYearly ?? true);
  const [active, setActive] = useState(plan.active);
  const [entitlements, setEntitlements] = useState<string[]>(plan.entitlements);
  const [limits, setLimits] = useState<PlanLimits>(plan.limits);
  // Free-trial duration (only used when the base price is 0).
  const [freePlanDurationDays, setFreePlanDurationDays] = useState<string>(
    plan.freePlanDurationDays == null ? '' : String(plan.freePlanDurationDays),
  );
  const [stripeOpen, setStripeOpen] = useState(false);
  // Stripe Price IDs per currency — maintained by the Sync to Stripe
  // button (never hand-edited; shown as compact wired-currency badges).
  const [wiredMap, setWiredMap] = useState<StripePriceIdsByCurrency>(
    plan.stripePriceIdsByCurrency ?? {},
  );

  // The EditPlanDialog is conditionally rendered by the parent (mounted
  // fresh each time the user opens it), so the useState initializers
  // above already seed local state from the latest server snapshot.
  // No useEffect sync is needed — that would just trigger cascading
  // renders (and the React Compiler correctly flags it).

  const monthlyNum = Number(priceMonthly) || 0;
  const yearlyNum = Number(priceYearly) || 0;
  // At least one billing period must stay enabled (2D: neither
  // checked → cannot save — validated here AND server-side).
  const periodsValid = billingMonthly || billingYearly;

  const reset = () => {
    setName(plan.name);
    setCurrency((plan.currency ?? 'CHF').toUpperCase());
    setAutoCurrency(plan.autoCurrency ?? true);
    setPriceMonthly(String(plan.priceMonthly ?? 0));
    setPriceYearly(String(plan.priceYearly ?? 0));
    setBillingMonthly(plan.billingMonthly ?? true);
    setBillingYearly(plan.billingYearly ?? true);
    setActive(plan.active);
    setEntitlements(plan.entitlements);
    setLimits(plan.limits);
    setFreePlanDurationDays(plan.freePlanDurationDays == null ? '' : String(plan.freePlanDurationDays));
    setWiredMap(plan.stripePriceIdsByCurrency ?? {});
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
      // state so the admin can see them without re-opening the dialog.
      setWiredMap(data.stripePriceIdsByCurrency);
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

  // A plan is free when the price is 0 for every ENABLED period
  // (a disabled period's stored price is never charged).
  const isFreeDerived =
    (!billingMonthly || monthlyNum === 0) && (!billingYearly || yearlyNum === 0);

  const buildPatch = (): PlanPatch => {
    return {
      name,
      // The ONE base price configuration — the backend derives the
      // default currency's pricesByCurrency entry from these and
      // preserves the platform's other-currency regional prices.
      currency,
      autoCurrency,
      priceMonthly: monthlyNum,
      priceYearly: yearlyNum,
      // Enabled billing periods — the backend derives the default
      // cadence from them (single-period plans are pinned to their
      // only period). NO interval field: the old Billing Interval
      // dropdown logic is gone.
      billingMonthly,
      billingYearly,
      isFree: isFreeDerived,
      freePlanDurationDays: isFreeDerived ? (freePlanDurationDays.trim() === '' ? null : Number(freePlanDurationDays) || null) : null,
      // No pricesByCurrency / stripePriceIdsByCurrency in the patch:
      // per-currency prices are platform-level config and Stripe Price
      // IDs are managed by the sync (both preserved on save).
      active,
      // features intentionally omitted — the backend derives the
      // marketing copy from entitlements on the client side now.
      // savePlanConfig preserves the existing value when omitted.
      entitlements,
      // AI usage limits are part of the saved configuration ONLY while
      // the plan uses Platform AI (the backend zeroes them otherwise).
      limits: buildPayloadLimits(limits, aiModeOfEntitlements(entitlements)),
    };
  };

  // Currencies with a wired Stripe Price (from sync) — shown as badges.
  const wiredCurrencies = Object.entries(wiredMap)
    .filter(([, v]) => v.monthly || v.yearly)
    .map(([code]) => code);

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
          {/* -------------------- Basic Information --------------------
              ONE base price configuration: Name · Default/Fallback
              Currency (country/currency selector) · Monthly/Yearly
              Price (ONLY for enabled periods) · Billing Periods
              checkboxes · Auto Currency · Active. NO per-currency
              matrix — customers see their detected currency's price
              server-side, with this currency as the fallback. */}
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
                <Label className="text-xs">Default / Fallback Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-9" aria-label="Default currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {SELECTABLE_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <CurrencyOption c={c} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price inputs — one per ENABLED billing period. A
                disabled period shows NO price input (its stored value
                is preserved server-side for when it is re-enabled). */}
            {(billingMonthly || billingYearly) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {billingMonthly && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Monthly Price</Label>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {currency}
                      </Badge>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={priceMonthly}
                      onChange={(e) => setPriceMonthly(e.target.value)}
                      className="h-9"
                    />
                  </div>
                )}
                {billingYearly && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Yearly Price</Label>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {currency}
                      </Badge>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={priceYearly}
                      onChange={(e) => setPriceYearly(e.target.value)}
                      className="h-9"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Billing Periods — which checkout options EXIST for the
                plan (monthly-only / yearly-only / both). */}
            <BillingPeriodsCheckboxes
              monthly={billingMonthly}
              yearly={billingYearly}
              onMonthlyChange={setBillingMonthly}
              onYearlyChange={setBillingYearly}
              idPrefix={`edit-${plan.planId}`}
            />

            {/* Auto Currency — the customer's currency is detected from
                their location and used when a price exists for it. The
                admin never picks the customer's currency; this toggle
                only enables/disables the automatic detection. */}
            <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label
                  htmlFor={`auto-currency-${plan.planId}`}
                  className="cursor-pointer text-xs font-medium"
                >
                  Auto Currency
                </Label>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Customer currency is detected from their location (IP) and used when a price
                  exists for it. Otherwise this plan&apos;s default currency applies.
                </p>
              </div>
              <Switch
                id={`auto-currency-${plan.planId}`}
                checked={autoCurrency}
                onCheckedChange={setAutoCurrency}
                className="mt-0.5 shrink-0"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 h-9">
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

            {/* Free plan trial duration — shown only when the base
                price is 0 (i.e. this is a free plan). Empty = unlimited. */}
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

          {/* -------------------- Stripe Billing -------------------- */}
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
              {/* Compact sync row — button on the left, status on the
                  right. Syncing creates one real Stripe Price per
                  (currency, interval) pair; the IDs are maintained by
                  the backend (never hand-edited here). */}
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
                  {wiredCurrencies.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Wired — {wiredCurrencies.length} currency{wiredCurrencies.length > 1 ? 'ies' : ''}:
                    </span>
                  ) : (
                    <span>Not yet wired. Click the button to create Stripe Prices.</span>
                  )}
                </div>
              </div>
              {/* Wired currencies — compact badges (one per currency
                  with a Stripe Price). Checkout resolves the price for
                  the customer's detected currency from these. */}
              {wiredCurrencies.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  {wiredCurrencies.map((code) => (
                    <Badge
                      key={code}
                      variant="outline"
                      className="gap-1 font-mono text-[10px]"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {code}
                    </Badge>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* -------------------- Feature Access --------------------
              9 simple checkbox features + the AI Tools two-mode block
              (Platform AI / Client's Own AI API — mutually exclusive). */}
          <FeatureAccessSection
            entitlements={entitlements}
            onChange={setEntitlements}
            idPrefix={`edit-${plan.planId}`}
          />

          <Separator />

          {/* -------------------- Usage Limits --------------------
              Core limits always; the Platform AI usage limits appear
              ONLY while Platform AI is selected. */}
          <UsageLimitsSection
            limits={limits}
            onChange={setLimits}
            aiMode={aiModeOfEntitlements(entitlements)}
          />
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
            disabled={saveMutation.isPending || !periodsValid}
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

/** Normalize the limit state into the API payload. The AI usage limits
 *  are part of the saved configuration ONLY while the plan uses
 *  Platform AI — Client's Own AI API and AI-disabled plans store 0
 *  (the backend enforces the same rule). */
function buildPayloadLimits(limits: PlanLimits, aiMode: AiMode): PlanLimits {
  return {
    maxSites: Number(limits.maxSites) || 0,
    storageBytes: Number(limits.storageBytes) || 0,
    ...(aiMode === 'platform'
      ? {
          aiArticlesPerMonth: Number(limits.aiArticlesPerMonth) || 0,
          aiWordsPerMonth: Number(limits.aiWordsPerMonth) || 0,
          aiImagesPerMonth: Number(limits.aiImagesPerMonth) || 0,
        }
      : { aiArticlesPerMonth: 0, aiWordsPerMonth: 0, aiImagesPerMonth: 0 }),
  };
}

const EMPTY_LIMITS: PlanLimits = {
  maxSites: 0,
  storageBytes: 0,
  aiArticlesPerMonth: 0,
  aiWordsPerMonth: 0,
  aiImagesPerMonth: 0,
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
  // ONE base price configuration — default/fallback currency (selector,
  // initialized from the platform default country) + monthly/yearly
  // prices. NO per-currency matrix.
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [pickedCurrency, setPickedCurrency] = useState<string | null>(null);
  const [autoCurrency, setAutoCurrency] = useState(true);
  const [priceMonthly, setPriceMonthly] = useState('0');
  const [priceYearly, setPriceYearly] = useState('0');
  // ENABLED BILLING PERIODS — same logic as the Edit Plan modal
  // (which checkout options exist for the new plan).
  const [billingMonthly, setBillingMonthly] = useState(true);
  const [billingYearly, setBillingYearly] = useState(true);
  const [active, setActive] = useState(true);
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [limits, setLimits] = useState<PlanLimits>(EMPTY_LIMITS);
  const [stripeOpen, setStripeOpen] = useState(false);
  // Free-trial duration (only used when the base price is 0).
  const [freePlanDurationDays, setFreePlanDurationDays] = useState('');

  // The platform's default currency (from the default CountryPricing
  // row) — the INITIAL selection in the Default Currency selector
  // until the admin picks another one.
  const defaultCurrencyQuery = useQuery<string>({
    queryKey: ['platform-default-currency'],
    queryFn: async () => {
      const res = await fetch('/api/platform/admin/countries', { credentials: 'include' });
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json.data ?? []);
      const def = (rows as { currency?: string; isDefault?: boolean; active?: boolean }[]).find(
        (r) => r && typeof r === 'object' && r.isDefault && r.currency,
      );
      return String(def?.currency ?? 'CHF').toUpperCase();
    },
    staleTime: 5 * 60 * 1000,
  });
  const currency = currencyTouched ? (pickedCurrency as string) : (defaultCurrencyQuery.data ?? 'CHF');

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

  const monthlyNum = Number(priceMonthly) || 0;
  const yearlyNum = Number(priceYearly) || 0;
  // At least one billing period must be enabled (2D) — same rule as
  // the Edit Plan modal and the backend validation.
  const periodsValid = billingMonthly || billingYearly;
  // A plan is free when the price is 0 for every ENABLED period.
  const isFreeDerived =
    (!billingMonthly || monthlyNum === 0) && (!billingYearly || yearlyNum === 0);

  const createMutation = useMutation({
    mutationFn: () => {
      return postApi<PlanConfigData>('/api/platform/admin/plans', {
        planId: effectivePlanId,
        name,
        // The ONE base price configuration — the backend derives the
        // default currency's pricesByCurrency entry from these.
        currency,
        autoCurrency,
        priceMonthly: monthlyNum,
        priceYearly: yearlyNum,
        // Enabled billing periods — the backend derives the default
        // cadence from them (no interval field).
        billingMonthly,
        billingYearly,
        isFree: isFreeDerived,
        freePlanDurationDays: isFreeDerived && freePlanDurationDays.trim() !== '' ? Number(freePlanDurationDays) || null : null,
        active,
        // features intentionally omitted — the backend derives the
        // marketing copy from entitlements on the client side now.
        entitlements,
        // AI usage limits are part of the saved configuration ONLY while
        // the plan uses Platform AI (the backend zeroes them otherwise).
        limits: buildPayloadLimits(limits, aiModeOfEntitlements(entitlements)),
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
    periodsValid &&
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
          {/* -------------------- Basic Information --------------------
              ONE base price configuration — same shape as the Edit
              Plan modal: Name · Plan ID · Default/Fallback Currency ·
              Monthly/Yearly Price (only for enabled periods) · Billing
              Periods checkboxes · Auto Currency · Active. NO
              per-currency matrix. */}
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Default / Fallback Currency</Label>
                <Select
                  value={currency}
                  onValueChange={(v) => {
                    setPickedCurrency(v);
                    setCurrencyTouched(true);
                  }}
                >
                  <SelectTrigger className="h-9" aria-label="Default currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {SELECTABLE_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <CurrencyOption c={c} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 h-9 self-end">
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

            {/* Price inputs — one per ENABLED billing period. A
                disabled period shows NO price input. */}
            {(billingMonthly || billingYearly) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {billingMonthly && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Monthly Price</Label>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {currency}
                      </Badge>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={priceMonthly}
                      onChange={(e) => setPriceMonthly(e.target.value)}
                      className="h-9"
                    />
                  </div>
                )}
                {billingYearly && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Yearly Price</Label>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {currency}
                      </Badge>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={priceYearly}
                      onChange={(e) => setPriceYearly(e.target.value)}
                      className="h-9"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Billing Periods — which checkout options EXIST for the
                new plan (same logic as the Edit Plan modal). */}
            <BillingPeriodsCheckboxes
              monthly={billingMonthly}
              yearly={billingYearly}
              onMonthlyChange={setBillingMonthly}
              onYearlyChange={setBillingYearly}
              idPrefix="create"
            />

            {/* Auto Currency — same setting as the Edit Plan modal. */}
            <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label
                  htmlFor="create-auto-currency"
                  className="cursor-pointer text-xs font-medium"
                >
                  Auto Currency
                </Label>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Customer currency is detected from their location (IP) and used when a price
                  exists for it. Otherwise this plan&apos;s default currency applies.
                </p>
              </div>
              <Switch
                id="create-auto-currency"
                checked={autoCurrency}
                onCheckedChange={setAutoCurrency}
                className="mt-0.5 shrink-0"
              />
            </div>

            {/* Free plan trial duration — shown only when the base
                price is 0 (i.e. this is a free plan). Empty = unlimited. */}
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

          {/* -------------------- Stripe Billing -------------------- */}
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
            <CollapsibleContent className="pt-2">
              <p className="text-[11px] text-muted-foreground px-1">
                Stripe Prices are created automatically when the plan is saved (Stripe connected)
                — one real Price per (currency, interval) pair. Use “Sync to Stripe” in the Edit
                Plan dialog afterwards to refresh or surface errors.
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* -------------------- Feature Access --------------------
              9 simple checkbox features + the AI Tools two-mode block
              (Platform AI / Client's Own AI API — mutually exclusive). */}
          <FeatureAccessSection
            entitlements={entitlements}
            onChange={setEntitlements}
            idPrefix="create"
          />

          <Separator />

          {/* -------------------- Usage Limits --------------------
              Core limits always; the Platform AI usage limits appear
              ONLY while Platform AI is selected. */}
          <UsageLimitsSection
            limits={limits}
            onChange={setLimits}
            aiMode={aiModeOfEntitlements(entitlements)}
          />
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
