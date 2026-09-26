'use client';

// ============================================================
// KARMAX ILLUSTRATION SYSTEM — original editorial line art
// ============================================================
// Minimal 2D editorial scenes: clean charcoal line work
// (currentColor — inherits text color), Karmax-orange accents
// and soft peach fills, off-white stage. 100% original SVG —
// no stock art, no HubSpot assets, no text inside the art.
//
// Rendering notes (important):
//  - every scene root <g> sets BOTH fill="none" AND
//    stroke="currentColor" — SVG's default stroke is "none",
//    so without it no line work renders.
//  - accent elements re-declare stroke="currentColor" on
//    THEMSELVES (with a text-mkt-accent class) so the color
//    resolves against their own color, not the parent's.
//  - fill-only shapes (soft panels, dots) set stroke="none".
//
// Scenes are DECORATIVE (aria-hidden) — the adjacent copy
// carries the meaning, which keeps screen readers clean.
// ============================================================

import React from 'react';

export type SceneName =
  | 'publishing'
  | 'seo'
  | 'automation'
  | 'multisite'
  | 'agency'
  | 'integrations'
  | 'platform';

// Shared drawing conventions:
//  - outline:  stroke="currentColor" (charcoal via parent)
//  - accent:   className="text-mkt-accent" + stroke/fill currentColor
//  - soft:     fill="var(--mkt-accent-soft)" + stroke="none"
//  - ground:   soft shadow ellipse under objects

const Soft = ({ ...p }: React.SVGProps<SVGEllipseElement>) => (
  <ellipse fill="currentColor" stroke="none" opacity={0.07} {...p} />
);

// ------------------------------------------------------------
// 1 · Content Publishing — writer at a desk, draft flying to
//     a browser window (the publish moment)
// ------------------------------------------------------------

function PublishingScene() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      {/* ground */}
      <Soft cx={270} cy={352} rx={190} ry={14} />

      {/* browser window (destination) */}
      <rect x={292} y={52} width={176} height={124} rx={12} />
      <path d="M292 78h176" />
      <circle cx={308} cy={65} r={3} fill="currentColor" stroke="none" />
      <circle cx={322} cy={65} r={3} fill="currentColor" stroke="none" />
      <circle cx={336} cy={65} r={3} fill="currentColor" stroke="none" />
      <path d="M312 96h84M312 112h120M312 128h64" strokeWidth={2} opacity={0.55} />
      <path d="M312 148l26-18 22 14 30-24" className="text-mkt-accent" stroke="currentColor" />
      <circle cx={390} cy={120} r={4} className="text-mkt-accent" fill="currentColor" stroke="none" />

      {/* draft document (origin) */}
      <rect x={58} y={92} width={148} height={186} rx={12} fill="var(--mkt-accent-soft)" stroke="none" />
      <rect x={58} y={92} width={148} height={186} rx={12} />
      <path d="M82 128h72M82 150h100M82 172h100M82 194h56" strokeWidth={2} opacity={0.55} />
      <rect x={82} y={222} width={52} height={12} rx={6} className="text-mkt-accent" fill="currentColor" stroke="none" />
      <circle cx={168} cy={228} r={10} />
      <path d="M164.5 228l2.5 2.5 5-5" strokeWidth={2} />

      {/* flow arrow draft → browser */}
      <path
        d="M212 200c40 6 62-8 78-30"
        className="text-mkt-accent"
        stroke="currentColor"
        strokeDasharray="1 10"
        strokeWidth={3}
      />
      <path d="M286 178l-6 12 13-1z" className="text-mkt-accent" fill="currentColor" stroke="none" />

      {/* desk */}
      <path d="M120 300h300" />
      <path d="M150 300v44M390 300v44" strokeWidth={2} />

      {/* laptop */}
      <path d="M330 300v-52a6 6 0 0 1 6-6h56a6 6 0 0 1 6 6v52" />
      <path d="M318 300h96" />

      {/* person */}
      <circle cx={252} cy={178} r={22} />
      <path d="M252 200v34c0 22 12 34 30 40l-8 26" />
      <path d="M274 236c14 2 24 10 30 22l14 42" />
      <path d="M252 234c-8 14-22 22-38 26" className="text-mkt-accent" stroke="currentColor" />
      <path d="M226 262l-12 38" />

      {/* mug on desk */}
      <path d="M180 300v-16h18v16" />
      <path d="M198 288h8a6 6 0 0 1 0 12h-8" strokeWidth={2} />
    </g>
  );
}

