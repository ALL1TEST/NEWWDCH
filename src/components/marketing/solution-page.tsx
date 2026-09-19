'use client';

// ============================================================
// SOLUTION DETAIL PAGE — reusable storytelling template
// ============================================================
// One high-quality template renders every solution from the
// catalog (solutions-data.tsx), following a focused, product-led
// flow: hero → 3-step workflow → alternating product stories →
// benefits — then straight into the global footer (no closing
// CTA band on detail pages; the dark CTA lives on the solutions
// overview only). Global header/footer come from the marketing
// shell — never duplicated here.
//
// Honesty rules: screenshots are real captures, benefits
// describe shipped capabilities only, and every link resolves
// to an existing route.
// ============================================================

import React from 'react';
import { Check, Tag } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { BrowserFrame, MarketingButton, PointList, Reveal, SectionHeader } from './primitives';
import { MKT } from './marketing-header';
import { SOLUTION_BY_SLUG, type SolutionDef } from './solutions-data';
import { SceneStage } from './solution-illustrations';
import { SolutionVideoPreview } from './solution-video-preview';

// -------------------- Dark CTA band --------------------
// The strong, full-width close — charcoal band, peach glow,
// brand-orange primary action. Rendered by the SOLUTIONS
// OVERVIEW page only; solution detail pages end at their last
// content section and flow directly into the footer.

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

          {/* Product video preview — real capture, centered
              play button, opens a full-size lightbox. Replaces
              the old line-art stage (and its decorative backdrop
              blob that peeked out around the card edges). */}
          <Reveal delay={140}>
            <SolutionVideoPreview
              poster={def.stepsShot}
              title={t(def.menuTitleKey)}
              label={t(def.stepsShotLabelKey)}
              className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// -------------------- Hero divider --------------------
// Content Publishing: a plain, full-width hairline between the
// hero and the "How it works" band. Deliberately just a line —
// no icon, badge, illustration or any other decoration.

function SolutionHeroDivider() {
  return <div className="h-px w-full bg-border" aria-hidden="true" />;
}

// -------------------- 3-step workflow --------------------

function SolutionWorkflow({ def, divided = false }: { def: SolutionDef; divided?: boolean }) {
  const { t } = useT();
  return (
    <section
      id="how-it-works"
      className={`mkt-section scroll-mt-24 border-border bg-mkt-surface-2 ${divided ? 'border-b' : 'border-y'}`}
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

// -------------------- Page --------------------

export function SolutionPage({ slug }: { slug: string }) {
  const def = SOLUTION_BY_SLUG[slug];
  if (!def) return null; // router validates slugs — unreachable safety net

  // Content Publishing separates its hero from the workflow
  // band with a plain hairline divider (scoped change — the
  // other solutions keep the band's own top border).
  const heroDivider = slug === 'content-publishing';

  return (
    <>
      <SolutionHero def={def} />
      {heroDivider && <SolutionHeroDivider />}
      <SolutionWorkflow def={def} divided={heroDivider} />
      <SolutionStories def={def} />
      <SolutionBenefits def={def} />
    </>
  );
}
