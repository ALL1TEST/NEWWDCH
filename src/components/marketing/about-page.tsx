'use client';

// ============================================================
// ABOUT — premium long-form editorial page
// ============================================================
// Hero ("Our mission." serif headline over an original mountain
// scene with the Karmax flag at the summit) → a compact centered
// intro ("One calm workflow for everything you publish.") → ONE
// cohesive editorial band pairing the mission row and the story
// row (alternating image/text, shared warm surface, no eyebrow
// labels) → What we believe (four principle cards) → What our
// customers say (testimonial carousel).
//
// Product-honest by construction: copy is adapted from the
// existing about texts; the mission/story visuals are brand
// imagery (no invented people, history, customers, stats or
// claims). The testimonial carousel ships with CLEARLY MARKED
// demo slides — never fabricated customers — and accepts real
// data through the reusable `Testimonial[]` prop (CMS/API
// ready) so the demo content is replaced, not mixed in.
// ============================================================

import React from 'react';
import {
  BadgeCheck,
  Feather,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import {
  Reveal,
  SectionHeader,
} from './primitives';
import { TestimonialCarousel, type Testimonial } from './testimonial-carousel';

// -------------------- Mountain scene --------------------
// An original layered-peak illustration: warm stone tones, a
// snow-capped summit flying the Karmax pennant, and mist that
// dissolves into the page background (theme-aware via CSS vars
// + a token-colored fade overlay). Pure SVG — no external asset.

function MountainScene() {
  return (
    <svg
      viewBox="0 0 1200 560"
      className="mkt-mountain h-auto w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="mkt-mtn-blur" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* Back range — soft distant masses */}
      <path d="M-40 560 L300 244 L640 560 Z" fill="var(--mtn-back)" />
      <path d="M560 560 L880 218 L1240 560 Z" fill="var(--mtn-back)" />
      <path d="M170 560 L520 302 L870 560 Z" fill="var(--mtn-mid)" opacity="0.75" />

      {/* Main peak — two faces for volume */}
      <path d="M600 88 L340 560 L600 560 Z" fill="var(--mtn-face)" />
      <path d="M600 88 L860 560 L600 560 Z" fill="var(--mtn-mid)" />

      {/* Ridge lines */}
      <path
        d="M600 88 L340 560 M600 88 L860 560"
        stroke="var(--mtn-ridge)"
        strokeWidth="2"
        strokeOpacity="0.45"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M600 96 L560 200 L586 268 M602 110 L648 214 L622 286"
        stroke="var(--mtn-ridge)"
        strokeWidth="1.6"
        strokeOpacity="0.3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Snow cap — jagged drape over the summit */}
      <path
        d="M600 88 L668 212 L650 198 L636 222 L620 204 L604 226 L588 206 L572 222 L556 200 L534 210 Z"
        fill="var(--mtn-snow)"
      />

      {/* Karmax pennant at the summit */}
      <path d="M600 88 L600 26" stroke="var(--mtn-pole)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path
        d="M600 28 C 622 21 640 33 666 26 L661 52 C 640 59 622 47 600 54 Z"
        fill="var(--mkt-accent)"
      />
      <path
        d="M611 33.5 L611 49.5 M626 34.5 L615.5 41.5 L626 48.5"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Atmospheric mist — theme-colored clouds blurring the base */}
      <g filter="url(#mkt-mtn-blur)">
        <ellipse cx="252" cy="352" rx="96" ry="22" fill="var(--background)" opacity="0.6" />
        <ellipse cx="962" cy="384" rx="104" ry="24" fill="var(--background)" opacity="0.6" />
        <ellipse cx="386" cy="436" rx="184" ry="38" fill="var(--background)" opacity="0.85" />
        <ellipse cx="824" cy="472" rx="222" ry="44" fill="var(--background)" opacity="0.85" />
        <ellipse cx="600" cy="506" rx="330" ry="50" fill="var(--background)" opacity="0.95" />
      </g>
    </svg>
  );
}

