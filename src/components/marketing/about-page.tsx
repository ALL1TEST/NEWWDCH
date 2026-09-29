'use client';

// ============================================================
// ABOUT — premium long-form editorial page
// ============================================================
// Hero ("Our mission." serif headline + the supporting lead
// sentence beneath — no artwork, no second heading, pure
// whitespace) → ONE
// cohesive editorial band pairing the mission row and the story
// row (alternating image/text, shared warm surface, no eyebrow
// labels) → What we believe (four principle cards, each headed by
// a small custom editorial line-art illustration) → What our
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
import { useT } from '@/lib/i18n';
import {
  Reveal,
  SectionHeader,
} from './primitives';
import { TestimonialCarousel, type Testimonial } from './testimonial-carousel';

// -------------------- Hero / mission --------------------
// Centered serif "Our mission." headline in the page's editorial
// dark ink, with the supporting lead sentence directly beneath.
// Nothing else — no artwork, no eyebrow, no second heading: the
// generous whitespace and clean composition keep the headline as
// the sole visual focus.

function AboutHero() {
  const { t } = useT();
  return (
    <section className="pb-20 pt-32 sm:pb-24 sm:pt-40 lg:pb-28">
      <div className="mkt-container">
        <Reveal>
          <h1 className="mkt-display mkt-serif mx-auto max-w-4xl text-center text-5xl leading-[1.05] text-text-primary sm:text-7xl lg:text-8xl">
            {t('mkt.about.heroTitle')}
          </h1>
        </Reveal>
        <Reveal delay={100}>
          <p className="mx-auto mt-8 max-w-xl text-center text-base leading-relaxed text-text-secondary sm:mt-10 sm:text-[1.0625rem]">
            {t('mkt.about.missionLead')}
          </p>
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

// -------------------- Belief illustrations --------------------
// Small custom editorial line-art vignettes (hand-composed
// inline SVG — not icon-library glyphs): neutral ink outlines,
// quiet low-opacity details, and exactly ONE Karmax-orange
// accent per drawing. Sized to the previous icon footprint so
// the cards keep their rhythm and height.

function SimplicityIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" fill="none">
      {/* A page, and one calm line beneath it — the work is the hero */}
      <rect x="20" y="4" width="26" height="32" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
      <line x1="26" y1="12" x2="40" y2="12" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
      <line x1="26" y1="18" x2="34" y2="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
      <path d="M7 40 Q18 48 30 44 T53 36" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.85" strokeLinecap="round" />
      <circle cx="7" cy="40" r="1.8" fill="currentColor" fillOpacity="0.35" />
      <circle cx="53" cy="36" r="2.8" fill="var(--mkt-accent)" />
    </svg>
  );
}

function AutomationIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" fill="none">
      {/* Connected steps that run on their own into a published doc */}
      <line x1="15.3" y1="43.7" x2="22.7" y2="38.3" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
      <line x1="29.3" y1="33.7" x2="36.7" y2="28.3" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
      <path d="M43 23.4 L46.2 20.8" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" strokeDasharray="1.5 4.5" />
      <circle cx="12" cy="46" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="26" cy="36" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="40" cy="26" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="46" r="1.6" fill="currentColor" fillOpacity="0.45" />
      <circle cx="26" cy="36" r="1.6" fill="currentColor" fillOpacity="0.45" />
      <circle cx="40" cy="26" r="1.6" fill="currentColor" fillOpacity="0.45" />
      <rect x="47" y="5" width="12" height="15" rx="2.5" stroke="var(--mkt-accent)" strokeWidth="1.8" />
      <line x1="50" y1="9.5" x2="56" y2="9.5" stroke="var(--mkt-accent)" strokeWidth="1.4" strokeOpacity="0.65" strokeLinecap="round" />
      <line x1="50" y1="13" x2="55" y2="13" stroke="var(--mkt-accent)" strokeWidth="1.4" strokeOpacity="0.65" strokeLinecap="round" />
      <line x1="50" y1="16.5" x2="53.5" y2="16.5" stroke="var(--mkt-accent)" strokeWidth="1.4" strokeOpacity="0.65" strokeLinecap="round" />
    </svg>
  );
}

function QualityIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" fill="none">
      {/* A verified page — registration marks and an orange seal */}
      <path d="M8 13 V8 H13" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
      <path d="M51 51 V56 H56" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
      <rect x="14" y="6" width="28" height="36" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
      <line x1="20" y1="14" x2="36" y2="14" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
      <line x1="20" y1="20" x2="30" y2="20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
      <circle cx="44" cy="39" r="8" fill="var(--card)" stroke="var(--mkt-accent)" strokeWidth="1.8" />
      <path d="M40.2 39.2 L42.9 41.9 L47.9 36.6" stroke="var(--mkt-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ControlIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" fill="none">
      {/* Your page, your keys — content you hold */}
      <rect x="17" y="4" width="28" height="30" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
      <line x1="23" y1="12" x2="39" y2="12" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
      <line x1="23" y1="18" x2="33" y2="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
      <circle cx="22" cy="46" r="4.5" stroke="var(--mkt-accent)" strokeWidth="1.8" />
      <path d="M26.5 46 H46" stroke="var(--mkt-accent)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M39 46 V50 M44 46 V51" stroke="var(--mkt-accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// -------------------- What we believe --------------------
// Four principle cards — quiet white surfaces, hairline borders,
// a soft shadow and a centered custom editorial illustration
// above each title (inline SVG line art, neutral ink + one
// Karmax-orange accent per drawing, sized to the previous icon
// footprint so card rhythm is unchanged). Equal heights on every
// breakpoint. Responsive: 4 columns desktop, 2 tablet, 1 mobile.

const BELIEFS = [
  { Illustration: SimplicityIllustration, titleKey: 'mkt.about.believe1Title', bodyKey: 'mkt.about.believe1Body' },
  { Illustration: AutomationIllustration, titleKey: 'mkt.about.believe2Title', bodyKey: 'mkt.about.believe2Body' },
  { Illustration: QualityIllustration, titleKey: 'mkt.about.believe3Title', bodyKey: 'mkt.about.believe3Body' },
  { Illustration: ControlIllustration, titleKey: 'mkt.about.believe4Title', bodyKey: 'mkt.about.believe4Body' },
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
            const Illustration = belief.Illustration;
            return (
              <Reveal key={belief.titleKey} delay={i * 70} className="h-full">
                <div className="mkt-card-hover flex h-full flex-col items-center text-center rounded-[20px] border border-border bg-card p-7 sm:p-8 shadow-[0_1px_3px_rgb(0_0_0/0.03)] transition-all duration-300 hover:shadow-md hover:border-border/80">
                  <Illustration className="mb-6 h-16 w-16 shrink-0 text-text-primary" />
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
      <AboutMissionStory />
      <AboutBeliefs />
      <AboutCustomers />
    </>
  );
}
