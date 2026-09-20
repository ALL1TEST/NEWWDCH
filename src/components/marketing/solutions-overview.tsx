'use client';

// ============================================================
// SOLUTIONS OVERVIEW — the #/solutions landing page
// ============================================================
// Introduces how Karmax helps different types of users reach
// specific publishing goals: a category grid (every card opens
// a full solution story), the shared 4-step workflow, and the
// audience directory. Legacy `?for=<audience>` deep links keep
// working — they scroll to and highlight the audience card.
// ============================================================

import React, { useEffect } from 'react';
import { useT } from '@/lib/i18n';
import { Eyebrow, MarketingButton, Reveal, SectionHeader } from './primitives';
import { MKT } from './marketing-header';
import {
  SOLUTION_CATALOG,
  USE_CASE_CARDS,
  solutionHref,
} from './solutions-data';
import { SolutionVideoPreview } from './solution-video-preview';
import { SolutionCta } from './solution-page';
import {
  CalendarClock,
  PenLine,
  Plug,
  RefreshCw,
} from 'lucide-react';

// -------------------- Hero --------------------

function OverviewHero() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="mkt-dotgrid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-[-25%] h-[32rem] w-[58rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'var(--mkt-hero-glow)' }}
        aria-hidden="true"
      />
      <div className="mkt-container relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <Reveal>
            <div className="flex flex-col items-start gap-6">
              <Eyebrow>{t('mkt.nav.solutions')}</Eyebrow>
              <h1 className="mkt-display text-[2.25rem] leading-[1.08] text-text-primary sm:text-5xl lg:text-[3.4rem]">
                {t('mkt.sol.title')}
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
                {t('mkt.sol.subtitle')}
              </p>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <MarketingButton href={MKT.signup} size="lg" withArrow>
                  {t('mkt.nav.getStarted')}
                </MarketingButton>
                <MarketingButton href={MKT.features} size="lg" variant="secondary">
                  {t('mkt.solp.ctaSecondary')}
                </MarketingButton>
              </div>
            </div>
          </Reveal>
          <Reveal delay={140}>
            <SolutionVideoPreview
              poster="/marketing/shot-dashboard.png"
              title={t('mkt.nav.solutions')}
              className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// -------------------- Category grid --------------------

function CategoryGrid() {
  const { t } = useT();
  return (
    <section className="mkt-section" aria-labelledby="categories-heading">
      <div className="mkt-container">
        <Reveal>
          <SectionHeader
            id="categories-heading"
            eyebrow={t('mkt.nav.solutions')}
            title={t('mkt.sol.categoriesTitle')}
            subtitle={t('mkt.sol.categoriesSubtitle')}
          />
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTION_CATALOG.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.slug} delay={i * 60}>
                <a
                  href={solutionHref(s.slug)}
                  className="mkt-card-hover mkt-focus group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-mkt-accent-border"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mkt-accent-soft text-mkt-accent-soft-fg">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-text-primary">{t(s.menuTitleKey)}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{t(s.menuDescKey)}</p>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-mkt-accent">
                    {t('mkt.solp.learnMore')}
                    <span
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </span>
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -------------------- Shared workflow --------------------

function OverviewWorkflow() {
  const { t } = useT();
  const steps = [
    { icon: Plug, titleKey: 'mkt.workflow.step1.title', bodyKey: 'mkt.workflow.step1.body' },
    { icon: PenLine, titleKey: 'mkt.workflow.step2.title', bodyKey: 'mkt.workflow.step2.body' },
    { icon: CalendarClock, titleKey: 'mkt.workflow.step3.title', bodyKey: 'mkt.workflow.step3.body' },
    { icon: RefreshCw, titleKey: 'mkt.workflow.step4.title', bodyKey: 'mkt.workflow.step4.body' },
  ];

  return (
    <section
      className="border-y border-border bg-mkt-surface-2 py-16 sm:py-20"
      aria-labelledby="overview-workflow-heading"
    >
      <div className="mkt-container">
        <Reveal>
          <SectionHeader
            id="overview-workflow-heading"
            eyebrow={t('mkt.workflow.eyebrow')}
            title={t('mkt.workflow.title')}
            subtitle={t('mkt.workflow.subtitle')}
          />
        </Reveal>

        <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div
            className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-border lg:block"
            aria-hidden="true"
          />
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal as="li" key={s.titleKey} delay={i * 90}>
                <div className="relative flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-mkt-accent shadow-sm">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="mkt-display text-4xl text-border" aria-hidden="true">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-text-primary">{t(s.titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{t(s.bodyKey)}</p>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// -------------------- Audience directory --------------------
// The six audiences; legacy `?for=` links scroll to + highlight.

function AudienceDirectory({ focus }: { focus?: string | null }) {
  const { t } = useT();

  // Legacy deep link (#/solutions?for=agencies…) — scroll the
  // audience card into view once rendered. Deferred by a tick so
  // the router's scroll-reset effect (a parent, which runs AFTER
  // this child effect) cannot cancel the scroll.
  useEffect(() => {
    if (!focus) return;
    const timer = setTimeout(() => {
      document.getElementById(focus)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => clearTimeout(timer);
  }, [focus]);

  return (
    <section className="mkt-section" aria-labelledby="audiences-heading">
      <div className="mkt-container">
        <Reveal>
          <SectionHeader
            id="audiences-heading"
            eyebrow={t('mkt.usecases.eyebrow')}
            title={t('mkt.solp.usecasesTitle')}
            subtitle={t('mkt.sol.audiencesSubtitle')}
          />
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASE_CARDS.map((c, i) => {
            const Icon = c.icon;
            const isFocus = focus === c.anchor;
            return (
              <Reveal key={c.anchor} delay={i * 50}>
                <a
                  id={c.anchor}
                  href={c.href}
                  className={`mkt-card-hover mkt-focus group flex h-full scroll-mt-28 flex-col gap-3.5 rounded-2xl border p-6 ${
                    isFocus
                      ? 'border-mkt-accent-border bg-mkt-accent-soft shadow-[0_12px_48px_-20px_var(--mkt-accent)]'
                      : 'border-border bg-card'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isFocus ? 'bg-mkt-accent text-mkt-accent-fg' : 'bg-mkt-accent-soft text-mkt-accent-soft-fg'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-text-primary">{t(c.titleKey)}</h3>
                  <p
                    className={`text-sm leading-relaxed ${
                      isFocus ? 'text-mkt-accent-soft-fg' : 'text-text-secondary'
                    }`}
                  >
                    {t(c.bodyKey)}
                  </p>
                  <span
                    className={`mt-auto inline-flex items-center gap-1 text-xs font-semibold ${
                      isFocus ? 'text-mkt-accent-soft-fg' : 'text-mkt-accent'
                    }`}
                  >
                    {t('mkt.sol.details')} <span aria-hidden="true">→</span>
                  </span>
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -------------------- Page --------------------

export function SolutionsOverview({ focus }: { focus?: string | null }) {
  return (
    <>
      <OverviewHero />
      <CategoryGrid />
      <OverviewWorkflow />
      <AudienceDirectory focus={focus} />
      <SolutionCta />
    </>
  );
}
