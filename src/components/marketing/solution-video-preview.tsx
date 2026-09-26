'use client';

// ============================================================
// SOLUTION HERO — VIDEO PLAYER
// ============================================================
// Full player for the solution page heroes. Plays the real
// Karmax demo video (public/marketing/hero-demo.mp4) inline
// with a clean, minimal, professional control set:
//
//   - Play / Pause (center overlay while paused + bar button)
//   - Seekable progress/timeline bar with buffered indicator
//   - Current time / total duration
//   - Volume / mute (hover-expand slider)
//   - Settings (⚙) menu — playback speed (0.5×–2×) and
//     quality (Auto / 720p, the shipped rendition)
//   - Fullscreen (button + double-click)
//   - Keyboard: Space/K play·pause · ←/→ ±5s · J/L ±10s ·
//     ↑/↓ volume · M mute · F fullscreen · Esc close menu
//
// Controls visibility is pointer-driven, like modern SaaS
// players: hidden by default, shown while hovering the video
// (or while seeking / the settings menu is open / the player
// has keyboard focus). The poster is the solution's real
// product capture, so the card looks identical until played.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

const DEMO_VIDEO = '/marketing/hero-demo.mp4';
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
/** Renditions shipped with the demo file (single 720p H.264). */
const QUALITIES = ['auto', '720p'] as const;
type Quality = (typeof QUALITIES)[number];

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface SolutionVideoPreviewProps {
  /** Real product screenshot used as the player poster. */
  poster: string;
  /** Solution name — used for accessible labels. */
  title: string;
  /** Layout tweaks from the hero grid (width caps). */
  className?: string;
}

