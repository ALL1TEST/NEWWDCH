'use client';

// ============================================================
// SOLUTIONS CATALOG — the single source of truth
// ============================================================
// Every solution (overview cards, header mega-menu, mobile menu
// and the detail-page template) renders from THIS catalog, so
// navigation, landing pages and i18n stay in lockstep.
//
// CONTENT RULES (enforced by review):
// - Only real, shipped Karmax capabilities — no invented stats,
//   customers, testimonials or roadmap claims.
// - Screenshots are REAL captures from public/marketing/*.
// - Every CTA/link resolves to an existing hash route.
//
// Slug → route mapping: #/solutions/<slug>
// ============================================================

import React from 'react';
import {
  CalendarClock,
  Layers,
  ListChecks,
  type LucideIcon,
  Network,
  PenLine,
  Plug,
  Search,
  Users,
  Zap,
} from 'lucide-react';
import type { SceneName } from './solution-illustrations';

// ---- Story blocks (alternating storytelling sections) ----

export interface SolutionStory {
  /** Real product screenshot (public/marketing/…). */
  shot?: string;
  /** BrowserFrame label key for the screenshot. */
  shotLabelKey?: string;
  /** Original illustration instead of a screenshot. */
  illustration?: SceneName;
  titleKey: string;
  bodyKey: string;
  /** i18n keys for the check-marked points. */
  points: string[];
}

export interface SolutionStep {
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
}

export interface SolutionDef {
  slug: string;
  icon: LucideIcon;
  /** Mega-menu / overview card copy. */
  menuTitleKey: string;
  menuDescKey: string;
  /** Hero. */
  heroTitleKey: string;
  heroBodyKey: string;
  /** Hero illustration (original line art — no fake dashboards). */
  heroScene: SceneName;
  /** 3-step workflow. */
  steps: [SolutionStep, SolutionStep, SolutionStep];
  /** Wide screenshot shown under the 3 steps. */
  stepsShot: string;
  stepsShotLabelKey: string;
  /** Alternating [visual] [text] sections. */
  stories: SolutionStory[];
  /** Practical benefits (factual, per-solution). */
  benefits: string[];
}

// Reusable point keys keep the catalog honest — these describe
// capabilities that verifiably exist in the product today.
const AI_POINTS = ['mkt.feat.ai.point1', 'mkt.feat.ai.point2', 'mkt.feat.ai.point3'];
const SEO_POINTS = ['mkt.feat.seo.point1', 'mkt.feat.seo.point2', 'mkt.feat.seo.point3'];
const AUTOMATION_POINTS = ['mkt.feat.automation.point1', 'mkt.feat.automation.point2', 'mkt.feat.automation.point3'];
const MEDIA_POINTS = ['mkt.feat.media.point1', 'mkt.feat.media.point2'];

