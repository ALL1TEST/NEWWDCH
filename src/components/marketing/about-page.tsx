'use client';

// ============================================================
// ABOUT — premium long-form editorial page
// ============================================================
// Hero/mission → Our mission → Our story (alternating blocks) →
// What we believe → Customer perspective → dark final CTA.
//
// Product-honest by construction: copy is adapted from the
// existing about texts; the visuals are the real product
// screenshots and the site's illustration language. No invented
// history, customers, statistics, awards or claims — the
// testimonial section ships its carousel structure with an
// honest empty state until REAL customer data exists.
// ============================================================

import React from 'react';
import {
  BadgeCheck,
  Feather,
  Globe2,
  Image as ImageIcon,
  PenLine,
  Quote,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import {
  BrowserFrame,
  Eyebrow,
  Logo,
  MarketingButton,
  Reveal,
  SectionHeader,
} from './primitives';
import { MKT } from './marketing-header';
import { SceneStage, SolutionScene } from './solution-illustrations';
import { TestimonialCarousel, type Testimonial } from './testimonial-carousel';

// -------------------- Hero / mission --------------------
// Centered editorial headline + a large branded visual: the
// platform scene on a warm cream panel, with the five workflow
// pillars orbiting it as floating chips (a static wrapped row
// on mobile).

const HERO_CHIPS = [
  { icon: PenLine, labelKey: 'mkt.feat.ai.label', pos: 'left-[7%] -top-5 -rotate-2' },
  { icon: Search, labelKey: 'mkt.feat.seo.label', pos: 'right-[9%] -top-5 rotate-2' },
  { icon: ImageIcon, labelKey: 'mkt.feat.media.label', pos: '-left-4 top-[36%] rotate-1' },
  { icon: Zap, labelKey: 'mkt.feat.automation.label', pos: '-right-4 top-[58%] -rotate-1' },
  { icon: Globe2, labelKey: 'mkt.menu.contentPublishing', pos: 'left-1/2 -bottom-5 -translate-x-1/2' },
];

function HeroChip({ icon: Icon, label }: { icon: typeof PenLine; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-text-primary shadow-[0_2px_12px_-2px_rgb(0_0_0/0.14)]">
      <Icon className="h-4 w-4 shrink-0 text-mkt-accent" aria-hidden="true" />
      {label}
    </span>
  );
}

function AboutHero() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="mkt-dotgrid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-[-25%] h-[32rem] w-[58rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'var(--mkt-hero-glow)' }}
        aria-hidden="true"
      />
      <div className="mkt-container relative pb-20 sm:pb-28">
        <Reveal>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <Eyebrow>{t('mkt.about.eyebrow')}</Eyebrow>
            <h1 className="mkt-display text-[2.25rem] leading-[1.08] text-text-primary sm:text-5xl lg:text-[3.4rem]">
              {t('mkt.about.title')}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
              {t('mkt.about.intro')}
            </p>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <figure
            className="relative mx-auto mt-14 w-full max-w-5xl sm:mt-20"
            aria-label={t('mkt.about.heroFigure')}
          >
            {/* Floating workflow chips (md+) */}
            <div className="pointer-events-none absolute inset-0 z-10 hidden md:block">
              {HERO_CHIPS.map((chip) => {
                const Icon = chip.icon;
                return (
                  <span key={chip.labelKey} className={`absolute ${chip.pos}`}>
                    <HeroChip icon={Icon} label={t(chip.labelKey)} />
                  </span>
                );
              })}
            </div>

            {/* Branded visual — the platform scene on a cream panel */}
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-mkt-surface-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_48px_-16px_rgb(0_0_0/0.14)]">
              <div className="mkt-dotgrid absolute inset-0" aria-hidden="true" />
              <SolutionScene name="platform" className="relative mx-auto max-w-2xl p-6 sm:p-10" />
            </div>

            {/* Static chip row on small screens */}
            <div className="mt-5 flex flex-wrap justify-center gap-2.5 md:hidden">
              {HERO_CHIPS.map((chip) => {
                const Icon = chip.icon;
                return <HeroChip key={chip.labelKey} icon={Icon} label={t(chip.labelKey)} />;
              })}
            </div>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

// -------------------- Our mission --------------------
// Cream band, editorial typography: large statement text on one
// side, the publishing illustration on the other.