export function SolutionVideoPreview({ poster, title, className = '' }: SolutionVideoPreviewProps) {
  const { t } = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [isFs, setIsFs] = useState(false);
  const [quality, setQuality] = useState<Quality>('auto');
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [seeking, setSeeking] = useState(false);

  // ---- Controls visibility (pointer-driven) ----
  // Hidden by default; shown while hovering the video, while
  // scrubbing the timeline, while the settings menu is open,
  // or while the player holds (keyboard) focus.
  const controlsVisible = hovering || focusWithin || menuOpen || seeking;

  // ---- Core actions ----
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const seekTo = (clientX: number) => {
    const v = videoRef.current;
    const track = trackRef.current;
    if (!v || !track || !v.duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
    setCurrent(v.currentTime);
  };

  const applyVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.min(1, Math.max(0, val));
    v.volume = clamped;
    if (clamped > 0 && v.muted) v.muted = false;
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const applyRate = (r: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = r;
    setRate(r);
    setMenuOpen(false);
  };

  const applyQuality = (q: Quality) => {
    // Single shipped rendition — both options resolve to the
    // same 720p source; the choice is persisted for the menu.
    setQuality(q);
    setMenuOpen(false);
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    } else {
      v?.webkitEnterFullscreen?.();
    }
  };

  // ---- Global listeners ----
  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Close the settings menu on outside pointer-down.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  // ---- Keyboard ----
  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = videoRef.current;
    if (!v) return;
    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
        break;
      case 'j':
      case 'J':
        v.currentTime = Math.max(0, v.currentTime - 10);
        break;
      case 'l':
      case 'L':
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
        break;
      case 'ArrowUp':
        e.preventDefault();
        applyVolume(v.volume + 0.05);
        break;
      case 'ArrowDown':
        e.preventDefault();
        applyVolume(v.volume - 0.05);
        break;
      case 'm':
      case 'M':
        toggleMute();
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 'Escape':
        if (menuOpen) setMenuOpen(false);
        break;
    }
  };

  // ---- Derived ----
  const progress = duration > 0 ? current / duration : 0;
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={`${t('mkt.solp.videoPlayer')} — ${title}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => {
        if (!menuOpen && !dragging.current) setHovering(false);
      }}
      onFocus={(e) => {
        // Only KEYBOARD focus reveals the controls — a mouse
        // click focuses the player too, but the controls then
        // follow the pointer (hover) instead of staying pinned.
        const el = e.target instanceof HTMLElement ? e.target : null;
        if (el?.matches(':focus-visible')) setFocusWithin(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocusWithin(false);
      }}
      className={`mkt-focus group relative overflow-hidden rounded-[2rem] border border-border bg-mkt-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_48px_-16px_rgb(0_0_0/0.18)] outline-none ${
        !controlsVisible && playing ? 'cursor-none' : ''
      } ${isFs ? 'flex items-center justify-center bg-black' : ''} ${className}`}
    >
      {/* Video (real demo file; poster = real product capture) */}
      <video
        ref={videoRef}
        src={DEMO_VIDEO}
        poster={poster}
        preload="metadata"
        playsInline
        draggable={false}
        className={`block w-full select-none ${isFs ? 'h-full object-contain' : 'aspect-[16/10] object-cover'}`}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.duration && v.buffered.length) {
            setBuffered(v.buffered.end(v.buffered.length - 1) / v.duration);
          }
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
      />

      {/* Darkened preview overlay — visible while paused */}
      {!playing && (
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/5"
          aria-hidden="true"
        />
      )}

      {/* Centered play button — kept while paused */}
      {!playing && !waiting && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={t('mkt.solp.play')}
          className="absolute inset-0 flex items-center justify-center outline-none"
        >
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-[0_10px_36px_rgb(0_0_0/0.4)] ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-[1.06] group-active:scale-95">
            <span className="absolute -inset-3 rounded-full border border-white/35" />
            <Play className="h-8 w-8 translate-x-[3px] text-mkt-accent" fill="currentColor" strokeWidth={0} />
          </span>
        </button>
      )}

      {/* Buffering spinner */}
      {waiting && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <Loader2 className="h-10 w-10 animate-spin text-white/90" />
        </span>
      )}

      {/* ------------------ Control bar (hover-driven) ------------------ */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-200 sm:px-4 sm:pb-3 ${
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress / timeline */}
        <div
          ref={trackRef}
          role="slider"
          aria-label={t('mkt.solp.seek')}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          className="group/bar flex h-4 cursor-pointer items-center"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            setSeeking(true);
            seekTo(e.clientX);
          }}
          onPointerMove={(e) => {
            if (dragging.current) seekTo(e.clientX);
          }}
          onPointerUp={(e) => {
            dragging.current = false;
            setSeeking(false);
            // If the pointer was released outside the player,
            // stop showing the controls (no hover there).
            const r = wrapRef.current?.getBoundingClientRect();
            if (r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) {
              setHovering(false);
            }
          }}
          onPointerCancel={() => {
            dragging.current = false;
            setSeeking(false);
          }}
        >
          <div className="relative h-1 w-full overflow-visible rounded-full bg-white/25">
            {/* buffered */}
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white/35"
              style={{ width: `${Math.min(100, buffered * 100)}%` }}
              aria-hidden="true"
            />
            {/* played */}
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-mkt-accent"
              style={{ width: `${progress * 100}%` }}
              aria-hidden="true"
            />
            {/* thumb */}
            <span
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 scale-0 rounded-full bg-mkt-accent shadow transition-transform group-hover/bar:scale-100"
              style={{ left: `calc(${progress * 100}% - 6px)` }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Buttons row — minimal: play · time · volume · settings · fullscreen */}
        <div className="mt-1 flex items-center gap-0.5 text-white sm:gap-1">
          {/* Play / Pause */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? t('mkt.solp.pause') : t('mkt.solp.play')}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
          >
            {playing ? (
              <Pause className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="h-[18px] w-[18px] translate-x-[1px]" fill="currentColor" strokeWidth={0} />
            )}
          </button>

          {/* Time */}
          <span className="px-1 text-[11px] font-medium tabular-nums text-white/90 sm:text-xs">
            {fmtTime(current)} / {fmtTime(duration)}
          </span>

          <span className="flex-1" aria-hidden="true" />

          {/* Volume */}
          <div className="group/vol flex items-center">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted || volume === 0 ? t('mkt.solp.unmute') : t('mkt.solp.mute')}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
            >
              <VolIcon className="h-[18px] w-[18px]" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => applyVolume(Number(e.target.value))}
              aria-label={t('mkt.solp.volume')}
              className="h-1 w-0 cursor-pointer overflow-hidden accent-white opacity-0 transition-all duration-200 group-hover/vol:w-16 group-hover/vol:opacity-100 focus-visible:w-16 focus-visible:opacity-100"
            />
          </div>

          {/* Settings (speed + quality) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={t('mkt.solp.settings')}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 ${
                menuOpen ? 'bg-white/15' : ''
              }`}
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                aria-label={t('mkt.solp.settings')}
                className="absolute bottom-full right-0 mb-2 w-40 rounded-xl bg-neutral-900/95 p-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur"
              >
                {/* -- Playback speed -- */}
                <div
                  className="px-3 pb-1 pt-1.5 text-[0.625rem] font-semibold uppercase tracking-wider text-white/50"
                  aria-hidden="true"
                >
                  {t('mkt.solp.speed')}
                </div>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="menuitemradio"
                    aria-checked={s === rate}
                    onClick={() => applyRate(s)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <span className="tabular-nums">{s}×</span>
                    {s === rate && <span className="h-1.5 w-1.5 rounded-full bg-mkt-accent" aria-hidden="true" />}
                  </button>
                ))}

                <div className="my-1 border-t border-white/10" aria-hidden="true" />

                {/* -- Quality -- */}
                <div
                  className="px-3 pb-1 pt-1.5 text-[0.625rem] font-semibold uppercase tracking-wider text-white/50"
                  aria-hidden="true"
                >
                  {t('mkt.solp.qualityShort')}
                </div>
                {QUALITIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    role="menuitemradio"
                    aria-checked={q === quality}
                    onClick={() => applyQuality(q)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <span className="tabular-nums">{q === 'auto' ? t('mkt.solp.qualityAuto') : q}</span>
                    {q === quality && (
                      <span className="h-1.5 w-1.5 rounded-full bg-mkt-accent" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFs ? t('mkt.solp.exitFullscreen') : t('mkt.solp.fullscreen')}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
          >
            {isFs ? <Minimize className="h-[18px] w-[18px]" /> : <Maximize className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}