// ------------------------------------------------------------
// 2 · SEO — a page under the magnifier, rankings climbing
// ------------------------------------------------------------

function SeoScene() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Soft cx={250} cy={352} rx={185} ry={14} />

      {/* page */}
      <rect x={76} y={56} width={204} height={268} rx={14} fill="var(--mkt-accent-soft)" stroke="none" />
      <rect x={76} y={56} width={204} height={268} rx={14} />
      <rect x={104} y={92} width={86} height={14} rx={7} className="text-mkt-accent" fill="currentColor" stroke="none" />
      <path d="M104 132h148M104 154h148M104 176h112M104 210h148M104 232h96M104 254h128" strokeWidth={2} opacity={0.55} />

      {/* check rows */}
      <circle cx={112} cy={288} r={9} />
      <path d="M108.5 288l2.5 2.5 5-5" strokeWidth={2} />
      <path d="M130 288h84" strokeWidth={2} opacity={0.55} />
      <circle cx={112} cy={312} r={9} />
      <path d="M108.5 312l2.5 2.5 5-5" strokeWidth={2} />
      <path d="M130 312h60" strokeWidth={2} opacity={0.55} />

      {/* magnifier */}
      <circle cx={352} cy={168} r={54} fill="var(--mkt-accent-soft)" stroke="none" />
      <circle cx={352} cy={168} r={54} />
      <circle cx={352} cy={168} r={38} strokeWidth={2} opacity={0.5} />
      <path d="M312 312l-38 38" strokeWidth={7} />
      <path d="M338 150l10-10M338 162l22-22" strokeWidth={2} className="text-mkt-accent" stroke="currentColor" />

      {/* ranking chart */}
      <path d="M318 330h150M318 330V236" strokeWidth={2} opacity={0.5} />
      <path d="M330 318l38-30 34 14 52-58" className="text-mkt-accent" stroke="currentColor" />
      <path d="M454 244l-4 16-13-8z" className="text-mkt-accent" fill="currentColor" stroke="none" />
      <circle cx={402} cy={302} r={4} className="text-mkt-accent" fill="currentColor" stroke="none" />
    </g>
  );
}

// ------------------------------------------------------------
// 3 · Automation — calendar, gear and clock on a flowing rail
// ------------------------------------------------------------

function AutomationScene() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Soft cx={260} cy={352} rx={185} ry={14} />

      {/* calendar */}
      <rect x={62} y={96} width={150} height={128} rx={12} />
      <path d="M62 128h150" />
      <path d="M92 88v18M182 88v18" />
      <path d="M86 152h16M116 152h16M146 152h16M176 152h10M86 178h16M116 178h16M146 178h16" strokeWidth={2} opacity={0.55} />
      <rect x={116} y={196} width={34} height={12} rx={6} className="text-mkt-accent" fill="currentColor" stroke="none" />

      {/* flowing rail */}
      <path
        d="M218 160c50 0 44 96 92 96"
        className="text-mkt-accent"
        stroke="currentColor"
        strokeDasharray="1 11"
        strokeWidth={3}
      />

      {/* clock */}
      <circle cx={356} cy={118} r={44} fill="var(--mkt-accent-soft)" stroke="none" />
      <circle cx={356} cy={118} r={44} />
      <path d="M356 92v26l18 12" />
      <path d="M336 66l-8-12M376 66l8-12" strokeWidth={2} opacity={0.5} />

      {/* gear (engine of the workflow) */}
      <g className="text-mkt-accent" stroke="currentColor">
        <circle cx={330} cy={278} r={34} />
        <path
          d="M330 236v-12M330 332v-12M288 278h-12M384 278h-12M300 248l-9-9M369 309l-9-9M300 308l-9 9M369 247l-9 9"
          strokeWidth={4}
        />
        <circle cx={330} cy={278} r={12} />
      </g>

      {/* output card */}
      <rect x={402} y={222} width={86} height={62} rx={10} />
      <path d="M402 242h86" strokeWidth={2} />
      <path d="M414 256h34M414 270h48" strokeWidth={2} opacity={0.55} />
      <path
        d="M396 253l-14-14"
        className="text-mkt-accent"
        stroke="currentColor"
        strokeDasharray="1 9"
        strokeWidth={3}
      />
      <path d="M386 236l1 12-11-3z" className="text-mkt-accent" fill="currentColor" stroke="none" />

      {/* toggle */}
      <rect x={92} y={262} width={52} height={28} rx={14} className="text-mkt-accent" fill="currentColor" stroke="none" />
      <circle cx={130} cy={276} r={10} fill="#fff" stroke="none" />
      <path d="M152 276h22" strokeWidth={2} opacity={0.5} />
    </g>
  );
}

