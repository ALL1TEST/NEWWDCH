'use client';

// ============================================================
// SOLUTION DETAIL PAGE — reusable storytelling template
// ============================================================
// One high-quality template renders every solution from the
// catalog (solutions-data.tsx), following the editorial SaaS
// flow: hero → intro → 3-step workflow → alternating product
// stories → benefits → use cases → example workflows →
// related resources → dark CTA. Global header/footer come from
// the marketing shell — never duplicated here.
//
// Honesty rules: screenshots are real captures, benefits and
// examples describe shipped capabilities only, and every link
// resolves to an existing route.
// ============================================================

import React from 'react';
import { ArrowRight, Check, FileText, ListChecks, Search, Tag } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { BrowserFrame, Eyebrow, MarketingButton, PointList, Reveal, SectionHeader } from './primitives';
import { MKT } from './marketing-header';
import { SOLUTION_BY_SLUG, USE_CASE_CARDS, type SolutionDef } from './solutions-data';
import { SceneStage } from './solution-illustrations';

// -------------------- Dark CTA band --------------------
// The strong, full-width close before the (dark) footer —
// charcoal band, peach glow, brand-orange primary action.

export function SolutionCta() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden bg-mkt-footer-bg py-20 sm:py-24" aria-labelledby="solution-cta-heading">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 55% 70% at 50% 115%, rgb(255 72 0 / 16%), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="mkt-container relative">
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-mkt-footer-accent-soft text-mkt-footer-text-active"
              aria-hidden="true"
            >
              <Tag className="h-5 w-5 rotate-90" />
            </span>
            <h2
              id="solution-cta-heading"
              className="mkt-h2 text-[1.75rem] text-mkt-footer-heading sm:text-4xl"
            >
              {t('mkt.solp.ctaTitle')}
            </h2>
            <p className="text-base leading-relaxed text-mkt-footer-text">
              {t('mkt.solp.ctaBody')}
            </p>
            <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
              <MarketingButton href={MKT.signup} size="lg" withArrow>
                {t('mkt.nav.getStarted')}
              </MarketingButton>
              <MarketingButton href={MKT.features} size="lg" variant="secondary" onDark>
                {t('mkt.solp.ctaSecondary')}
              </MarketingButton>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// -------------------- Hero --------------------

