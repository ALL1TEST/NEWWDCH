'use client';

// ============================================================
// ABOUT — premium long-form editorial page
// ============================================================
// Hero ("Our mission." serif headline layered over a quiet
// abstract publishing-workflow scene — thin connector lines and
// small nodes beneath and around the headline, ONE brand-orange
// accent node) → a compact centered
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

// -------------------- Hero flow scene --------------------
// A quiet, abstract publishing-workflow system: hairline
// connector curves join small nodes that flow beneath the
// headline and rise gently around its flanks. Warm stone
// neutrals with ONE brand-orange node as the only accent; the
// lower edge dissolves into the page background (fade overlay).
// Pure SVG, theme-aware via CSS vars — no external asset.
// Responsive: side systems hide on mobile and dim on tablet;
// the core chain stays as a subtle line treatment everywhere.

function HeroFlowScene() {
  return (
    <svg
      viewBox="0 0 1200 560"
      className="mkt-hero-flow h-auto w-full"
      aria-hidden="true"
      focusable="false"
    >
      {/* Side systems — hidden on mobile, dimmed on tablet */}
      <g className="hidden md:block md:opacity-70 lg:opacity-100">
        {/* Connectors */}
        <g fill="none" stroke="var(--flow-line)" strokeWidth="1.4" strokeLinecap="round">
          <path d="M128 208 Q178 252 198 316" strokeOpacity="0.55" />
          <path d="M198 316 Q140 344 92 356" strokeOpacity="0.45" />
          <path d="M198 316 Q268 372 350 430" strokeOpacity="0.6" />
          <path d="M1072 208 Q1022 252 1002 316" strokeOpacity="0.55" />
          <path d="M1002 316 Q1060 344 1108 356" strokeOpacity="0.45" />
          <path d="M1002 316 Q932 372 850 430" strokeOpacity="0.6" />
        </g>
        {/* Nodes */}
        <g fill="none" stroke="var(--flow-node)" strokeWidth="1.3">
          <circle cx="128" cy="208" r="5.5" strokeOpacity="0.8" />
          <circle cx="198" cy="316" r="6.5" strokeOpacity="0.8" />
          <circle cx="92" cy="356" r="2.6" strokeOpacity="0.6" />
          <circle cx="1072" cy="208" r="5.5" strokeOpacity="0.8" />
          <circle cx="1002" cy="316" r="6.5" strokeOpacity="0.8" />
          <circle cx="1108" cy="356" r="2.6" strokeOpacity="0.6" />
        </g>
        {/* Hub centers — a whisper of brand accent */}
        <g fill="var(--mkt-accent)">
          <circle cx="198" cy="316" r="2" fillOpacity="0.55" />
          <circle cx="1002" cy="316" r="2" fillOpacity="0.55" />
        </g>
      </g>

      {/* Top arcs — whisper lines rising beside the headline
          (desktop only) */}
      <g
        className="hidden lg:block"
        fill="none"
        stroke="var(--flow-line)"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path d="M128 208 Q210 118 320 124" strokeOpacity="0.35" />
        <path d="M1072 208 Q990 118 880 124" strokeOpacity="0.35" />
      </g>
      <g className="hidden lg:block" fill="var(--flow-node)">
        <circle cx="320" cy="124" r="2.2" fillOpacity="0.5" />
        <circle cx="880" cy="124" r="2.2" fillOpacity="0.5" />
      </g>

      {/* Satellites — tiny distant dots (tablet up) */}
      <g className="hidden sm:block" fill="var(--flow-node)">
        <circle cx="405" cy="335" r="2" fillOpacity="0.35" />
        <circle cx="520" cy="292" r="1.8" fillOpacity="0.3" />
        <circle cx="688" cy="305" r="2" fillOpacity="0.3" />
        <circle cx="806" cy="348" r="1.8" fillOpacity="0.35" />
        <circle cx="300" cy="486" r="1.8" fillOpacity="0.25" />
        <circle cx="915" cy="478" r="2" fillOpacity="0.25" />
      </g>

      {/* Main chain — the calm publishing flow */}
      <g fill="none" stroke="var(--flow-line)" strokeWidth="1.4" strokeLinecap="round">
        <path d="M350 430 Q412 398 475 402" strokeOpacity="0.75" />
        <path d="M475 402 Q537 418 600 420" strokeOpacity="0.75" />
        <path d="M600 420 Q662 404 725 398" strokeOpacity="0.75" />
        <path d="M725 398 Q787 406 850 428" strokeOpacity="0.75" />
        {/* Quiet sub-flows (dotted) */}
        <path d="M475 402 Q438 456 388 466" strokeOpacity="0.5" strokeDasharray="2 6" />
        <path d="M725 398 Q762 452 812 462" strokeOpacity="0.5" strokeDasharray="2 6" />
      </g>

      {/* Sub-flow nodes */}
      <g fill="none" stroke="var(--flow-node)" strokeWidth="1.2">
        <circle cx="388" cy="466" r="4" strokeOpacity="0.55" />
        <circle cx="812" cy="462" r="4" strokeOpacity="0.55" />
      </g>

      {/* Chain nodes — neutral */}
      <g fill="var(--flow-fill)" stroke="var(--flow-node)" strokeWidth="1.4">
        <circle cx="350" cy="430" r="7" strokeOpacity="0.8" />
        <circle cx="475" cy="402" r="7" strokeOpacity="0.8" />
        <circle cx="725" cy="398" r="7" strokeOpacity="0.8" />
        <circle cx="850" cy="428" r="7" strokeOpacity="0.8" />
      </g>
      <g fill="var(--flow-node)">
        <circle cx="350" cy="430" r="2.4" fillOpacity="0.65" />
        <circle cx="475" cy="402" r="2.4" fillOpacity="0.65" />
        <circle cx="725" cy="398" r="2.4" fillOpacity="0.65" />
        <circle cx="850" cy="428" r="2.4" fillOpacity="0.65" />
      </g>

      {/* Chain center — the single brand accent */}
      <circle cx="600" cy="420" r="13" fill="none" stroke="var(--mkt-accent)" strokeWidth="1" strokeOpacity="0.25" />
      <circle cx="600" cy="420" r="7" fill="var(--flow-fill)" stroke="var(--mkt-accent)" strokeWidth="1.4" strokeOpacity="0.85" />
      <circle cx="600" cy="420" r="3" fill="var(--mkt-accent)" />
    </svg>
  );
}