// ------------------------------------------------------------
// 4 · Multi-site — a stack of sites, the front one in focus
// ------------------------------------------------------------

function MultisiteScene() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Soft cx={260} cy={352} rx={185} ry={14} />

      {/* back window */}
      <g opacity={0.4}>
        <rect x={96} y={58} width={252} height={164} rx={12} />
        <path d="M96 84h252" strokeWidth={2} />
      </g>

      {/* middle window */}
      <g opacity={0.65}>
        <rect x={124} y={86} width={252} height={164} rx={12} />
        <path d="M124 112h252" strokeWidth={2} />
      </g>

      {/* front window (active) */}
      <rect x={152} y={114} width={252} height={164} rx={12} fill="var(--mkt-accent-soft)" stroke="none" />
      <rect x={152} y={114} width={252} height={164} rx={12} />
      <path d="M152 140h252" />
      <circle cx={170} cy={127} r={3} fill="currentColor" stroke="none" />
      <circle cx={182} cy={127} r={3} fill="currentColor" stroke="none" />
      <rect x={168} y={126} width={44} height={9} rx={4.5} className="text-mkt-accent" fill="currentColor" stroke="none" />
      {/* sidebar + content */}
      <path d="M176 162v92" strokeWidth={2} opacity={0.4} />
      <path d="M196 166h76M196 186h130M196 206h104M196 226h130M196 246h64" strokeWidth={2} opacity={0.55} />
      <rect x={288} y={158} width={98} height={58} rx={8} className="text-mkt-accent" stroke="currentColor" />
      <path d="M298 202l18-16 14 10 22-20 20 14" className="text-mkt-accent" stroke="currentColor" />

      {/* cursor picking the front site */}
      <path d="M352 96l14 26-11-2-6 12-8-30z" fill="currentColor" stroke="none" />
      <path d="M366 122l10 20" strokeWidth={2} opacity={0.5} />

      {/* orbit dots */}
      <circle cx={86} cy={150} r={5} className="text-mkt-accent" fill="currentColor" stroke="none" />
      <circle cx={448} cy={210} r={5} className="text-mkt-accent" fill="currentColor" stroke="none" />
      <circle cx={70} cy={290} r={4} fill="currentColor" stroke="none" opacity={0.5} />
      <circle cx={452} cy={80} r={4} fill="currentColor" stroke="none" opacity={0.5} />
    </g>
  );
}

// ------------------------------------------------------------
// 5 · Agency — two people, one table, client sites fanned out
// ------------------------------------------------------------