export const SOLUTION_CATALOG: SolutionDef[] = [
  // ----------------------------------------------------------
  // 1 · Content Publishing
  // ----------------------------------------------------------
  {
    slug: 'content-publishing',
    icon: PenLine,
    menuTitleKey: 'mkt.menu.contentPublishing',
    menuDescKey: 'mkt.menu.contentPublishingDesc',
    heroTitleKey: 'mkt.solp.cp.heroTitle',
    heroBodyKey: 'mkt.solp.cp.heroBody',
    heroScene: 'publishing',
    steps: [
      { icon: PenLine, titleKey: 'mkt.solp.cp.step1Title', bodyKey: 'mkt.solp.cp.step1Body' },
      { icon: ListChecks, titleKey: 'mkt.solp.cp.step2Title', bodyKey: 'mkt.solp.cp.step2Body' },
      { icon: Plug, titleKey: 'mkt.solp.cp.step3Title', bodyKey: 'mkt.solp.cp.step3Body' },
    ],
    stepsShot: '/marketing/shot-ai.png',
    stepsShotLabelKey: 'mkt.showcase.ai',
    stories: [
      {
        shot: '/marketing/shot-ai.png',
        shotLabelKey: 'mkt.showcase.ai',
        titleKey: 'mkt.solp.cp.story1Title',
        bodyKey: 'mkt.solp.cp.story1Body',
        points: AI_POINTS,
      },
      {
        shot: '/marketing/shot-media.png',
        shotLabelKey: 'mkt.showcase.media',
        titleKey: 'mkt.solp.cp.story2Title',
        bodyKey: 'mkt.solp.cp.story2Body',
        points: MEDIA_POINTS,
      },
      {
        shot: '/marketing/shot-articles.png',
        shotLabelKey: 'mkt.showcase.dashboard',
        titleKey: 'mkt.solp.cp.story3Title',
        bodyKey: 'mkt.solp.cp.story3Body',
        points: ['mkt.solp.cp.story3p1', 'mkt.solp.cp.story3p2', 'mkt.solp.cp.story3p3'],
      },
    ],
    benefits: [
      'mkt.solp.cp.benefit1',
      'mkt.solp.cp.benefit2',
      'mkt.solp.cp.benefit3',
      'mkt.solp.cp.benefit4',
    ],
  },

  // ----------------------------------------------------------
  // 2 · SEO & Organic Growth
  // ----------------------------------------------------------
  {
    slug: 'seo',
    icon: Search,
    menuTitleKey: 'mkt.menu.seo',
    menuDescKey: 'mkt.menu.seoDesc',
    heroTitleKey: 'mkt.solp.seo.heroTitle',
    heroBodyKey: 'mkt.solp.seo.heroBody',
    heroScene: 'seo',
    steps: [
      { icon: Search, titleKey: 'mkt.solp.seo.step1Title', bodyKey: 'mkt.solp.seo.step1Body' },
      { icon: ListChecks, titleKey: 'mkt.solp.seo.step2Title', bodyKey: 'mkt.solp.seo.step2Body' },
      { icon: CalendarClock, titleKey: 'mkt.solp.seo.step3Title', bodyKey: 'mkt.solp.seo.step3Body' },
    ],
    stepsShot: '/marketing/shot-seo.png',
    stepsShotLabelKey: 'mkt.showcase.seo',
    stories: [
      {
        shot: '/marketing/shot-seo.png',
        shotLabelKey: 'mkt.showcase.seo',
        titleKey: 'mkt.solp.seo.story1Title',
        bodyKey: 'mkt.solp.seo.story1Body',
        points: SEO_POINTS,
      },
      {
        shot: '/marketing/shot-dashboard.png',
        shotLabelKey: 'mkt.showcase.dashboard',
        titleKey: 'mkt.solp.seo.story2Title',
        bodyKey: 'mkt.solp.seo.story2Body',
        points: ['mkt.solp.seo.story2p1', 'mkt.solp.seo.story2p2', 'mkt.solp.seo.story2p3'],
      },
    ],
    benefits: [
      'mkt.solp.seo.benefit1',
      'mkt.solp.seo.benefit2',
      'mkt.solp.seo.benefit3',
      'mkt.solp.seo.benefit4',
    ],
  },

  // ----------------------------------------------------------
  // 3 · Content Automation
  // ----------------------------------------------------------
  {
    slug: 'automation',
    icon: Zap,
    menuTitleKey: 'mkt.menu.automation',
    menuDescKey: 'mkt.menu.automationDesc',
    heroTitleKey: 'mkt.solp.au.heroTitle',
    heroBodyKey: 'mkt.solp.au.heroBody',
    heroScene: 'automation',
    steps: [
      { icon: Zap, titleKey: 'mkt.solp.au.step1Title', bodyKey: 'mkt.solp.au.step1Body' },
      { icon: Layers, titleKey: 'mkt.solp.au.step2Title', bodyKey: 'mkt.solp.au.step2Body' },
      { icon: ListChecks, titleKey: 'mkt.solp.au.step3Title', bodyKey: 'mkt.solp.au.step3Body' },
    ],
    stepsShot: '/marketing/shot-automation.png',
    stepsShotLabelKey: 'mkt.showcase.automation',
    stories: [
      {
        shot: '/marketing/shot-automation.png',
        shotLabelKey: 'mkt.showcase.automation',
        titleKey: 'mkt.solp.au.story1Title',
        bodyKey: 'mkt.solp.au.story1Body',
        points: AUTOMATION_POINTS,
      },
      {
        shot: '/marketing/shot-articles.png',
        shotLabelKey: 'mkt.showcase.dashboard',
        titleKey: 'mkt.solp.au.story2Title',
        bodyKey: 'mkt.solp.au.story2Body',
        points: ['mkt.solp.au.story2p1', 'mkt.solp.au.story2p2', 'mkt.solp.au.story2p3'],
      },
    ],
    benefits: [
      'mkt.solp.au.benefit1',
      'mkt.solp.au.benefit2',
      'mkt.solp.au.benefit3',
      'mkt.solp.au.benefit4',
    ],
  },

  // ----------------------------------------------------------
  // 4 · Multi-Site Management
  // ----------------------------------------------------------
  {
    slug: 'multi-site',
    icon: Network,
    menuTitleKey: 'mkt.menu.multiSite',
    menuDescKey: 'mkt.menu.multiSiteDesc',
    heroTitleKey: 'mkt.solp.ms.heroTitle',
    heroBodyKey: 'mkt.solp.ms.heroBody',
    heroScene: 'multisite',
    steps: [
      { icon: Plug, titleKey: 'mkt.solp.ms.step1Title', bodyKey: 'mkt.solp.ms.step1Body' },
      { icon: Layers, titleKey: 'mkt.solp.ms.step2Title', bodyKey: 'mkt.solp.ms.step2Body' },
      { icon: Network, titleKey: 'mkt.solp.ms.step3Title', bodyKey: 'mkt.solp.ms.step3Body' },
    ],
    stepsShot: '/marketing/shot-dashboard.png',
    stepsShotLabelKey: 'mkt.showcase.dashboard',
    stories: [
      {
        shot: '/marketing/shot-dashboard.png',
        shotLabelKey: 'mkt.showcase.dashboard',
        titleKey: 'mkt.solp.ms.story1Title',
        bodyKey: 'mkt.solp.ms.story1Body',
        points: ['mkt.solp.ms.story1p1', 'mkt.solp.ms.story1p2', 'mkt.solp.ms.story1p3'],
      },
      {
        shot: '/marketing/shot-media.png',
        shotLabelKey: 'mkt.showcase.media',
        titleKey: 'mkt.solp.ms.story2Title',
        bodyKey: 'mkt.solp.ms.story2Body',
        points: [...MEDIA_POINTS, 'mkt.solp.ms.story2p3'],
      },
    ],
    benefits: [
      'mkt.solp.ms.benefit1',
      'mkt.solp.ms.benefit2',
      'mkt.solp.ms.benefit3',
      'mkt.solp.ms.benefit4',
    ],
  },

  // ----------------------------------------------------------
  // 5 · Agencies & Teams
  // ----------------------------------------------------------
  {
    slug: 'agencies',
    icon: Users,
    menuTitleKey: 'mkt.menu.agencies',
    menuDescKey: 'mkt.menu.agenciesDesc',
    heroTitleKey: 'mkt.solp.ag.heroTitle',
    heroBodyKey: 'mkt.solp.ag.heroBody',
    heroScene: 'agency',
    steps: [
      { icon: Plug, titleKey: 'mkt.solp.ag.step1Title', bodyKey: 'mkt.solp.ag.step1Body' },
      { icon: Users, titleKey: 'mkt.solp.ag.step2Title', bodyKey: 'mkt.solp.ag.step2Body' },
      { icon: ListChecks, titleKey: 'mkt.solp.ag.step3Title', bodyKey: 'mkt.solp.ag.step3Body' },
    ],
    stepsShot: '/marketing/shot-articles.png',
    stepsShotLabelKey: 'mkt.showcase.dashboard',
    stories: [
      {
        shot: '/marketing/shot-dashboard.png',
        shotLabelKey: 'mkt.showcase.dashboard',
        titleKey: 'mkt.solp.ag.story1Title',
        bodyKey: 'mkt.solp.ag.story1Body',
        points: ['mkt.solp.ag.story1p1', 'mkt.solp.ag.story1p2', 'mkt.solp.ag.story1p3'],
      },
      {
        shot: '/marketing/shot-articles.png',
        shotLabelKey: 'mkt.showcase.dashboard',
        titleKey: 'mkt.solp.ag.story2Title',
        bodyKey: 'mkt.solp.ag.story2Body',
        points: ['mkt.solp.ag.story2p1', 'mkt.solp.ag.story2p2', 'mkt.solp.ag.story2p3'],
      },
    ],
    benefits: [
      'mkt.solp.ag.benefit1',
      'mkt.solp.ag.benefit2',
      'mkt.solp.ag.benefit3',
      'mkt.solp.ag.benefit4',
    ],
  },

  // ----------------------------------------------------------
  // 6 · Integrations (WordPress & REST CMS)
  // ----------------------------------------------------------
  {
    slug: 'integrations',
    icon: Plug,
    menuTitleKey: 'mkt.menu.integrations',
    menuDescKey: 'mkt.menu.integrationsDesc',
    heroTitleKey: 'mkt.solp.in.heroTitle',
    heroBodyKey: 'mkt.solp.in.heroBody',
    heroScene: 'integrations',
    steps: [
      { icon: Plug, titleKey: 'mkt.solp.in.step1Title', bodyKey: 'mkt.solp.in.step1Body' },
      { icon: Layers, titleKey: 'mkt.solp.in.step2Title', bodyKey: 'mkt.solp.in.step2Body' },
      { icon: Zap, titleKey: 'mkt.solp.in.step3Title', bodyKey: 'mkt.solp.in.step3Body' },
    ],
    stepsShot: '/marketing/shot-automation.png',
    stepsShotLabelKey: 'mkt.showcase.automation',
    stories: [
      {
        shot: '/marketing/shot-ai.png',
        shotLabelKey: 'mkt.showcase.ai',
        titleKey: 'mkt.solp.in.story1Title',
        bodyKey: 'mkt.solp.in.story1Body',
        points: ['mkt.solp.in.story1p1', 'mkt.solp.in.story1p2', 'mkt.solp.in.story1p3'],
      },
      {
        // The integrations story pair closes on the open-platform
        // card grid (real integration list) instead of a second
        // screenshot — an honest, info-dense visual.
        illustration: 'integrations',
        titleKey: 'mkt.solp.in.story2Title',
        bodyKey: 'mkt.solp.in.story2Body',
        points: ['mkt.solp.in.story2p1', 'mkt.solp.in.story2p2', 'mkt.solp.in.story2p3'],
      },
    ],
    benefits: [
      'mkt.solp.in.benefit1',
      'mkt.solp.in.benefit2',
      'mkt.solp.in.benefit3',
      'mkt.solp.in.benefit4',
    ],
  },
];

