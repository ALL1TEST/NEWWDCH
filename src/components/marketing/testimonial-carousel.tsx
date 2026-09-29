'use client';

// ============================================================
// TESTIMONIAL CAROUSEL — customer-perspective slider
// ============================================================
// Premium card architecture: a single elevated white card whose
// circular avatar overlaps the top border (crossfading between
// slides), a centered quote, a hairline divider and the author
// block (uppercase name, role, company). Circular chevron
// controls flank the card (swipe below sm); dot pagination marks
// the active slide in brand orange.
//
// HONESTY RULE: this component renders ONLY the testimonials it
// is given. Callers must pass real customer data — never
// fabricated quotes, names or roles. Slides flagged with
// `demo: true` are rendered as clearly-marked placeholders
// (silhouette avatar + "Demo" chip) so sample content can never
// be mistaken for a real customer. With an empty list it renders
// nothing, so pages can show their own honest empty state instead.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, UserRound } from 'lucide-react';
import { useT } from '@/lib/i18n';

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** Company the customer works at (rendered under the role). */
  company?: string;
  /** Optional avatar image URL; falls back to styled initials. */
  avatar?: string;
  /** Marks the slide as placeholder content: silhouette avatar + "Demo" chip. */
  demo?: boolean;
}

const AUTO_ADVANCE_MS = 7000;
const AVATAR_SIZE = 96;

/** Circular avatar with a card-colored ring; real customers display photo, fallback to initials. */
function TestimonialAvatar({ testimonial }: { testimonial: Testimonial }) {
  if (testimonial.avatar) {
    return (
      <img
        src={testimonial.avatar}
        alt={testimonial.name}
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        loading="lazy"
        decoding="async"
        className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover ring-4 ring-card bg-card shadow-sm"
      />
    );
  }
  if (testimonial.demo) {
    return (
      <span
        aria-hidden="true"
        className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-mkt-accent-soft text-mkt-accent-soft-fg ring-4 ring-card shadow-sm"
      >
        <UserRound className="h-9 w-9 sm:h-11 sm:w-11" />
      </span>
    );
  }
  const initials = testimonial.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return (
    <span
      aria-hidden="true"
      className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-mkt-accent-soft text-xl font-bold text-mkt-accent-soft-fg ring-4 ring-card shadow-sm"
    >
      {initials}
    </span>
  );
}

export function TestimonialCarousel({
  testimonials,
  autoAdvanceMs = AUTO_ADVANCE_MS,
}: {
  testimonials: Testimonial[];
  autoAdvanceMs?: number;
}) {
  const { t } = useT();
  const count = testimonials.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const swipeStartX = useRef<number | null>(null);

  const go = useCallback(
    (target: number) => {
      setIndex(((target % count) + count) % count);
    },
    [count],
  );

  // Autoplay — stops while hovering/focused, restarts after.
  useEffect(() => {
    if (paused || count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, autoAdvanceMs);
    return () => window.clearInterval(id);
  }, [paused, count, autoAdvanceMs]);

  // Pointer swipe — refs are only touched inside handlers.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swipeStartX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const startX = swipeStartX.current;
    swipeStartX.current = null;
    if (startX === null || count <= 1) return;
    const delta = e.clientX - startX;
    if (Math.abs(delta) < 40) return;
    setIndex((i) => (delta < 0 ? (i + 1) % count : (i - 1 + count) % count));
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (count <= 1) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIndex((i) => (i + 1) % count);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIndex((i) => (i - 1 + count) % count);
    }
  };

  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={t('mkt.about.carouselLabel')}
      className="group/carousel relative mx-auto w-full max-w-2xl px-2 sm:px-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Container with top spacing so the overlapping avatar is never clipped */}
      <div className="relative pt-10 sm:pt-12">
        {/* Avatar overlapping the top border — crossfades per slide */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-20 w-20 sm:h-24 sm:w-24 -translate-x-1/2">
          {testimonials.map((testimonial, i) => (
            <span
              key={`avatar-${testimonial.name}-${i}`}
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 motion-reduce:transition-none ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <TestimonialAvatar testimonial={testimonial} />
            </span>
          ))}
        </div>

        {/* Card — single frame, content slides inside */}
        <div
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border bg-card shadow-[0_1px_3px_rgb(0_0_0/0.04)]"
          aria-live="polite"
        >
          {/* Slides */}
          <div
            className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {testimonials.map((testimonial, i) => (
              <figure
                key={`${testimonial.name}-${i}`}
                className="w-full shrink-0 grow-0 basis-full"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${count}`}
                aria-hidden={i !== index}
              >
                <div className="flex h-full flex-col items-center px-6 pb-8 pt-16 text-center sm:px-14 sm:pb-10 sm:pt-20">
                  <blockquote className="max-w-xl">
                    <p className="text-base sm:text-lg leading-relaxed text-text-primary">
                      “{testimonial.quote}”
                    </p>
                  </blockquote>
                  <figcaption className="mt-6 w-full border-t border-border pt-6">
                    <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-text-primary">
                      {testimonial.name}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm text-text-secondary">
                      {testimonial.role}
                    </p>
                    {testimonial.company && (
                      <p className="mt-0.5 text-xs sm:text-sm text-text-secondary">{testimonial.company}</p>
                    )}
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        </div>

        {/* Circular chevron controls flanking the card */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={t('mkt.about.carouselPrev')}
              className="mkt-focus absolute -left-4 sm:-left-6 top-1/2 z-30 hidden h-10 w-10 sm:h-11 sm:w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all duration-200 hover:border-text-secondary/40 hover:text-text-primary sm:flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={t('mkt.about.carouselNext')}
              className="mkt-focus absolute -right-4 sm:-right-6 top-1/2 z-30 hidden h-10 w-10 sm:h-11 sm:w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all duration-200 hover:border-text-secondary/40 hover:text-text-primary sm:flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Dots (circular, active dark charcoal/black, inactive light gray like in Image 4) */}
      {count > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {testimonials.map((testimonial, i) => (
            <button
              key={`dot-${testimonial.name}-${i}`}
              type="button"
              onClick={() => go(i)}
              aria-label={`${t('mkt.about.carouselGoTo')} ${i + 1}`}
              aria-current={i === index}
              className={`mkt-focus h-2.5 w-2.5 rounded-full transition-all duration-200 ${
                i === index
                  ? 'bg-text-primary scale-110'
                  : 'bg-border hover:bg-muted-foreground/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