function AgencyScene() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Soft cx={260} cy={352} rx={185} ry={14} />

      {/* fanned client-site cards */}
      <g transform="rotate(-10 190 160)">
        <rect x={140} y={110} width={104} height={72} rx={10} opacity={0.75} />
        <path d="M140 132h104" strokeWidth={2} />
        <path d="M154 148h56M154 162h72" strokeWidth={2} opacity={0.5} />
      </g>
      <g transform="rotate(10 330 160)">
        <rect x={278} y={110} width={104} height={72} rx={10} opacity={0.75} />
        <path d="M278 132h104" strokeWidth={2} />
        <path d="M292 148h56M292 162h72" strokeWidth={2} opacity={0.5} />
      </g>
      <rect x={208} y={96} width={104} height={72} rx={10} fill="var(--mkt-accent-soft)" stroke="none" />
      <rect x={208} y={96} width={104} height={72} rx={10} />
      <path d="M208 118h104" />
      <rect x={220} y={114} width={40} height={8} rx={4} className="text-mkt-accent" fill="currentColor" stroke="none" />
      <path d="M222 134h56M222 150h72" strokeWidth={2} opacity={0.55} />

      {/* shared workspace bar under the cards */}
      <path d="M186 196h148" strokeWidth={2} opacity={0.4} />

      {/* table */}
      <path d="M104 306h312M136 306v40M384 306v40" strokeWidth={2} />

      {/* left person */}
      <circle cx={128} cy={200} r={21} />
      <path d="M128 221v30c0 20 10 32 26 38" />
      <path d="M148 246c12 4 20 12 24 24l10 36" />
      <path d="M128 250c-6 12-16 20-30 24" className="text-mkt-accent" stroke="currentColor" />

      {/* right person */}
      <circle cx={392} cy={200} r={21} />
      <path d="M392 221v30c0 20-10 32-26 38" />
      <path d="M372 246c-12 4-20 12-24 24l-10 36" />
      <path d="M392 250c6 12 16 20 30 24" className="text-mkt-accent" stroke="currentColor" />

      {/* chat bubble above the table */}
      <path d="M236 262h88a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10h-52l-14 14v-14h-22a10 10 0 0 1-10-10v-26a10 10 0 0 1 10-10z" fill="var(--mkt-accent-soft)" stroke="none" />
      <path d="M236 262h88a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10h-52l-14 14v-14h-22a10 10 0 0 1-10-10v-26a10 10 0 0 1 10-10z" />
      <circle cx={262} cy={285} r={3.5} fill="currentColor" stroke="none" />
      <circle cx={280} cy={285} r={3.5} className="text-mkt-accent" fill="currentColor" stroke="none" />
      <circle cx={298} cy={285} r={3.5} fill="currentColor" stroke="none" />
    </g>
  );
}

// ------------------------------------------------------------
// 6 · Integrations — one hub, every connection
// ------------------------------------------------------------

function IntegrationsScene() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Soft cx={260} cy={352} rx={185} ry={14} />

      {/* connection rails */}
      <path d="M168 130L214 178" strokeDasharray="1 10" strokeWidth={3} className="text-mkt-accent" stroke="currentColor" />
      <path d="M352 130L306 178" strokeDasharray="1 10" strokeWidth={3} className="text-mkt-accent" stroke="currentColor" />
      <path d="M168 282l46-42" strokeWidth={2} opacity={0.5} />
      <path d="M352 282l-46-42" strokeWidth={2} opacity={0.5} />

      {/* hub */}
      <rect x={214} y={178} width={92} height={92} rx={22} fill="var(--mkt-accent-soft)" stroke="none" />
      <rect x={214} y={178} width={92} height={92} rx={22} />
      <path d="M236 208h48M236 226h48M236 244h28" strokeWidth={2} opacity={0.55} />
      <circle cx={260} cy={224} r={54} strokeDasharray="2 9" strokeWidth={2} opacity={0.5} />

      {/* card: site / globe */}
      <rect x={92} y={76} width={96} height={74} rx={12} />
      <circle cx={140} cy={113} r={18} />
      <path d="M122 113h36M140 95c10 10 10 26 0 36M140 95c-10 10-10 26 0 36" strokeWidth={2} />

      {/* card: server */}
      <rect x={332} y={76} width={96} height={74} rx={12} />
      <rect x={352} y={94} width={56} height={14} rx={4} />
      <rect x={352} y={116} width={56} height={14} rx={4} className="text-mkt-accent" fill="currentColor" stroke="none" />
      <circle cx={360} cy={101} r={2.5} fill="currentColor" stroke="none" />
      <circle cx={360} cy={123} r={2.5} fill="currentColor" stroke="none" />

      {/* card: mail */}
      <rect x={92} y={262} width={96} height={74} rx={12} />
      <rect x={108} y={282} width={64} height={38} rx={6} />
      <path d="M108 288l32 20 32-20" strokeWidth={2} />

      {/* card: plug / webhook */}
      <rect x={332} y={262} width={96} height={74} rx={12} />
      <path d="M368 322v-14M392 322v-14" />
      <path d="M360 294a20 20 0 0 1 40 0" />
      <path d="M360 294v10a20 20 0 0 0 40 0v-10" />
      <path d="M380 308v14" strokeWidth={2} className="text-mkt-accent" stroke="currentColor" />

      {/* pulse dots on rails */}
      <circle cx={191} cy={154} r={5} className="text-mkt-accent" fill="currentColor" stroke="none" />
      <circle cx={329} cy={154} r={5} className="text-mkt-accent" fill="currentColor" stroke="none" />
    </g>
  );
}

