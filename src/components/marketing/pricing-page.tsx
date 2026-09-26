'use client';

// ============================================================
// PRICING PAGE — plans from the REAL product configuration
// ============================================================
// Fetches /api/plans (active PlanConfig rows from the platform
// database) — prices, limits, currency AND the public feature
// flags are NEVER hardcoded. Structure (ClickUp-inspired UX,
// fully Karmax-branded):
//
//   Hero — “The best work solution, for the best price.”
//     ↓
//   Monthly / Yearly toggle
//     ↓
//   Pricing cards (real plans; Pro recommended)
//     ↓
//   “Complete feature list” → expandable comparison table
//     ↓
//   CTA — “Publish your next site with us.”
//     ↓
//   FAQ accordion + “Load more” + “Contact us”
//
// Comparison-table semantics (all from the API):
//   • limits (-1 = unlimited) render as real values
//   • entitlement booleans render ✓ / —
//   • AI: 'platform' shows the metered monthly allowance,
//     'client' = bring-your-own provider keys (never metered),
//     'none' = AI not included
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Minus, RefreshCw } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/lib/stores/auth-store';
import { savePlanSelection } from '@/lib/checkout/plan-selection';
import { Logo, MarketingButton, Reveal } from './primitives';
import { MKT } from './marketing-header';

interface PublicPlanFeatures {
  ai: 'none' | 'platform' | 'client';
  newsletter: boolean;
  comments: boolean;
  automation: boolean;
  backups: boolean;
  emailTemplates: boolean;
  advancedAnalytics: boolean;
  advancedSeo: boolean;
  auditLog: boolean;
}

interface PublicPlan {
  planId: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  isFree: boolean;
  badgeVariant: string;
  sortOrder: number;
  limits: {
    maxSites: number;
    storageBytes: number;
    aiArticlesPerMonth: number;
    aiImagesPerMonth: number;
  };
  features: PublicPlanFeatures;
}

interface PlansResponse {
  currency: string;
  plans: PublicPlan[];
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb >= 10 ? Math.round(gb) : gb} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

function formatLimit(n: number, unlimitedValue: -1): string {
  if (n === unlimitedValue) return '∞';
  return String(n);
}

// Feature rows per plan (rendered with translated labels; values
// come from the plan's configured limits).
function planFeatures(t: (k: string) => string, plan: PublicPlan): Array<{ label: string; value?: string }> {
  const L = plan.limits;
  const unlimited = -1 as const;
  return [
    {
      label: L.maxSites === unlimited ? t('mkt.pricing.sitesUnlimited') : t('mkt.pricing.sitesCount').replace('{count}', String(L.maxSites)),
    },
    { label: `${t('mkt.pricing.storage')} · ${formatBytes(L.storageBytes)}` },
    {
      label:
        L.aiArticlesPerMonth === unlimited
          ? `${t('mkt.pricing.aiArticles')} · ${t('mkt.stats.unlimited')}`
          : `${t('mkt.pricing.aiArticles')} · ${formatLimit(L.aiArticlesPerMonth, unlimited)}`,
    },
    {
      label:
        L.aiImagesPerMonth === unlimited
          ? `${t('mkt.pricing.aiImages')} · ${t('mkt.stats.unlimited')}`
          : `${t('mkt.pricing.aiImages')} · ${formatLimit(L.aiImagesPerMonth, unlimited)}`,
    },
    { label: t('mkt.pricing.editor') },
    { label: t('mkt.pricing.seoBasics') },
    { label: t('mkt.pricing.mediaLibrary') },
    ...(plan.features.newsletter ? [{ label: t('mkt.pricing.newsletter') }] : []),
    ...(plan.features.automation ? [{ label: t('mkt.pricing.automation') }] : []),
    ...(plan.features.backups ? [{ label: t('mkt.pricing.backups') }] : []),
  ];
}

