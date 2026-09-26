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
const AVATAR_SIZE = 80;

/** Circular avatar with a card-colored ring; demo slides use a
    neutral silhouette, real customers fall back to initials. */
function TestimonialAvatar({ testimonial }: { testimonial: Testimonial }) {
  if (testimonial.demo) {
    return (
      <span
        aria-hidden="true"
        className="flex h-20 w-20 items-center justify-center rounded-full bg-mkt-accent-soft text-mkt-accent-soft-fg ring-4 ring-card"
      >
        <UserRound className="h-9 w-9" />
      </span>
    );
  }
  if (testimonial.avatar) {
    return (
      <img
        src={testimonial.avatar}
        alt=""
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        loading="lazy"
        decoding="async"
        className="h-20 w-20 rounded-full object-cover ring-4 ring-card"
      />
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
      className="flex h-20 w-20 items-center justify-center rounded-full bg-mkt-accent-soft text-xl font-bold text-mkt-accent-soft-fg ring-4 ring-card"
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
      className="group/carousel relative mx-auto w-full max-w-2xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Card — single frame, content slides inside */}
      <div
        className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_40px_-12px_rgb(0_0_0/0.12)]"
        aria-live="polite"
      >
        {/* Demo chip — clearly marks placeholder slides */}
        {testimonials[index]?.demo && (
          <span className="absolute right-4 top-4 z-10 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('mkt.about.demoBadge')}
          </span>
        )}

        {/* Avatar overlapping the top border — crossfades per slide */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-20 w-20 -translate-x-1/2 -translate-y-1/2">
          {testimonials.map((testimonial, i) => (
            <span
              key={`avatar-${testimonial.name}-${i}`}
              className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <TestimonialAvatar testimonial={testimonial} />
            </span>
          ))}
        </div>

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
              <div className="flex h-full flex-col items-center gap-6 px-6 pb-8 pt-16 text-center sm:px-12 sm:pt-20">
                <blockquote className="max-w-xl">
                  <p className="text-base leading-relaxed text-text-primary sm:text-lg">
                    “{testimonial.quote}”
                  </p>
                </blockquote>
                <figcaption className="w-full border-t border-border pt-5">
                  <p className="text-sm font-bold uppercase tracking-wider text-text-primary">
                    {testimonial.name}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-text-secondary">
                    {testimonial.role}
                  </p>
                  {testimonial.company && (
                    <p className="text-sm leading-snug text-text-secondary">{testimonial.company}</p>
                  )}
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>

      {/* Circular chevron controls — always visible on pointer
          screens (hidden below sm: touch devices swipe instead),
          always keyboard-safe. */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={t('mkt.about.carouselPrev')}
            className="mkt-focus absolute -left-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-[0_1px_3px_rgb(0_0_0/0.08)] transition-colors duration-200 hover:border-muted-foreground/40 hover:text-text-primary sm:flex sm:-left-5"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={t('mkt.about.carouselNext')}
            className="mkt-focus absolute -right-4 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-[0_1px_3px_rgb(0_0_0/0.08)] transition-colors duration-200 hover:border-muted-foreground/40 hover:text-text-primary sm:flex sm:-right-5"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      )}

      {/* Dots */}
      {count > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2.5">
          {testimonials.map((testimonial, i) => (
            <button
              key={`dot-${testimonial.name}-${i}`}
              type="button"
              onClick={() => go(i)}
              aria-label={`${t('mkt.about.carouselGoTo')} ${i + 1}`}
              aria-current={i === index}
              className={`mkt-focus h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                i === index
                  ? 'w-6 bg-mkt-accent'
                  : 'w-2.5 bg-border hover:bg-muted-foreground/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