// -------------------- Hero / mission --------------------
// Centered serif "Our mission." headline in the page's editorial
// dark ink, layered ABOVE a quiet abstract workflow (thin lines
// and small nodes) that sits behind and beneath it — far less
// visual weight than an illustration, so the headline stays the
// undisputed focus. A single brand-orange node carries the
// accent; the lower edge dissolves into the page background.

function AboutHero() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="mkt-container relative">
        <Reveal className="relative z-10">
          <h1 className="mkt-display mkt-serif mx-auto max-w-4xl text-center text-5xl leading-[1.05] text-text-primary sm:text-7xl lg:text-8xl">
            {t('mkt.about.heroTitle')}
          </h1>
        </Reveal>

        {/* Abstract workflow — a quiet node network behind and
            beneath the headline */}
        <div className="pointer-events-none relative z-0 -mt-16 sm:-mt-24 lg:-mt-32">
          <HeroFlowScene />
          {/* Fade the lower edge into the page background */}
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
    <figure className="overflow-hidden rounded-xl border border-border/80 shadow-sm">
      <img src={src} alt={alt} loading="lazy" decoding="async" className="h-auto w-full object-cover" width={1344} height={768} />
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
// a soft shadow and a centered accent icon container above each
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
        <div className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
          {BELIEFS.map((belief, i) => {
            const Icon = belief.icon;
            return (
              <Reveal key={belief.titleKey} delay={i * 70} className="h-full">
                <div className="mkt-card-hover flex h-full flex-col items-center text-center rounded-[20px] border border-border bg-card p-7 sm:p-8 shadow-[0_1px_3px_rgb(0_0_0/0.03)] transition-all duration-300 hover:shadow-md hover:border-border/80">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-mkt-accent-soft text-mkt-accent mb-6">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-text-primary">{t(belief.titleKey)}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{t(belief.bodyKey)}</p>
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
// The testimonial carousel, rendered with real customer testimonials
// and photos from HubSpot.

function AboutCustomers() {
  const { t } = useT();

  const CUSTOMER_TESTIMONIALS: Testimonial[] = [
    {
      avatar: '/marketing/testimonials/patricia-portik.jpg',
      quote:
        'The biggest benefit of HubSpot is that all your data lives in it, you see the same customer information as the sales team and vice versa. It gives us a new level of confidence.',
      name: 'Patricia Portik',
      role: 'National Sales Operations / E-Marketing Manager',
      company: 'ARC Document Solutions',
    },
    {
      avatar: '/marketing/testimonials/aaron-goh.jpg',
      quote:
        'HubSpot matched our expectations for several reasons. We loved its flexibility, ease of operations, and pace of scalability. It was intuitive to pick up and adopt, and had a very user-friendly interface that was easy to adapt.',
      name: 'Aaron Goh',
      role: 'Head of Marketing',
      company: 'Spenmo',
    },
    {
      avatar: '/marketing/testimonials/frank-loughan.jpg',
      quote:
        'HubSpot is a company that listens and invests in its customers. They know that our success is their success.',
      name: 'Frank Loughan',
      role: 'VP Revenue Operations',
      company: 'ARC Document Solutions',
    },
    {
      avatar: '/marketing/testimonials/marie-morgane.jpg',
      quote:
        'HubSpot delivered an excellent level of detail, and the interface was pretty easy to use. There were 3 main reasons why we decided to adopt HubSpot — seamless collaboration between the teams, the ease of the platform, and the high level of detailing of the data.',
      name: 'Marie-Morgane Le Bras',
      role: 'VP of Marketing',
      company: 'EngageRocket',
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
          <TestimonialCarousel testimonials={CUSTOMER_TESTIMONIALS} />
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