function PricingCard({
  plan,
  currency,
  yearly,
  recommended,
}: {
  plan: PublicPlan;
  currency: string;
  yearly: boolean;
  recommended: boolean;
}) {
  const { t } = useT();
  // Authenticated visitors go STRAIGHT to the payment step for paid
  // plans (never through signup again); unauthenticated visitors
  // create their account first. Free always opens Create Account.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const descKey =
    plan.planId === 'free'
      ? 'mkt.plan.free.desc'
      : plan.planId === 'plus'
        ? 'mkt.plan.plus.desc'
        : plan.planId === 'pro'
          ? 'mkt.plan.pro.desc'
          : plan.planId === 'max'
            ? 'mkt.plan.max.desc'
            : 'mkt.plan.default.desc';
  const description = plan.description?.trim() || t(descKey);

  // Yearly view shows the discounted MONTHLY EQUIVALENT — the
  // configured yearly price ÷ 12 — with the full annual amount
  // underneath. Both derive from the plan configuration; nothing is
  // hardcoded (the backend stays the single source of truth).
  const monthlyEquivalent = Math.round(plan.priceYearly / 12);

  return (
    <div
      className={`mkt-card-hover relative flex h-full flex-col rounded-3xl border bg-card p-7 ${
        recommended
          ? 'border-mkt-accent-border shadow-[0_12px_48px_-16px_var(--mkt-accent)]'
          : 'border-border'
      }`}
    >
      {recommended && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-mkt-accent px-3.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-mkt-accent-fg">
          {t('mkt.pricing.popular')}
        </span>
      )}

      <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
      <p className="mt-2 min-h-10 text-sm leading-relaxed text-text-secondary">{description}</p>

      {/* Price — large display. Monthly: “CHF X / month”. Yearly:
          “CHF X /mo” (monthly equivalent) + “Billed CHF XXX yearly”.
          The reserved min-height keeps CTAs aligned across cards in
          both toggle states. */}
      <div className="mt-6 min-h-[4.5rem]">
        {plan.isFree ? (
          <div className="flex items-baseline">
            <span className="mkt-display text-5xl text-text-primary">{t('mkt.pricing.free')}</span>
          </div>
        ) : yearly ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-medium text-text-muted">{currency}</span>
              <span className="mkt-display text-5xl text-text-primary">{monthlyEquivalent}</span>
              <span className="text-sm text-text-muted">{t('mkt.pricing.perMonthShort')}</span>
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              {t('mkt.pricing.billedYearly').replace('{amount}', `${currency} ${plan.priceYearly}`)}
            </p>
          </>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-medium text-text-muted">{currency}</span>
            <span className="mkt-display text-5xl text-text-primary">{plan.priceMonthly}</span>
            <span className="text-sm text-text-muted">{t('mkt.pricing.perMonth')}</span>
          </div>
        )}
      </div>

      <div className="mt-6">
        {/* Plan CTA — persists the selected plan + billing cycle
            BEFORE the navigation happens (the click handler runs
            synchronously; the anchor then changes the hash). The
            whole conversion journey reads it back: unauthenticated →
            Create Account (paid continues to checkout afterwards,
            free lands on the dashboard); ALREADY AUTHENTICATED + paid
            → checkout directly, never signup again. */}
        <MarketingButton
          href={!plan.isFree && isAuthenticated ? MKT.checkout : MKT.signup}
          variant={recommended ? 'primary' : 'secondary'}
          className="w-full"
          withArrow={!recommended}
          onClick={() => savePlanSelection(plan.planId, yearly ? 'yearly' : 'monthly', plan.isFree)}
        >
          {plan.isFree ? t('mkt.pricing.cta.free') : t('mkt.pricing.cta').replace('{plan}', plan.name)}
        </MarketingButton>
      </div>

      <ul className="mt-7 flex flex-col gap-3 border-t border-border pt-6">
        {planFeatures(t, plan).map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-mkt-accent" aria-hidden="true" />
            <span className="leading-relaxed">{f.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------------------- Comparison table --------------------

// A single comparison cell. `kind` drives the rendering:
//   value → text (limits, allowances)
//   bool  → ✓ (brand accent) or an em-dash (not included)
type Cell =
  | { kind: 'value'; text: string }
  | { kind: 'bool'; on: boolean };

function ComparisonCell({ cell }: { cell: Cell }) {
  if (cell.kind === 'value') {
    return <span className="text-sm font-medium text-text-primary">{cell.text}</span>;
  }
  if (cell.on) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-mkt-accent-soft">
        <Check className="h-3.5 w-3.5 text-mkt-accent" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center">
      <Minus className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
      <span className="sr-only">Not included</span>
    </span>
  );
}

interface ComparisonRow {
  labelKey: string;
  cells: Cell[];
}

interface ComparisonSection {
  titleKey: string;
  rows: ComparisonRow[];
}

// Build the comparison structure from the LIVE plan data — every
// cell derives from the API response (limits + feature flags);
// nothing is hardcoded. Rows whose feature exists for at least one
// plan are included; the boolean rows render ✓/— per plan.
function buildSections(t: (k: string) => string, plans: PublicPlan[]): ComparisonSection[] {
  const unlimited = -1 as const;
  const cell = (fn: (p: PublicPlan) => Cell) => plans.map(fn);
  const boolRow = (labelKey: string, fn: (p: PublicPlan) => boolean): ComparisonRow => ({
    labelKey,
    cells: cell((p) => ({ kind: 'bool', on: fn(p) })),
  });

  const aiCell = (limit: (p: PublicPlan) => number): Cell[] =>
    plans.map((p) => {
      if (p.features.ai === 'client') {
        // Bring-your-own provider keys — never metered.
        return { kind: 'value', text: t('mkt.compare.ownKeys') };
      }
      if (p.features.ai === 'none') return { kind: 'value', text: '—' };
      const n = limit(p);
      return { kind: 'value', text: n === unlimited ? t('mkt.stats.unlimited') : String(n) };
    });

  return [
    {
      titleKey: 'mkt.compare.usage',
      rows: [
        {
          labelKey: 'mkt.compare.sites',
          cells: cell((p) => ({
            kind: 'value',
            text: p.limits.maxSites === unlimited ? t('mkt.stats.unlimited') : String(p.limits.maxSites),
          })),
        },
        {
          labelKey: 'mkt.pricing.storage',
          cells: cell((p) => ({ kind: 'value', text: formatBytes(p.limits.storageBytes) })),
        },
        { labelKey: 'mkt.pricing.aiArticles', cells: aiCell((p) => p.limits.aiArticlesPerMonth) },
        { labelKey: 'mkt.pricing.aiImages', cells: aiCell((p) => p.limits.aiImagesPerMonth) },
      ],
    },
    {
      titleKey: 'mkt.compare.content',
      rows: [
        {
          labelKey: 'mkt.compare.aiContent',
          cells: plans.map((p) =>
            p.features.ai === 'none'
              ? ({ kind: 'bool', on: false } as Cell)
              : p.features.ai === 'client'
                ? ({ kind: 'value', text: t('mkt.compare.ownKeys') } as Cell)
                : ({ kind: 'bool', on: true } as Cell),
          ),
        },
        boolRow('mkt.pricing.editor', () => true),
        boolRow('mkt.pricing.mediaLibrary', () => true),
        boolRow('mkt.pricing.newsletter', (p) => p.features.newsletter),
        boolRow('mkt.compare.comments', (p) => p.features.comments),
        boolRow('mkt.compare.emailTemplates', (p) => p.features.emailTemplates),
      ],
    },
    {
      titleKey: 'mkt.compare.seo',
      rows: [
        boolRow('mkt.pricing.seoBasics', () => true),
        boolRow('mkt.compare.advancedSeo', (p) => p.features.advancedSeo),
      ],
    },
    {
      titleKey: 'mkt.compare.automation',
      rows: [
        boolRow('mkt.pricing.automation', (p) => p.features.automation),
        boolRow('mkt.compare.scheduledPublishing', () => true),
      ],
    },
    {
      titleKey: 'mkt.compare.dataSecurity',
      rows: [
        boolRow('mkt.compare.advancedAnalytics', (p) => p.features.advancedAnalytics),
        boolRow('mkt.compare.auditLog', (p) => p.features.auditLog),
        boolRow('mkt.pricing.backups', (p) => p.features.backups),
      ],
    },
    {
      titleKey: 'mkt.compare.platform',
      rows: [
        boolRow('mkt.compare.wordpress', () => true),
        boolRow('mkt.compare.restCms', () => true),
        boolRow('mkt.compare.webhooks', () => true),
      ],
    },
  ];
}

function ComparisonTable({ plans }: { plans: PublicPlan[] }) {
  const { t } = useT();
  const sections = useMemo(() => buildSections(t, plans), [t, plans]);

  return (
    <div className="overflow-x-auto pb-2" role="region" aria-label={t('mkt.pricing.completeFeatureList')}>
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th scope="col" className="w-[34%] min-w-44 pb-4 pr-4 align-bottom text-sm font-semibold text-text-primary">
              <span className="sr-only">{t('mkt.compare.featureCol')}</span>
            </th>
            {plans.map((p) => (
              <th
                key={p.planId}
                scope="col"
                className="pb-4 text-center align-bottom text-sm font-bold text-text-primary"
              >
                {p.name}
                {p.planId === 'pro' && (
                  <span className="mt-1 block text-[0.625rem] font-semibold uppercase tracking-wide text-mkt-accent">
                    {t('mkt.pricing.popular')}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <React.Fragment key={section.titleKey}>
              {/* Section separator — uppercase label on a hairline */}
              <tr>
                <th
                  scope="colgroup"
                  colSpan={plans.length + 1}
                  className="border-t border-border pt-6 pr-4 pb-3"
                >
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-text-muted">
                    {t(section.titleKey)}
                  </span>
                </th>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.labelKey} className="group">
                  <th scope="row" className="border-t border-border/60 py-3 pr-4 text-sm font-normal text-text-secondary">
                    {t(row.labelKey)}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="border-t border-border/60 py-3 text-center">
                      <ComparisonCell cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------- FAQ --------------------

const FAQ_KEYS = [
  'upgradeDowngrade',
  'paymentMethods',
  'cancel',
  'planLimits',
  'multipleSites',
  'startFree',
  'connectCms',
  'aiLimits',
] as const;

const FAQ_INITIAL_COUNT = 4;

function FaqRow({ qKey, aKey }: { qKey: string; aKey: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${qKey}-panel`}
        id={`${qKey}-button`}
        className="mkt-focus flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-semibold text-text-primary">{t(qKey)}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-mkt-accent transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>
      <div
        id={`${qKey}-panel`}
        role="region"
        aria-labelledby={`${qKey}-button`}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        {/* Collapsed answers stay mounted for the height animation
            but leave the tab/a11y tree via inert. */}
        <div className="overflow-hidden" inert={!open}>
          <p className="max-w-2xl pb-5 text-sm leading-relaxed text-text-secondary">{t(aKey)}</p>
        </div>
      </div>
    </div>
  );
}

// -------------------- Page --------------------

export function PricingPage() {
  const { t } = useT();
  const [data, setData] = useState<PlansResponse | null>(null);
  const [error, setError] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [faqExpanded, setFaqExpanded] = useState(false);
  const plansSectionRef = useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    setError(false);
    setData(null);
    try {
      const res = await fetch('/api/plans');
      if (!res.ok) throw new Error('plans failed');
      const json = (await res.json()) as { data?: PlansResponse };
      if (!json.data) throw new Error('no data');
      setData(json.data);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const plans = useMemo(() => data?.plans ?? [], [data]);

  // Yearly savings vs 12× monthly, computed from the REAL configured
  // prices (e.g. −17% when a year costs 490 CHF vs 12 × 49 = 588 CHF).
  // Shown next to the Yearly option; hidden when there is no discount.
  // Uses the most conservative (smallest) discount across paid plans
  // so the badge never overstates any plan's saving.
  const yearlySavings = useMemo(() => {
    const paid = plans.filter((p) => !p.isFree && p.priceMonthly > 0 && p.priceYearly > 0);
    if (paid.length === 0) return 0;
    return Math.min(
      ...paid.map((p) => Math.round((1 - p.priceYearly / (p.priceMonthly * 12)) * 100)),
    );
  }, [plans]);

  // Deep link #/pricing#faq → land on the FAQ (hash router keeps
  // the anchor in the fragment).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const anchor = window.location.hash.split('#')[2];
    if (anchor === 'faq') {
      document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const scrollToPlans = () => {
    plansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const visibleFaqKeys = faqExpanded ? FAQ_KEYS : FAQ_KEYS.slice(0, FAQ_INITIAL_COUNT);

  return (
    <>
      {/* ================= Hero + toggle + cards ================= */}
      <section id="pricing" className="relative overflow-hidden pt-32 sm:pt-40" aria-labelledby="pricing-heading">
        <div className="mkt-dotgrid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="mkt-container relative">
          {/* Hero — strong centered headline only (no eyebrow, no
              description) per the reference structure */}
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <h1 id="pricing-heading" className="mkt-display text-4xl text-text-primary sm:text-5xl">
                {t('mkt.pricing.heroTitle')}
              </h1>
            </div>
          </Reveal>

          {/* Billing toggle */}
          <Reveal delay={80}>
            <div className="mt-9 flex justify-center">
              <div
                role="radiogroup"
                aria-label={t('mkt.pricing.billingToggle')}
                className="inline-flex items-center rounded-full border border-border bg-card p-1"
              >
                {(['monthly', 'yearly'] as const).map((mode) => {
                  const active = (mode === 'yearly') === yearly;
                  return (
                    <button
                      key={mode}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setYearly(mode === 'yearly')}
                      className={`mkt-focus inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all ${
                        active ? 'bg-mkt-accent text-mkt-accent-fg' : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {mode === 'monthly' ? t('mkt.pricing.monthly') : t('mkt.pricing.yearly')}
                      {mode === 'yearly' && yearlySavings > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.625rem] font-semibold ${
                            active ? 'bg-mkt-accent-fg/20 text-mkt-accent-fg' : 'bg-mkt-accent-soft text-mkt-accent-soft-fg'
                          }`}
                        >
                          -{yearlySavings}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>

          {/* Cards */}
          <div ref={plansSectionRef} className="mt-12 scroll-mt-24 pb-4">
            {error ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <p className="text-sm text-text-secondary">{t('mkt.pricing.error')}</p>
                <button
                  onClick={load}
                  className="mkt-focus inline-flex h-10 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-text-primary hover:bg-muted"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t('mkt.pricing.retry')}
                </button>
              </div>
            ) : !data ? (
              <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('mkt.pricing.loading')}
              </div>
            ) : (
              <div className="grid gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                {plans.map((p, i) => (
                  <Reveal key={p.planId} delay={i * 70} className="h-full">
                    <PricingCard
                      plan={p}
                      currency={data.currency}
                      yearly={yearly}
                      recommended={p.planId === 'pro'}
                    />
                  </Reveal>
                ))}
              </div>
            )}
          </div>

          {/* ============ Complete feature list (expand) ============ */}
          {data && plans.length > 0 && (
            <Reveal delay={120}>
              <div className="flex flex-col items-center gap-4 pb-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowComparison((v) => !v)}
                  aria-expanded={showComparison}
                  aria-controls="complete-feature-list"
                  className="mkt-focus group inline-flex h-12 items-center gap-2.5 rounded-full border border-border bg-card px-7 text-sm font-semibold text-text-primary transition-colors hover:border-mkt-accent-border hover:text-mkt-accent"
                >
                  {t('mkt.pricing.completeFeatureList')}
                  <ChevronDown
                    className={`h-4 w-4 text-mkt-accent transition-transform duration-200 ${
                      showComparison ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {/* Collapsed by default; smooth height animation via
                    the grid-rows 0fr→1fr technique */}
                <div
                  id="complete-feature-list"
                  className={`grid w-full transition-[grid-template-rows] duration-300 ease-out ${
                    showComparison ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden" inert={!showComparison}>
                    <div className="mt-6 rounded-3xl border border-border bg-card px-5 py-2 sm:px-8">
                      <ComparisonTable plans={plans} />
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="mkt-section" aria-labelledby="pricing-cta-heading">
        <div className="mkt-container">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center sm:px-12 sm:py-20">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 60% 80% at 50% 120%, var(--mkt-hero-glow), transparent 70%)',
                }}
                aria-hidden="true"
              />
              <div className="relative flex flex-col items-center gap-5">
                <Logo />
                <h2 id="pricing-cta-heading" className="mkt-h2 max-w-xl text-[1.75rem] text-text-primary sm:text-4xl">
                  {t('mkt.pricing.ctaTitle')}
                </h2>
                <p className="max-w-md text-base leading-relaxed text-text-secondary">{t('mkt.pricing.subtitle')}</p>
                <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
                  <MarketingButton href={MKT.signup} size="lg" withArrow>
                    {t('mkt.cta.button')}
                  </MarketingButton>
                  {/* On the pricing page itself the route hash is
                      already #/pricing — prevent the no-op navigation
                      and scroll back to the cards instead. */}
                  <MarketingButton
                    href={MKT.pricing}
                    size="lg"
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToPlans();
                    }}
                  >
                    {t('mkt.cta.secondary')}
                  </MarketingButton>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="mkt-section scroll-mt-24" aria-labelledby="faq-heading">
        <div className="mkt-container">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <div className="flex flex-col items-center gap-4 text-center">
                <h2 id="faq-heading" className="mkt-h2 text-3xl text-text-primary sm:text-4xl">
                  {t('mkt.faq.title')}
                </h2>
                <p className="max-w-xl text-base leading-relaxed text-text-secondary">
                  {t('mkt.faq.subtitle')}
                </p>
                <div className="mt-2">
                  <MarketingButton href={MKT.contact} size="lg">
                    {t('mkt.faq.contact')}
                  </MarketingButton>
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="mt-12 border-t border-border">
                {visibleFaqKeys.map((key) => (
                  <FaqRow key={key} qKey={`mkt.faq.${key}.q`} aKey={`mkt.faq.${key}.a`} />
                ))}
              </div>
            </Reveal>

            {/* Load more — hidden once every question is visible */}
            {!faqExpanded && FAQ_KEYS.length > FAQ_INITIAL_COUNT && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setFaqExpanded(true)}
                  className="mkt-focus inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-semibold text-text-primary transition-colors hover:border-mkt-accent-border hover:text-mkt-accent"
                >
                  {t('mkt.faq.loadMore')}
                  <ChevronDown className="h-4 w-4 text-mkt-accent" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