// -------------------- Hero / mission --------------------
// Centered serif "Our mission." headline in the page's editorial
// dark ink; the mountain rises IN FRONT of the headline's lower
// portion (depth effect) and its base dissolves into the page
// background. The brand-orange pennant carries the accent.

function AboutHero() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="mkt-container relative">
        <Reveal>
          <h1 className="mkt-display mkt-serif relative z-10 mx-auto max-w-4xl text-center text-5xl leading-[1.05] text-text-primary sm:text-7xl lg:text-8xl">
            {t('mkt.about.heroTitle')}
          </h1>
        </Reveal>

        {/* Mountain scene — summit overlaps the headline bottom */}
        <div className="pointer-events-none relative z-20 -mt-16 sm:-mt-24 lg:-mt-32">
          <MountainScene />
          {/* Fade the base into the page background */}
          <div className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-b from-transparent to-background" />
        </div>
      </div>
    </section>
  );
}

// -------------------- Intro --------------------
// A short, centered statement that carries the publishing thesis
// right after the hero — no image, no eyebrow, compact. The real
// product capabilities live in the mission and story copy below.

function AboutIntro() {
  const { t } = useT();
  return (
    <section className="pb-14 pt-4 sm:pb-20 sm:pt-6" aria-labelledby="about-intro-heading">
      <div className="mkt-container">
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            <h2
              id="about-intro-heading"
              className="mkt-serif text-[1.875rem] font-bold leading-[1.12] text-text-primary sm:text-[2.375rem]"
            >
              {t('mkt.about.missionHead')}
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-text-secondary sm:text-[1.0625rem]">
              {t('mkt.about.missionLead')}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// -------------------- Story figure --------------------
// Editorial brand imagery — generous rounding, hairline ring and
// a soft two-tier shadow (no invented people or milestones).
// Shared by the mission and story rows so both figures share
// identical dimensions, radius and elevation.

function StoryFigure({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="overflow-hidden rounded-[1.75rem] ring-1 ring-border shadow-[0_2px_8px_rgb(0_0_0/0.04),0_28px_72px_-28px_rgb(0_0_0/0.25)]">
      <img src={src} alt={alt} loading="lazy" decoding="async" className="h-auto w-full" width={1344} height={768} />
    </figure>
  );
}

// -------------------- Mission + Story --------------------
// ONE cohesive editorial band: the mission row and the story row
// share a warm surface, alternating image/text positions and one
// visual rhythm — no eyebrow labels, no double section padding.
// The tight internal gap makes Mission → Story read as a single
// continuous narrative rather than two disconnected blocks.

function AboutMissionStory() {
  const { t } = useT();
  return (
    <section className="border-y border-border bg-mkt-about-warm" aria-label={t('mkt.about.eyebrow')}>
      <div className="mkt-container flex flex-col gap-14 py-16 sm:gap-16 sm:py-20 lg:gap-20 lg:py-24">
        {/* Mission — image left, copy right */}
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <StoryFigure src="/marketing/about-studio.png" alt={t('mkt.about.studioAlt')} />
          </Reveal>
          <Reveal delay={100}>
            <div className="flex flex-col items-start gap-5">
              <h2
                id="about-mission-heading"
                className="mkt-serif text-[1.75rem] font-bold leading-[1.15] text-text-primary sm:text-[2.125rem]"
              >
                {t('mkt.about.rowMissionTitle')}
              </h2>
              <p className="text-base leading-relaxed text-text-secondary">{t('mkt.about.rowMissionBody1')}</p>
              <p className="text-base leading-relaxed text-text-secondary">{t('mkt.about.rowMissionBody2')}</p>
            </div>
          </Reveal>
        </div>

        {/* Story — copy left, image right (alternated) */}
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="flex flex-col items-start gap-5">
              <h2
                id="about-story-heading"
                className="mkt-serif text-[1.75rem] font-bold leading-[1.15] text-text-primary sm:text-[2.125rem]"
              >
                {t('mkt.about.rowStoryTitle')}
              </h2>
              <p className="text-base leading-relaxed text-text-secondary">{t('mkt.about.rowStoryBody1')}</p>
              <p className="text-base leading-relaxed text-text-secondary">{t('mkt.about.rowStoryBody2')}</p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <StoryFigure src="/marketing/about-team.png" alt={t('mkt.about.teamAlt')} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// -------------------- What we believe --------------------
// Four principle cards — quiet white surfaces, hairline borders,
// a soft shadow and a small accent icon container above each
// title. Icons are a coherent stroke set (Lucide SVGs): feather
// for Simplicity, bolt for Automation, badge for Quality, shield
// for Control. Equal heights on every breakpoint.
// Responsive: 4 columns desktop, 2 tablet, 1 mobile.

const BELIEFS = [
  { icon: Feather, titleKey: 'mkt.about.believe1Title', bodyKey: 'mkt.about.believe1Body' },
  { icon: Zap, titleKey: 'mkt.about.believe2Title', bodyKey: 'mkt.about.believe2Body' },
  { icon: BadgeCheck, titleKey: 'mkt.about.believe3Title', bodyKey: 'mkt.about.believe3Body' },
  { icon: ShieldCheck, titleKey: 'mkt.about.believe4Title', bodyKey: 'mkt.about.believe4Body' },
];

function AboutBeliefs() {
  const { t } = useT();
  return (
    <section className="py-16 sm:py-20 lg:py-24" aria-labelledby="about-believe-heading">
      <div className="mkt-container">
        <Reveal>
          <SectionHeader id="about-believe-heading" title={t('mkt.about.believeTitle')} />
        </Reveal>
        <div className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
          {BELIEFS.map((belief, i) => {
            const Icon = belief.icon;
            return (
              <Reveal key={belief.titleKey} delay={i * 70} className="h-full">
                <div className="mkt-card-hover flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-7">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mkt-accent-soft text-mkt-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-6 text-[0.9375rem] font-semibold text-text-primary">{t(belief.titleKey)}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">{t(belief.bodyKey)}</p>
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
// The testimonial carousel, wired with CLEARLY MARKED demo
// slides. Each demo slide uses a placeholder silhouette avatar,
// generic attribution fields and an explanatory quote, plus a
// "Demo" chip on the card — nothing can be mistaken for a real
// customer. To go live with REAL data, replace DEMO_TESTIMONIALS
// with testimonials loaded from the CMS/API (same `Testimonial`
// shape; drop the `demo` flag and pass `avatar` image URLs).

function AboutCustomers() {
  const { t } = useT();

  const DEMO_TESTIMONIALS: Testimonial[] = [
    {
      demo: true,
      quote: t('mkt.about.demoQuote1'),
      name: t('mkt.about.demoName'),
      role: t('mkt.about.demoRole'),
      company: t('mkt.about.demoCompany'),
    },
    {
      demo: true,
      quote: t('mkt.about.demoQuote2'),
      name: t('mkt.about.demoName'),
      role: t('mkt.about.demoRole'),
      company: t('mkt.about.demoCompany'),
    },
    {
      demo: true,
      quote: t('mkt.about.demoQuote3'),
      name: t('mkt.about.demoName'),
      role: t('mkt.about.demoRole'),
      company: t('mkt.about.demoCompany'),
    },
    {
      demo: true,
      quote: t('mkt.about.demoQuote4'),
      name: t('mkt.about.demoName'),
      role: t('mkt.about.demoRole'),
      company: t('mkt.about.demoCompany'),
    },
  ];

  return (
    <section className="border-y border-border bg-mkt-about-warm" aria-labelledby="about-customers-heading">
      <div className="mkt-container py-16 sm:py-20 lg:py-24">
        <Reveal>
          <SectionHeader
            id="about-customers-heading"
            title={t('mkt.about.customersTitle')}
            subtitle={t('mkt.about.customersBody')}
          />
        </Reveal>
        <Reveal delay={100} className="mt-14 sm:mt-16">
          <TestimonialCarousel testimonials={DEMO_TESTIMONIALS} />
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
      <AboutIntro />
      <AboutMissionStory />
      <AboutBeliefs />
      <AboutCustomers />
    </>
  );
}