function SolutionHero({ def }: { def: SolutionDef }) {
  const { t } = useT();
  const learnMore = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // In-page anchor without touching the hash router.
    e.preventDefault();
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
          {/* Copy */}
          <Reveal>
            <div className="flex flex-col items-start gap-6">
              <a
                href={MKT.solutions}
                className="mkt-focus group inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-mkt-accent"
              >
                <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">←</span>
                {t('mkt.nav.solutions')}
              </a>
              <h1 className="mkt-display text-[2.25rem] leading-[1.08] text-text-primary sm:text-5xl lg:text-[3.4rem]">
                {t(def.heroTitleKey)}
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
                {t(def.heroBodyKey)}
              </p>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <MarketingButton href={MKT.signup} size="lg" withArrow>
                  {t('mkt.nav.getStarted')}
                </MarketingButton>
                <MarketingButton href="#how-it-works" size="lg" variant="secondary" onClick={learnMore}>
                  {t('mkt.solp.learnMore')}
                </MarketingButton>
              </div>
            </div>
          </Reveal>

          {/* Original illustration on a soft stage */}
          <Reveal delay={140}>
            <SceneStage name={def.heroScene} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// -------------------- Intro / what it does --------------------

function SolutionIntro({ def }: { def: SolutionDef }) {
  const { t } = useT();
  return (
    <section className="mkt-section pb-0 sm:pb-0" aria-labelledby="solution-intro-heading">
      <div className="mkt-container">
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            <Eyebrow>{t(def.menuTitleKey)}</Eyebrow>
            <h2 id="solution-intro-heading" className="mkt-h2 text-[1.75rem] text-text-primary sm:text-4xl">
              {t(def.introTitleKey)}
            </h2>
            <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
              {t(def.introBodyKey)}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// -------------------- 3-step workflow --------------------

function SolutionWorkflow({ def }: { def: SolutionDef }) {
  const { t } = useT();
  return (
    <section
      id="how-it-works"
      className="mkt-section scroll-mt-24 border-y border-border bg-mkt-surface-2"
      aria-labelledby="solution-workflow-heading"
    >
      <div className="mkt-container">
        <Reveal>
          <SectionHeader id="solution-workflow-heading" title={t('mkt.solp.workflowTitle')} />
        </Reveal>

        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 lg:gap-8">
          {/* connector (desktop) */}
          <div
            className="pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-px bg-border md:block"
            aria-hidden="true"
          />
          {def.steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal as="li" key={s.titleKey} delay={i * 90}>
                <div className="relative flex h-full flex-col gap-4">
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

        {/* the real product, wide */}
        <Reveal delay={180}>
          <div className="mx-auto mt-14 w-full max-w-4xl">
            <BrowserFrame
              src={def.stepsShot}
              alt={`${t(def.menuTitleKey)} — ${t('mkt.brand.name')}`}
              label={t(def.stepsShotLabelKey)}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// -------------------- Alternating product stories --------------------

function SolutionStories({ def }: { def: SolutionDef }) {
  const { t } = useT();
  return (
    <section className="mkt-section" aria-labelledby="solution-stories-heading">
      <div className="mkt-container flex flex-col gap-16 sm:gap-24">
        <Reveal>
          <h2 id="solution-stories-heading" className="sr-only">
            {t('mkt.solp.storiesTitle')}
          </h2>
        </Reveal>
        {def.stories.map((story, i) => {
          const flip = i % 2 === 1;
          return (
            <Reveal key={story.titleKey}>
              <div
                className={`flex scroll-mt-28 flex-col gap-10 lg:items-center lg:gap-16 ${
                  flip ? 'lg:flex-row-reverse' : 'lg:flex-row'
                }`}
              >
                {/* Copy */}
                <div className="flex flex-1 flex-col items-start gap-5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-mkt-accent">
                    <span className="h-1 w-1 rounded-full bg-mkt-accent" aria-hidden="true" />
                    {t('mkt.solp.storyLabel')} {i + 1}
                  </span>
                  <h3 className="mkt-h2 max-w-md text-2xl text-text-primary sm:text-[2rem]">
                    {t(story.titleKey)}
                  </h3>
                  <p className="max-w-md text-base leading-relaxed text-text-secondary">
                    {t(story.bodyKey)}
                  </p>
                  <PointList points={story.points.map((p) => t(p))} />
                </div>

                {/* Visual */}
                <div className="flex-1">
                  {story.shot ? (
                    <BrowserFrame
                      src={story.shot}
                      alt={`${t(story.titleKey)} — ${t('mkt.brand.name')}`}
                      label={story.shotLabelKey ? t(story.shotLabelKey) : undefined}
                    />
                  ) : (
                    story.illustration && <SceneStage name={story.illustration} />
                  )}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// -------------------- Benefits --------------------

function SolutionBenefits({ def }: { def: SolutionDef }) {
  const { t } = useT();
  return (
    <section className="border-y border-border bg-mkt-surface" aria-labelledby="solution-benefits-heading">
      <div className="mkt-container py-16 sm:py-20">
        <Reveal>
          <SectionHeader
            id="solution-benefits-heading"
            eyebrow={t('mkt.solp.benefitsEyebrow')}
            title={t('mkt.solp.benefitsTitle')}
          />
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          {def.benefits.map((b, i) => (
            <Reveal key={b} delay={i * 60}>
              <div className="mkt-card-hover flex h-full items-start gap-3.5 rounded-2xl border border-border bg-card p-5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mkt-accent-soft text-mkt-accent-soft-fg">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <p className="text-sm leading-relaxed text-text-secondary">{t(b)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// -------------------- Use cases --------------------

function SolutionUseCases() {
  const { t } = useT();
  const cases = USE_CASE_CARDS.slice(0, 4);
  return (
    <section className="mkt-section" aria-labelledby="solution-usecases-heading">
      <div className="mkt-container">
        <Reveal>
          <SectionHeader
            id="solution-usecases-heading"
            eyebrow={t('mkt.usecases.eyebrow')}
            title={t('mkt.solp.usecasesTitle')}
            subtitle={t('mkt.solp.usecasesSubtitle')}
          />
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cases.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.anchor} delay={i * 60}>
                <a
                  href={c.href}
                  className="mkt-card-hover mkt-focus flex h-full flex-col gap-3.5 rounded-2xl border border-border bg-card p-6"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mkt-accent-soft text-mkt-accent-soft-fg">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-text-primary">{t(c.titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{t(c.bodyKey)}</p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-mkt-accent">
                    {t('mkt.solp.usecaseLink')} <span aria-hidden="true">→</span>
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

// -------------------- Example workflows --------------------
// Honest alternative to customer stories: real, set-up-today
// workflows. No names, no numbers, no testimonials.

function SolutionPossible({ def }: { def: SolutionDef }) {
  const { t } = useT();
  return (
    <section className="border-y border-border bg-mkt-surface-2" aria-labelledby="solution-possible-heading">
      <div className="mkt-container py-16 sm:py-20">
        <Reveal>
          <SectionHeader
            id="solution-possible-heading"
            eyebrow={t('mkt.solp.possibleEyebrow')}
            title={t('mkt.solp.possibleTitle')}
            subtitle={t('mkt.solp.possibleSubtitle')}
          />
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {def.possible.map((p, i) => (
            <Reveal key={p.titleKey} delay={i * 70}>
              <div className="mkt-card-hover flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-6">
                <span className="mkt-display text-3xl text-mkt-accent" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-sm font-semibold text-text-primary">{t(p.titleKey)}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{t(p.bodyKey)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// -------------------- Related resources --------------------
// Real destinations only: the blog (live articles via the public
// API), the feature deep-dives on home, and plan comparison.

function SolutionRelated() {
  const { t } = useT();
  const resources = [
    {
      icon: FileText,
      titleKey: 'mkt.solp.resBlogTitle',
      bodyKey: 'mkt.solp.resBlogBody',
      ctaKey: 'mkt.solp.resBlogCta',
      href: MKT.blog,
    },
    {
      icon: ListChecks,
      titleKey: 'mkt.solp.resFeaturesTitle',
      bodyKey: 'mkt.solp.resFeaturesBody',
      ctaKey: 'mkt.solp.resFeaturesCta',
      href: MKT.features,
    },
    {
      icon: Search,
      titleKey: 'mkt.solp.resPricingTitle',
      bodyKey: 'mkt.solp.resPricingBody',
      ctaKey: 'mkt.solp.resPricingCta',
      href: MKT.pricing,
    },
  ];

  return (
    <section className="mkt-section" aria-labelledby="solution-related-heading">
      <div className="mkt-container">
        <Reveal>
          <SectionHeader id="solution-related-heading" title={t('mkt.solp.relatedTitle')} />
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {resources.map((r, i) => {
            const Icon = r.icon;
            return (
              <Reveal key={r.titleKey} delay={i * 60}>
                <a
                  href={r.href}
                  className="mkt-card-hover mkt-focus group flex h-full flex-col gap-3.5 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-mkt-accent-border"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mkt-accent-soft text-mkt-accent-soft-fg">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-text-primary">{t(r.titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{t(r.bodyKey)}</p>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-mkt-accent">
                    {t(r.ctaKey)}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
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

export function SolutionPage({ slug }: { slug: string }) {
  const def = SOLUTION_BY_SLUG[slug];
  if (!def) return null; // router validates slugs — unreachable safety net

  return (
    <>
      <SolutionHero def={def} />
      <SolutionIntro def={def} />
      <SolutionWorkflow def={def} />
      <SolutionStories def={def} />
      <SolutionBenefits def={def} />
      <SolutionUseCases />
      <SolutionPossible def={def} />
      <SolutionRelated />
      <SolutionCta />
    </>
  );
}
