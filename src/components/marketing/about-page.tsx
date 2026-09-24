'use client';

// ============================================================
// ABOUT — premium long-form editorial page
// ============================================================
// Mission hero ("Our mission." serif headline over an original
// mountain scene with the Karmax flag at the summit) → the
// publishing story (asymmetric editorial split with a real
// capture of the article workflow) → mission row on a subtle
// warm band → story row → What we believe → customer
// testimonial section. The page closes on the customers
// section — the site footer provides the final navigation.
//
// Product-honest by construction: copy is adapted from the
// existing about texts; the story-row visuals are brand imagery
// and the publishing visual is a REAL capture of the running
// product (no invented people, history, customers, stats or
// claims). The testimonial section ships its carousel structure
// with an honest empty state until REAL customer data exists.
// ============================================================

import React from 'react';
import {
  BadgeCheck,
  Feather,
  Quote,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import {
  BrowserFrame,
  Eyebrow,
  PointList,
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

// -------------------- The publishing story --------------------
// Asymmetric editorial split: the publishing thesis and the real
// product capture of the article workflow (draft → review →
// scheduled → published). The capability list names the modules
// that actually ship — no invented features.

const PUBLISH_CAPABILITIES = [
  'mkt.about.pubCap1',
  'mkt.about.pubCap2',
  'mkt.about.pubCap3',
  'mkt.about.pubCap4',
  'mkt.about.pubCap5',
  'mkt.about.pubCap6',
];

function AboutPublish() {
  const { t } = useT();
  return (
    <section className="mkt-section" aria-labelledby="about-publish-heading">
      <div className="mkt-container">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Copy */}
          <div className="lg:col-span-5">
            <Reveal>
              <div className="flex flex-col items-start gap-5">
                <Eyebrow>{t('mkt.about.publishEyebrow')}</Eyebrow>
                <h2
                  id="about-publish-heading"
                  className="mkt-serif text-[1.875rem] font-bold leading-[1.12] text-text-primary sm:text-[2.375rem]"
                >
                  {t('mkt.about.missionHead')}
                </h2>
                <p className="text-base leading-relaxed text-text-secondary sm:text-[1.0625rem]">
                  {t('mkt.about.missionLead')}
                </p>
                <PointList points={PUBLISH_CAPABILITIES.map((key) => t(key))} />
              </div>
            </Reveal>
          </div>

          {/* Visual — the real article workflow inside the product */}
          <div className="lg:col-span-7">
            <Reveal delay={120}>
              <BrowserFrame
                src="/marketing/shot-articles.png"
                alt={`${t('mkt.about.publishShotLabel')} — ${t('mkt.brand.name')}`}
                label={t('mkt.about.publishShotLabel')}
              />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

// -------------------- Story figure --------------------
// Editorial brand imagery — generous rounding, hairline ring and
// a soft two-tier shadow (no invented people or milestones).

function StoryFigure({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="overflow-hidden rounded-[1.75rem] ring-1 ring-border shadow-[0_2px_8px_rgb(0_0_0/0.04),0_28px_72px_-28px_rgb(0_0_0/0.25)]">
      <img src={src} alt={alt} loading="lazy" decoding="async" className="h-auto w-full" width={1344} height={768} />
    </figure>
  );
}

// -------------------- Mission --------------------
// Two-column editorial row on a subtle warm band: brand imagery
// on one side, the mission statement on the other.

function AboutMission() {
  const { t } = useT();
  return (
    <section
      className="mkt-section border-y border-border bg-mkt-about-warm"
      aria-labelledby="about-mission-heading"
    >
      <div className="mkt-container">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <StoryFigure src="/marketing/about-studio.png" alt={t('mkt.about.studioAlt')} />
          </Reveal>
          <Reveal delay={100}>
            <div className="flex flex-col items-start gap-5">
              <Eyebrow>{t('mkt.about.missionTitle')}</Eyebrow>
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
      </div>
    </section>
  );
}

// -------------------- Story --------------------
// Mirrors the mission row with the image/text positions
// alternated — the classic editorial rhythm.

function AboutStory() {
  const { t } = useT();
  return (
    <section className="mkt-section" aria-labelledby="about-story-heading">
      <div className="mkt-container">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="flex flex-col items-start gap-5">
              <Eyebrow>{t('mkt.about.rowStoryEyebrow')}</Eyebrow>
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
// Four principle cards — subtle warm surfaces, thin borders,
// small icon containers with orange accents, equal heights.
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
    <section className="mkt-section pt-0" aria-labelledby="about-believe-heading">
      <div className="mkt-container">
        <Reveal>
          <SectionHeader
            id="about-believe-heading"
            eyebrow={t('mkt.about.believeEyebrow')}
            title={t('mkt.about.believeTitle')}
            subtitle={t('mkt.about.believeSubtitle')}
          />
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BELIEFS.map((belief, i) => {
            const Icon = belief.icon;
            return (
              <Reveal key={belief.titleKey} delay={i * 70}>
                <div className="mkt-card-hover h-full rounded-2xl border border-border bg-mkt-about-warm p-6 sm:p-7">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card text-mkt-accent shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
                    <Icon className="h-[1.1875rem] w-[1.1875rem]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-[0.9375rem] font-semibold text-text-primary">{t(belief.titleKey)}</h3>
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
// The testimonial carousel structure, fully wired. It renders
// ONLY real customer data — until such data exists the section
// shows an honest empty state instead of fabricated quotes.

const TESTIMONIALS: Testimonial[] = [];

function AboutCustomers() {
  const { t } = useT();
  return (
    <section className="border-y border-border bg-mkt-about-warm" aria-labelledby="about-customers-heading">
      <div className="mkt-container py-20 sm:py-28">
        <Reveal>
          <SectionHeader
            id="about-customers-heading"
            title={t('mkt.about.customersTitle')}
            subtitle={t('mkt.about.customersBody')}
          />
        </Reveal>
        <Reveal delay={100} className="mt-16">
          {TESTIMONIALS.length > 0 ? (
            <TestimonialCarousel testimonials={TESTIMONIALS} />
          ) : (
            /* Honest empty state — same card architecture as the
               carousel (badge overlapping the top border, quote,
               divider, attribution area) without any fabricated
               testimonial. */
            <figure className="relative mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl border border-border bg-card px-6 pb-10 pt-20 text-center shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_48px_-16px_rgb(0_0_0/0.14)] sm:px-12">
              <span className="absolute left-1/2 top-0 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-mkt-accent-soft ring-4 ring-card">
                <Quote className="h-8 w-8 text-mkt-accent-soft-fg" aria-hidden="true" />
              </span>
              <blockquote className="max-w-xl">
                <p className="text-lg leading-relaxed text-text-primary sm:text-xl">
                  {t('mkt.about.customersEmpty')}
                </p>
              </blockquote>
              <div className="mt-8 w-full border-t border-border pt-6">
                <p className="text-sm font-bold uppercase tracking-wider text-text-primary">
                  {t('mkt.brand.name')}
                </p>
                <p className="mt-1 text-sm text-text-secondary">{t('mkt.about.customersEmptyRole')}</p>
              </div>
            </figure>
          )}
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
      <AboutPublish />
      <AboutMission />
      <AboutStory />
      <AboutBeliefs />
      <AboutCustomers />
    </>
  );
}
