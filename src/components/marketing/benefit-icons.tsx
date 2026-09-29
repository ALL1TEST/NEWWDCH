'use client';

// ============================================================
// BENEFIT ILLUSTRATION ICONS — small custom line-art marks
// ============================================================
// Hand-composed inline SVGs (not icon-library glyphs): a quiet,
// coherent stroke set drawn for the "What you get" benefit rows
// on solution pages. 24×24 grid, 1.8px rounded strokes in
// currentColor — rendered in the Karmax accent orange. One
// metaphor per benefit, kept deliberately minimal so the text
// stays the hero of each item.
// ============================================================

import React from 'react';

export type BenefitIcon = React.ComponentType<{ className?: string }>;

function makeIcon(displayName: string, children: React.ReactNode): BenefitIcon {
  const Icon = ({ className = '' }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
}

// Consistency across sites — stacked layers
export const LayersIcon = makeIcon('LayersIcon', (
  <>
    <path d="M12 3.6l8.2 4.3-8.2 4.3-8.2-4.3L12 3.6z" />
    <path d="M3.8 12.3l8.2 4.3 8.2-4.3" />
    <path d="M3.8 16.2l8.2 4.3 8.2-4.3" />
  </>
));

// Catch issues early — radar sweep with a blip
export const RadarIcon = makeIcon('RadarIcon', (
  <>
    <circle cx="6.2" cy="17.8" r="1.7" fill="currentColor" stroke="none" />
    <path d="M6.2 11.8a6 6 0 0 1 6 6" />
    <path d="M6.2 6.6a11.2 11.2 0 0 1 11.2 11.2" />
    <circle cx="14.8" cy="8.6" r="1.6" />
  </>
));

// Per-page reports — a page with a focus-keyword magnifier
export const ReportIcon = makeIcon('ReportIcon', (
  <>
    <rect x="4.5" y="3.2" width="13" height="17.6" rx="2.5" />
    <path d="M7.8 7.4h6.4M7.8 10.6h4.2" />
    <circle cx="14" cy="15.6" r="3" />
    <path d="M16.2 17.8l2.5 2.5" />
  </>
));

// Redirects, schema and sitemaps — a node tree
export const SitemapIcon = makeIcon('SitemapIcon', (
  <>
    <rect x="9.4" y="2.8" width="5.2" height="5.2" rx="1.6" />
    <rect x="3.2" y="16" width="5.2" height="5.2" rx="1.6" />
    <rect x="15.6" y="16" width="5.2" height="5.2" rx="1.6" />
    <path d="M12 8v4.6M6 12.6h12M6 12.6V16M18 12.6V16" />
  </>
));

// One dashboard — panes with a first sparkline
export const DashboardIcon = makeIcon('DashboardIcon', (
  <>
    <rect x="3.6" y="3.6" width="7.6" height="7.6" rx="2" />
    <rect x="12.8" y="3.6" width="7.6" height="7.6" rx="2" />
    <rect x="3.6" y="12.8" width="7.6" height="7.6" rx="2" />
    <rect x="12.8" y="12.8" width="7.6" height="7.6" rx="2" />
    <path d="M5.9 8.7V6.6M8 8.7V5.4" strokeOpacity="0.55" />
  </>
));

// Prompts and templates — an AI spark
export const SparkIcon = makeIcon('SparkIcon', (
  <>
    <path d="M11 3.8l1.7 4.8 4.8 1.7-4.8 1.7L11 16.8l-1.7-4.8-4.8-1.7 4.8-1.7L11 3.8z" />
    <path d="M18.2 15.2l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" strokeOpacity="0.6" />
  </>
));

// Checks inside the writing flow — a pen with a check
export const PenCheckIcon = makeIcon('PenCheckIcon', (
  <>
    <path d="M4.6 19.4l.9-3.5L14.8 6.6a2 2 0 0 1 2.8 2.8L8.3 18.7l-3.7.7z" />
    <path d="M13.2 15.4l1.9 1.9 3.9-4.3" />
  </>
));

// Connect the CMS — a plug
export const PlugIcon = makeIcon('PlugIcon', (
  <>
    <path d="M8.8 2.8v4.4M15.2 2.8v4.4" />
    <path d="M5.8 7.2h12.4v2.6a6.2 6.2 0 0 1-12.4 0V7.2z" />
    <path d="M12 16v3.4" />
  </>
));

// Scheduled around the clock — a clock face
export const ClockIcon = makeIcon('ClockIcon', (
  <>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.2V12l3.2 2.1" />
  </>
));

// Reusable workflows — circular arrows
export const RepeatIcon = makeIcon('RepeatIcon', (
  <>
    <path d="M4.6 12a7.4 7.4 0 0 1 12.5-5.3" />
    <path d="M17.5 3.3v3.5h-3.5" />
    <path d="M19.4 12a7.4 7.4 0 0 1-12.5 5.3" />
    <path d="M6.5 20.7v-3.5h3.5" />
  </>
));

// Every run logged — an audit list
export const LogListIcon = makeIcon('LogListIcon', (
  <>
    <circle cx="6" cy="6.4" r="1.3" fill="currentColor" stroke="none" />
    <path d="M9.6 6.4h9" />
    <circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <path d="M9.6 12h6.8" />
    <circle cx="6" cy="17.6" r="1.3" fill="currentColor" stroke="none" />
    <path d="M9.6 17.6h8.2" />
  </>
));

// Newsletters and notifications — a paper plane
export const SendIcon = makeIcon('SendIcon', (
  <>
    <path d="M20.6 3.4L3.6 10.3l6.3 2.6 2.6 6.3 8.1-15.8z" />
    <path d="M9.9 12.9L20.6 3.4" />
  </>
));

// Multiple sites — a globe
export const GlobeIcon = makeIcon('GlobeIcon', (
  <>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M3.4 12h17.2" />
    <path d="M12 3.4c2.5 2.3 3.9 5.3 3.9 8.6s-1.4 6.3-3.9 8.6c-2.5-2.3-3.9-5.3-3.9-8.6s1.4-6.3 3.9-8.6z" />
  </>
));

// Per-site isolation — a shield with a keyhole
export const ShieldIcon = makeIcon('ShieldIcon', (
  <>
    <path d="M12 2.9l7.2 2.6v5.2c0 4.6-3 7.9-7.2 9.9-4.2-2-7.2-5.3-7.2-9.9V5.5L12 2.9z" />
    <circle cx="12" cy="10.2" r="1.5" fill="currentColor" stroke="none" />
    <path d="M12 11.7v3.2" />
  </>
));

// Roles, permissions and keys — a key
export const KeyIcon = makeIcon('KeyIcon', (
  <>
    <circle cx="7.4" cy="12" r="3.6" />
    <path d="M11 12h9.2" />
    <path d="M16.4 12v3.1M19.8 12v2.2" />
  </>
));

// Unlimited — an infinity loop
export const InfinityIcon = makeIcon('InfinityIcon', (
  <>
    <path d="M12 12c-1.9-2.6-3.2-3.8-5-3.8a3.8 3.8 0 0 0 0 7.6c1.8 0 3.1-1.2 5-3.8z" />
    <path d="M12 12c1.9-2.6 3.2-3.8 5-3.8a3.8 3.8 0 0 1 0 7.6c-1.8 0-3.1-1.2-5-3.8z" />
  </>
));

// Review workflow — a comment with a check
export const CommentCheckIcon = makeIcon('CommentCheckIcon', (
  <>
    <path d="M20 6.4v6.9a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.3.8-3.3h-.3A2.5 2.5 0 0 1 4 13.3V6.4A2.5 2.5 0 0 1 6.5 3.9h11A2.5 2.5 0 0 1 20 6.4z" />
    <path d="M9 10.1l2.1 2.1 4.1-4.4" />
  </>
));

// Connection verification — a verified plug
export const PlugCheckIcon = makeIcon('PlugCheckIcon', (
  <>
    <path d="M8 2.6v4.2M12.5 2.6v4.2" />
    <path d="M5 6.8h10.5v2.5a5.25 5.25 0 0 1-10.5 0V6.8z" />
    <path d="M18.6 13.2l1.6 1.6 2.6-3" />
  </>
));