function AboutMission() {
  const { t } = useT();
  return (
    <section className="border-y border-border bg-mkt-surface-2" aria-labelledby="about-mission-heading">
      <div className="mkt-container py-20 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <div className="flex flex-col items-start gap-6">
              <h2
                id="about-mission-heading"
                className="mkt-h2 text-[1.75rem] text-text-primary sm:text-4xl"
              >
                {t('mkt.about.missionTitle')}
              </h2>
              <p className="text-xl leading-relaxed text-text-secondary sm:text-2xl sm:leading-[1.45]">
                {t('mkt.about.missionBody')}
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <SceneStage name="publishing" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// -------------------- Our story --------------------
// Alternating text + real product screenshot blocks, telling
// why Karmax exists and how it works. Copy adapted from the
// existing about texts — nothing invented.

const STORY_BLOCKS = [
  {
    shot: '/marketing/shot-articles.png',
    titleKey: 'mkt.about.story1Title',
    bodyKey: 'mkt.about.story1Body',
  },
  {
    shot: '/marketing/shot-seo.png',
    titleKey: 'mkt.about.story2Title',
    bodyKey: 'mkt.about.story2Body',
  },
  {
    shot: '/marketing/shot-automation.png',
    titleKey: 'mkt.about.story3Title',
    bodyKey: 'mkt.about.story3Body',
  },
];

function AboutStory() {
  const { t } = useT();
  return (
    <section className="mkt-section" aria-labelledby="about-story-heading">
      <div className="mkt-container flex flex-col gap-16 sm:gap-24">
        <Reveal>
          <SectionHeader
            id="about-story-heading"
            title={t('mkt.about.storyTitle')}
            subtitle={t('mkt.about.storySubtitle')}
          />
        </Reveal>
        {STORY_BLOCKS.map((block, i) => {
          const flip = i % 2 === 1;
          return (
            <Reveal key={block.titleKey}>
              <div
                className={`flex flex-col gap-10 lg:items-center lg:gap-16 ${
                  flip ? 'lg:flex-row-reverse' : 'lg:flex-row'
                }`}
              >
                <div className="flex flex-1 flex-col items-start gap-5">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-mkt-accent">
                    <span className="h-1 w-1 rounded-full bg-mkt-accent" aria-hidden="true" />
                    {t('mkt.about.storyLabel')} {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mkt-h2 max-w-md text-2xl text-text-primary sm:text-[2rem]">
                    {t(block.titleKey)}
                  </h3>
                  <p className="max-w-md text-base leading-relaxed text-text-secondary">
                    {t(block.bodyKey)}
                  </p>
                </div>
                <div className="flex-1">
                  <BrowserFrame
                    src={block.shot}
                    alt={`${t(block.titleKey)} — ${t('mkt.brand.name')}`}
                  />
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

// -------------------- What we believe --------------------
// Cream band with a 4-card principle grid — subtle borders,
// small icons, concise descriptions.

const BELIEFS = [
  { icon: Feather, titleKey: 'mkt.about.believe1Title', bodyKey: 'mkt.about.believe1Body' },
  { icon: Zap, titleKey: 'mkt.about.believe2Title', bodyKey: 'mkt.about.believe2Body' },
  { icon: BadgeCheck, titleKey: 'mkt.about.believe3Title', bodyKey: 'mkt.about.believe3Body' },
  { icon: ShieldCheck, titleKey: 'mkt.about.believe4Title', bodyKey: 'mkt.about.believe4Body' },
];

function AboutBeliefs() {
  const { t } = useT();
  return (
    <section className="border-y border-border bg-mkt-surface-2" aria-labelledby="about-believe-heading">
      <div className="mkt-container py-20 sm:py-28">
        <Reveal>
          <SectionHeader
            id="about-believe-heading"
            title={t('mkt.about.believeTitle')}
            subtitle={t('mkt.about.believeSubtitle')}
          />
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BELIEFS.map((belief, i) => {
            const Icon = belief.icon;
            return (
              <Reveal key={belief.titleKey} delay={i * 70}>
                <div className="mkt-card-hover h-full rounded-2xl border border-border bg-card p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mkt-accent-soft text-mkt-accent-soft-fg">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-text-primary">
                    {t(belief.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {t(belief.bodyKey)}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -------------------- Customer perspective --------------------
// The testimonial carousel structure, fully wired. It renders
// ONLY real customer data — until such data exists the section
// shows an honest empty state instead of fabricated quotes.

const TESTIMONIALS: Testimonial[] = [];

function AboutCustomers() {
  const { t } = useT();
  return (
    <section className="mkt-section" aria-labelledby="about-customers-heading">
      <div className="mkt-container">
        <Reveal>
          <SectionHeader
            id="about-customers-heading"
            title={t('mkt.about.customersTitle')}
            subtitle={t('mkt.about.customersBody')}
          />
        </Reveal>
        <Reveal delay={100} className="mt-12">
          {TESTIMONIALS.length > 0 ? (
            <TestimonialCarousel testimonials={TESTIMONIALS} />
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 rounded-3xl border border-dashed border-muted-foreground/35 bg-mkt-surface p-8 text-center sm:p-12">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mkt-accent-soft text-mkt-accent-soft-fg"
                aria-hidden="true"
              >
                <Quote className="h-6 w-6" />
              </span>
              <p className="max-w-xl text-base leading-relaxed text-text-secondary">
                {t('mkt.about.customersEmpty')}
              </p>
              <MarketingButton href={MKT.features} variant="secondary">
                {t('mkt.about.ctaSecondary')}
              </MarketingButton>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

// -------------------- Final CTA --------------------
// Dark Karmax-branded band with the brand-orange primary
// action — the same closing language as the solutions pages.

function AboutCta() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden bg-mkt-footer-bg py-20 sm:py-24" aria-labelledby="about-cta-heading">
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
            <Logo tone="accent" />
            <h2
              id="about-cta-heading"
              className="mkt-h2 text-[1.75rem] text-mkt-footer-heading sm:text-4xl"
            >
              {t('mkt.about.ctaTitle')}
            </h2>
            <p className="text-base leading-relaxed text-mkt-footer-text">{t('mkt.about.ctaBody')}</p>
            <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
              <MarketingButton href={MKT.signup} size="lg" withArrow>
                {t('mkt.nav.getStarted')}
              </MarketingButton>
              <MarketingButton href={MKT.features} size="lg" variant="secondary" onDark>
                {t('mkt.about.ctaSecondary')}
              </MarketingButton>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// -------------------- Page --------------------

export function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutMission />
      <AboutStory />
      <AboutBeliefs />
      <AboutCustomers />
      <AboutCta />
    </>
  );
}