// ------------------------------------------------------------
// 7 · Platform (overview) — one dashboard, tools in orbit
// ------------------------------------------------------------

function PlatformScene() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Soft cx={260} cy={352} rx={185} ry={14} />

      {/* orbit */}
      <ellipse cx={260} cy={196} rx={216} ry={130} strokeDasharray="2 10" strokeWidth={2} opacity={0.45} />

      {/* dashboard window */}
      <rect x={152} y={104} width={216} height={184} rx={14} fill="var(--mkt-accent-soft)" stroke="none" />
      <rect x={152} y={104} width={216} height={184} rx={14} />
      <path d="M152 130h216" />
      <circle cx={170} cy={117} r={3} fill="currentColor" stroke="none" />
      <circle cx={182} cy={117} r={3} fill="currentColor" stroke="none" />
      <circle cx={194} cy={117} r={3} fill="currentColor" stroke="none" />
      {/* sidebar */}
      <path d="M180 152v112" strokeWidth={2} opacity={0.4} />
      <path d="M166 158h10M166 176h10M166 194h10" strokeWidth={2} opacity={0.5} />
      {/* content */}
      <path d="M196 158h72M196 178h120M196 198h96" strokeWidth={2} opacity={0.55} />
      <rect x={196} y={214} width={120} height={54} rx={8} className="text-mkt-accent" stroke="currentColor" />
      <path d="M206 254l20-18 16 10 26-22 22 14" className="text-mkt-accent" stroke="currentColor" />

      {/* orbiting tool glyphs */}
      {/* pen */}
      <circle cx={78} cy={110} r={24} />
      <path d="M70 118l4-10 14-14 6 6-14 14z" strokeWidth={2} />
      {/* magnifier */}
      <circle cx={446} cy={122} r={24} />
      <circle cx={440} cy={116} r={8} strokeWidth={2} />
      <path d="M446 122l8 8" strokeWidth={2} />
      {/* gear */}
      <circle cx={70} cy={286} r={24} />
      <circle cx={70} cy={286} r={9} strokeWidth={2} />
      <path d="M70 258v8M70 306v8M42 286h8M90 286h8" strokeWidth={3} />
      {/* envelope */}
      <circle cx={452} cy={282} r={24} />
      <rect x={440} y={274} width={24} height={16} rx={3} strokeWidth={2} />
      <path d="M440 277l12 8 12-8" strokeWidth={2} />
    </g>
  );
}

const SCENES: Record<SceneName, () => React.JSX.Element> = {
  publishing: PublishingScene,
  seo: SeoScene,
  automation: AutomationScene,
  multisite: MultisiteScene,
  agency: AgencyScene,
  integrations: IntegrationsScene,
  platform: PlatformScene,
};

/** The raw scene — line art in currentColor + brand accents. */
export function SolutionScene({ name, className = '' }: { name: SceneName; className?: string }) {
  const Scene = SCENES[name];
  return (
    <svg
      viewBox="0 0 520 400"
      className={`h-auto w-full text-text-primary ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <Scene />
    </svg>
  );
}

/**
 * The staged scene — editorial hero visual: an off-white rounded
 * panel, a soft peach blob bleeding off the edge (HubSpot-style
 * organic backdrop, redrawn original) and the scene on top.
 */
export function SceneStage({ name, className = '' }: { name: SceneName; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* organic backdrop blob */}
      <svg
        viewBox="0 0 520 400"
        className="pointer-events-none absolute inset-0 h-full w-full text-mkt-accent-soft"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M96 236C52 168 88 74 168 52c70-19 128 9 176-3 66-16 140 30 148 98 7 61-38 83-52 133-13 47-64 78-124 74-58-4-76-42-124-50-50-8-72-33-96-68z"
          fill="currentColor"
        />
      </svg>
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-mkt-surface">
        <div className="mkt-dotgrid absolute inset-0" aria-hidden="true" />
        <SolutionScene name={name} className="relative p-4 sm:p-6" />
      </div>
    </div>
  );
}
