'use client';

// ============================================================
// ABOUT — premium long-form editorial page
// ============================================================
// Mission hero ("Our mission." gradient headline over an original
// mountain scene with the Karmax flag at the summit) → mission
// statement → alternating story/mission split rows → What we
// believe → customer testimonial carousel → dark final CTA.
//
// Product-honest by construction: copy is adapted from the
// existing about texts; the story-row visuals are brand imagery
// (no invented people, history, customers, stats or claims).
// The testimonial section ships its carousel structure with an
// honest empty state until REAL customer data exists.
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
  Eyebrow,
  Logo,
  MarketingButton,
  Reveal,
  SectionHeader,
} from './primitives';
import { MKT } from './marketing-header';
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
// Centered serif "Our mission." with the brand gradient; the
// mountain rises IN FRONT of the headline's lower portion
// (depth effect), then the mission statement lands below.

function AboutHero() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="mkt-container relative">
        <Reveal>
          <h1 className="mkt-display mkt-serif relative z-10 mx-auto max-w-4xl text-center text-5xl leading-[1.05] sm:text-7xl lg:text-8xl">
            <span className="bg-gradient-to-r from-[#3B82F6] via-[#EC4899] to-[#FF4800] bg-clip-text text-transparent">
              {t('mkt.about.heroTitle')}
            </span>
          </h1>
        </Reveal>

        {/* Mountain scene — summit overlaps the headline bottom */}
        <div className="pointer-events-none relative z-20 -mt-16 sm:-mt-24 lg:-mt-32">
          <MountainScene />
          {/* Fade the base into the page background */}
          <div className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-b from-transparent to-background" />
        </div>

        {/* Mission statement */}
        <Reveal delay={120}>
          <div className="relative z-10 mx-auto -mt-10 flex max-w-2xl flex-col items-center gap-5 text-center sm:-mt-16">
            <h2 className="mkt-serif text-2xl font-bold text-text-primary sm:text-[2rem]">
              {t('mkt.about.missionHead')}
            </h2>
            <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
              {t('mkt.about.missionLead')}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// -------------------- Story & mission split rows --------------------
// Editorial alternating photo + text rows. The visuals are brand
// imagery (generated illustrations of the workspace and a team
// at work) — no invented people, names or milestones.

function StoryFigure({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="overflow-hidden rounded-[1.5rem] shadow-[0_2px_8px_rgb(0_0_0/0.05),0_24px_64px_-24px_rgb(0_0_0/0.22)]">
      <img src={src} alt={alt} loading="lazy" decoding="async" className="h-auto w-full" width={1344} height={768} />
    </figure>
  );
}

function AboutStoryRows() {
  const { t } = useT();
  return (
    <section className="mkt-section" aria-label={t('mkt.about.rowsLabel')}>
      <div className="mkt-container flex flex-col gap-20 sm:gap-28">
        {/* Row 1 — mission: image left, text right */}
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <StoryFigure src="/marketing/about-studio.png" alt={t('mkt.about.studioAlt')} />
          </Reveal>
          <Reveal delay={100}>
            <div className="flex flex-col items-start gap-5">
              <Eyebrow>{t('mkt.about.missionTitle')}</Eyebrow>
              <h2 className="mkt-serif text-[1.75rem] font-bold leading-[1.15] text-text-primary sm:text-[2.125rem]">
                {t('mkt.about.rowMissionTitle')}
              </h2>
              <p className="text-base leading-relaxed text-text-secondary">{t('mkt.about.rowMissionBody1')}</p>
              <p className="text-base leading-relaxed text-text-secondary">{t('mkt.about.rowMissionBody2')}</p>
            </div>
          </Reveal>
        </div>

        {/* Row 2 — story: text left, image right */}
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="flex flex-col items-start gap-5 lg:order-first">
              <Eyebrow>{t('mkt.about.rowStoryEyebrow')}</Eyebrow>
              <h2 className="mkt-serif text-[1.75rem] font-bold leading-[1.15] text-text-primary sm:text-[2.125rem]">
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
// 4 principle cards — subtle borders, small icons, concise
// descriptions.

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
                <div className="mkt-card-hover h-full rounded-2xl border border-border bg-mkt-about-warm p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-mkt-accent shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-text-primary">{t(belief.titleKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t(belief.bodyKey)}</p>
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
               carousel (avatar overlapping the top border, quote,
               author area) without any fabricated testimonial. */
            <figure className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-5 rounded-3xl border border-border bg-card px-6 pb-9 pt-16 text-center shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_40px_-12px_rgb(0_0_0/0.12)] sm:px-12">
              <span className="absolute left-1/2 top-0 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-mkt-accent-soft ring-4 ring-card">
                <Quote className="h-8 w-8 text-mkt-accent-soft-fg" aria-hidden="true" />
              </span>
              <blockquote className="max-w-xl">
                <p className="text-base leading-relaxed text-text-primary sm:text-lg">
                  {t('mkt.about.customersEmpty')}
                </p>
              </blockquote>
              <div className="mt-2 w-full border-t border-border pt-5">
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
            <h2 id="about-cta-heading" className="mkt-h2 text-[1.75rem] text-mkt-footer-heading sm:text-4xl">
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
      <AboutStoryRows />
      <AboutBeliefs />
      <AboutCustomers />
      <AboutCta />
    </>
  );
}
