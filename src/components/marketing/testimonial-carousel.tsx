'use client';

// ============================================================
// TESTIMONIAL CAROUSEL — customer-perspective slider
// ============================================================
// Data-driven carousel: avatar, quote, name and role per slide,
// prev/next buttons, dot indicators, autoplay (paused on hover
// and focus), pointer swipe and full keyboard access.
//
// HONESTY RULE: this component renders ONLY the testimonials it
// is given. Callers must pass real customer data — never
// fabricated quotes, names or roles. With an empty list it
// renders nothing, so pages can show their own honest empty
// state instead.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useT } from '@/lib/i18n';

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** Optional avatar image URL; falls back to styled initials. */
  avatar?: string;
}

const AUTO_ADVANCE_MS = 7000;

/** Initials circle used when no avatar image is provided. */
function TestimonialAvatar({ testimonial }: { testimonial: Testimonial }) {
  if (testimonial.avatar) {
    return (
      <img
        src={testimonial.avatar}
        alt=""
        width={48}
        height={48}
        loading="lazy"
        decoding="async"
        className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
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
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mkt-accent-soft text-base font-bold text-mkt-accent-soft-fg"
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
      className="mx-auto w-full max-w-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Slides */}
      <div
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_40px_-12px_rgb(0_0_0/0.12)]"
        aria-live="polite"
      >
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
              <div className="flex flex-col items-center gap-6 px-6 py-12 text-center sm:px-12 sm:py-16">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mkt-accent-soft text-mkt-accent-soft-fg"
                  aria-hidden="true"
                >
                  <Quote className="h-6 w-6" />
                </span>
                <blockquote className="max-w-2xl">
                  <p className="text-lg leading-relaxed text-text-primary sm:text-xl">
                    “{testimonial.quote}”
                  </p>
                </blockquote>
                <figcaption className="flex items-center gap-3.5">
                  <TestimonialAvatar testimonial={testimonial} />
                  <span className="flex flex-col items-start text-left">
                    <span className="text-sm font-bold text-text-primary">{testimonial.name}</span>
                    <span className="text-sm text-text-secondary">{testimonial.role}</span>
                  </span>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={count <= 1}
          aria-label={t('mkt.about.carouselPrev')}
          className="mkt-focus flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-text-secondary transition-colors hover:border-muted-foreground/50 hover:text-text-primary disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2.5">
          {testimonials.map((testimonial, i) => (
            <button
              key={`dot-${testimonial.name}-${i}`}
              type="button"
              onClick={() => go(i)}
              aria-label={`${t('mkt.about.carouselGoTo')} ${i + 1}`}
              aria-current={i === index}
              className={`mkt-focus h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                i === index ? 'w-6 bg-mkt-accent' : 'w-2.5 bg-border hover:bg-muted-foreground/40'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={count <= 1}
          aria-label={t('mkt.about.carouselNext')}
          className="mkt-focus flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-text-secondary transition-colors hover:border-muted-foreground/50 hover:text-text-primary disabled:opacity-40"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