export const SOLUTION_BY_SLUG: Record<string, SolutionDef> = Object.fromEntries(
  SOLUTION_CATALOG.map((s) => [s.slug, s]),
);

export const solutionHref = (slug: string) => `#/solutions/${slug}`;

// ---- Shared "use cases" cards (detail pages + overview) ----
// Audience one-liners link to the solution page that serves them.

export interface UseCaseCard {
  anchor: string;
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
  href: string;
}

export const USE_CASE_CARDS: UseCaseCard[] = [
  {
    anchor: 'bloggers',
    icon: PenLine,
    titleKey: 'mkt.uc.bloggers.title',
    bodyKey: 'mkt.solp.uc.bloggers',
    href: solutionHref('content-publishing'),
  },
  {
    anchor: 'publishers',
    icon: Layers,
    titleKey: 'mkt.uc.publishers.title',
    bodyKey: 'mkt.solp.uc.publishers',
    href: solutionHref('automation'),
  },
  {
    anchor: 'agencies',
    icon: Users,
    titleKey: 'mkt.uc.agencies.title',
    bodyKey: 'mkt.solp.uc.agencies',
    href: solutionHref('agencies'),
  },
  {
    anchor: 'teams',
    icon: Network,
    titleKey: 'mkt.solp.uc.teamsTitle',
    bodyKey: 'mkt.solp.uc.teams',
    href: solutionHref('multi-site'),
  },
  {
    anchor: 'seo-teams',
    icon: Search,
    titleKey: 'mkt.uc.seoteams.title',
    bodyKey: 'mkt.solp.uc.seoTeams',
    href: solutionHref('seo'),
  },
  {
    anchor: 'businesses',
    icon: Zap,
    titleKey: 'mkt.uc.businesses.title',
    bodyKey: 'mkt.solp.uc.businesses',
    href: solutionHref('multi-site'),
  },
];
