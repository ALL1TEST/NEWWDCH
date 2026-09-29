'use client';

// ============================================================
// SOLUTION DETAIL PAGE — reusable storytelling template
// ============================================================
// One high-quality template renders every solution from the
// catalog (solutions-data.tsx), following a focused, product-led
// flow: hero → alternating product stories → benefits — then
// straight into the global footer (no closing CTA band on detail
// pages; the dark CTA lives on the solutions overview only).
// Global header/footer come from the marketing shell — never
// duplicated here.
//
// Honesty rules: screenshots are real captures, benefits
// describe shipped capabilities only, and every link resolves
// to an existing route.
// ============================================================

import React from 'react';
import { Tag } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { MarketingButton, PointList, Reveal } from './primitives';
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
    document
      .getElementById('inside-the-product')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                <MarketingButton href="#inside-the-product" size="lg" variant="secondary" onClick={learnMore}>
                  {t('mkt.solp.learnMore')}
                </MarketingButton>
              </div>
            </div>
          </Reveal>

          {/* Product video player — real demo video with full
              controls; poster is the solution's real product
              capture so the card looks identical until played. */}
          <Reveal delay={140}>
            <SolutionVideoPreview
              poster={def.stepsShot}
              title={t(def.menuTitleKey)}
              className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// -------------------- Alternating product stories --------------------
// Editorial feature rhythm: alternating 50/50 rows — text left /
// product UI right, then reversed — with a barely-there 1px center
// rule between the two columns (two-column layout only) and a
// subtle horizontal hairline closing each feature section — it
// belongs to the section itself, sitting a short step beneath the
// row's content, while the container's section gap opens the
// whitespace to the next story.
// Each copy column opens with a tiny orange eyebrow — a minimal
// uppercase section identifier (no dot, no number) — directly
// above the heading, and each screenshot is presented as a clean
// product showcase: rounded corners, whisper hairline, soft
// two-tier shadow, white surface — no browser chrome, no heavy
// card container. Mobile stacks label → heading → body →
// bullets → image. Carries the id the hero's "Learn more"
// button scrolls to.

function SolutionStories({ def }: { def: SolutionDef }) {
  const { t } = useT();
  return (
    <section id="inside-the-product" className="mkt-section scroll-mt-24" aria-labelledby="solution-stories-heading">
      <div className="mkt-container flex flex-col gap-16 sm:gap-28 lg:gap-32">
        <Reveal>
          <h2 id="solution-stories-heading" className="sr-only">
            {t('mkt.solp.storiesTitle')}
          </h2>
        </Reveal>
        {def.stories.map((story, i) => {
          const flip = i % 2 === 1;
          return (
            <React.Fragment key={story.titleKey}>
              <Reveal>
                <div
                  className={`flex scroll-mt-28 flex-col gap-10 lg:items-center lg:gap-20 ${
                    flip ? 'lg:flex-row-reverse' : 'lg:flex-row'
                  }`}
                >
                  {/* Copy */}
                  <div className="flex flex-1 flex-col items-start gap-5">
                    <span className="mkt-eyebrow">{t(story.eyebrowKey)}</span>
                    <h3 className="mkt-h2 max-w-md text-2xl text-text-primary sm:text-[2rem]">
                      {t(story.titleKey)}
                    </h3>
                    <p className="max-w-md text-base leading-relaxed text-text-secondary">
                      {t(story.bodyKey)}
                    </p>
                    <PointList points={story.points.map((p) => t(p))} />
                  </div>

                  {/* Center rule — a barely-there editorial divider
                      floating exactly between the two columns (in the
                      middle of the gutter, attached to neither side).
                      1px, hairline gray, near-full row height via
                      self-stretch; renders only while the two-column
                      layout is active — hidden on stacked layouts. */}
                  <div className="hidden w-px self-stretch bg-border lg:block" aria-hidden="true" />

                  {/* Visual — clean product showcase: rounded, soft
                      shadow, white surface; no chrome, no card wrap */}
                  <div className="flex-1">
                    {story.shot ? (
                      <figure className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_48px_-16px_rgb(0_0_0/0.16)]">
                        <img
                          src={story.shot}
                          alt={`${t(story.titleKey)} — ${t('mkt.brand.name')}`}
                          loading="lazy"
                          decoding="async"
                          className="block h-auto w-full"
                          width={1440}
                          height={900}
                        />
                      </figure>
                    ) : (
                      story.illustration && <SceneStage name={story.illustration} />
                    )}
                  </div>
                </div>

                {/* Hairline — a very subtle 1px structural separator
                    that closes the feature section. It is part of the
                    section container itself, placed a short step
                    directly beneath the row (image/content bottom),
                    so it reads as the row's bottom edge; the
                    container's section gap then provides the
                    breathing room to the next feature section. */}
                <div className="mt-10 h-px w-full bg-border sm:mt-12" aria-hidden="true" />
              </Reveal>
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

// -------------------- Benefits --------------------
// "What you get" — a quiet off-white band with no dividing
// border (natural whitespace separates it from the feature
// sections above). The heading is large and centered — a clean
// hierarchy step below the hero — with no eyebrow. Each benefit
// sits in its own minimal bordered container: white surface,
// 1px hairline, rounded corners, comfortable padding, a small
// custom orange line-art icon aligned with the first text line,
// and the design system's soft hover. 2 columns on desktop,
// 1 on mobile.

function SolutionBenefits({ def }: { def: SolutionDef }) {
  const { t } = useT();
  return (
    <section className="bg-mkt-surface" aria-labelledby="solution-benefits-heading">
      <div className="mkt-container py-20 sm:py-24">
        <Reveal>
          <h2
            id="solution-benefits-heading"
            className="mkt-h2 text-center text-[2.25rem] text-text-primary sm:text-5xl"
          >
            {t('mkt.solp.benefitsTitle')}
          </h2>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:mt-14 sm:grid-cols-2">
          {def.benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <Reveal key={b.key} delay={i * 60}>
                <div className="mkt-card-hover flex h-full items-start gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgb(0_0_0/0.03)] transition-all duration-300 hover:shadow-md hover:border-border/80">
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-mkt-accent" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-text-secondary">{t(b.key)}</p>
                </div>
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
      <SolutionStories def={def} />
      <SolutionBenefits def={def} />
    </>
  );
}
