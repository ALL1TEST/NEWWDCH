'use client';

// ============================================================
// SOLUTION HERO — VIDEO PREVIEW (HubSpot-style)
// ============================================================
// Product-video preview card for the solution page heroes.
// There is no marketing demo video in the product today, so
// this is an honest placeholder built exclusively from the
// REAL captured product screenshots already shipped in
// /marketing/shot-*.png (the same assets the page's product
// stories use):
//
//   - large rounded video container, real product visual
//   - darkened preview overlay + clearly centered play button
//   - clicking opens a lightbox showing the full-size capture
//     (real behavior — never a fake or broken video source)
//
// When a real demo video exists, swap the lightbox body for a
// <video> element — the hero layout needs no changes.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { BrowserFrame } from './primitives';

interface SolutionVideoPreviewProps {
  /** Real product screenshot used as the preview poster. */
  poster: string;
  /** Solution name — used for accessible labels. */
  title: string;
  /** Optional chip label shown in the lightbox window chrome. */
  label?: string;
  /** Layout tweaks from the hero grid (width caps). */
  className?: string;
}

export function SolutionVideoPreview({ poster, title, label, className = '' }: SolutionVideoPreviewProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // ---- Lightbox: Escape to close + scroll lock ----
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    // The marketing site scrolls inside .mkt-scroll-root (the
    // dashboard shell locks html/body) — lock both to be safe.
    const body = document.body;
    const root = document.querySelector('.mkt-scroll-root') as HTMLElement | null;
    const prevBody = body.style.overflow;
    const prevRoot = root?.style.overflow ?? '';
    body.style.overflow = 'hidden';
    if (root) root.style.overflow = 'hidden';

    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.overflow = prevBody;
      if (root) root.style.overflow = prevRoot;
      // Return focus to the trigger for keyboard users.
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <div className={className}>
      {/* -------------------- Video card (trigger) -------------------- */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${t('mkt.solp.openPreview')} — ${title}`}
        className="mkt-card-hover mkt-focus group relative block w-full overflow-hidden rounded-[2rem] border border-border bg-mkt-surface text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_48px_-16px_rgb(0_0_0/0.18)]"
      >
        {/* Real product capture */}
        <span className="block aspect-[16/10] w-full">
          <img
            src={poster}
            alt=""
            loading="eager"
            draggable={false}
            className="h-full w-full select-none object-cover object-left-top"
          />
        </span>

        {/* Darkened preview overlay */}
        <span
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/5"
          aria-hidden="true"
        />

        {/* Centered play button */}
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-[0_10px_36px_rgb(0_0_0/0.4)] ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-[1.06] group-active:scale-95">
            {/* soft halo */}
            <span className="absolute -inset-3 rounded-full border border-white/35" />
            <Play className="h-8 w-8 translate-x-[3px] text-mkt-accent" fill="currentColor" strokeWidth={0} />
          </span>
        </span>

        {/* Bottom-left preview chip */}
        <span
          className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/55 py-1.5 pl-3 pr-3.5 text-xs font-medium text-white backdrop-blur-sm"
          aria-hidden="true"
        >
          <Play className="h-3 w-3" fill="currentColor" strokeWidth={0} />
          {t('mkt.solp.previewChip')}
        </span>
      </button>

      {/* -------------------- Lightbox -------------------- */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${t('mkt.solp.openPreview')} — ${title}`}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-5xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('mkt.solp.closePreview')}
              className="mkt-focus absolute -top-3 -right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-900 shadow-[0_6px_24px_rgb(0_0_0/0.35)] ring-1 ring-black/5 transition-transform hover:scale-105 active:scale-95"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <BrowserFrame
              src={poster}
              alt={`${title} — ${t('mkt.brand.name')}`}
              label={label}
            />
          </div>
        </div>
      )}
    </div>
  );
}
