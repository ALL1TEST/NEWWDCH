'use client';

// ============================================================
// SECURITY — long-form public trust document (#/security)
// ============================================================
// The direct visual sibling of the Privacy Policy and Terms of
// Service pages: it is rendered by the SAME <LegalPageLayout>
// system (legal-document.tsx), so header, container, two-column
// body, sticky "On this page" TOC, typography, spacing, colors
// and responsive behavior are identical by construction.
//
// CONTENT lives in the mkt.security.s<N>* i18n keys (en + fr)
// and is composed by the SECTIONS table below. The document
// only states security capabilities that actually exist in the
// project (email + password sign-in, password change, sessions
// ending on sign-out, per-user roles, per-site workspace
// separation, audit log, on-demand and scheduled backups with
// restore, data export and deletion, HTTPS, validated API
// inputs, Stripe / AI provider / SMTP / Akismet integrations).
// Everything unverified — encryption-at-rest specifics, hosting
// details, backup policies, monitoring vendors, employee
// practices, uptime commitments, notification timelines —
// stays a [bracketed placeholder]. No security claims are
// invented (no certifications, no WAF/DDoS products, no
// specific algorithms, no SLA percentages).
// ============================================================

import { MKT } from './marketing-header';
import {
  LegalPageLayout,
  type LegalSectionData,
  type LegalTokenDef,
} from './legal-document';

// -------------------- Content --------------------

// The 17 numbered sections (order = document order = TOC order).
const SECTIONS: LegalSectionData[] = [
  {
    id: 'security-overview',
    titleKey: 'mkt.security.s1Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s1P1' },
      { kind: 'p', key: 'mkt.security.s1P2' },
      { kind: 'p', key: 'mkt.security.s1P3' },
    ],
  },
  {
    id: 'security-infrastructure',
    titleKey: 'mkt.security.s2Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s2P1' },
      { kind: 'p', key: 'mkt.security.s2P2' },
    ],
  },
  {
    id: 'security-encryption',
    titleKey: 'mkt.security.s3Title',
    blocks: [
      { kind: 'h3', key: 'mkt.security.s3H1' },
      { kind: 'p', key: 'mkt.security.s3P1' },
      { kind: 'h3', key: 'mkt.security.s3H2' },
      { kind: 'p', key: 'mkt.security.s3P2' },
    ],
  },
  {
    id: 'security-access-controls',
    titleKey: 'mkt.security.s4Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s4P1' },
      { kind: 'p', key: 'mkt.security.s4P2' },
      { kind: 'p', key: 'mkt.security.s4P3' },
    ],
  },
  {
    id: 'security-authentication',
    titleKey: 'mkt.security.s5Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s5P1' },
      { kind: 'p', key: 'mkt.security.s5P2' },
      { kind: 'p', key: 'mkt.security.s5P3' },
    ],
  },
  {
    id: 'security-application',
    titleKey: 'mkt.security.s6Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s6P1' },
      { kind: 'p', key: 'mkt.security.s6P2' },
      { kind: 'p', key: 'mkt.security.s6P3' },
    ],
  },
  {
    id: 'security-network',
    titleKey: 'mkt.security.s7Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s7P1' },
      { kind: 'p', key: 'mkt.security.s7P2' },
    ],
  },
  {
    id: 'security-data-protection',
    titleKey: 'mkt.security.s8Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s8P1' },
      { kind: 'p', key: 'mkt.security.s8P2' },
      { kind: 'p', key: 'mkt.security.s8P3' },
    ],
  },
  {
    id: 'security-backups',
    titleKey: 'mkt.security.s9Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s9P1' },
      { kind: 'p', key: 'mkt.security.s9P2' },
    ],
  },
  {
    id: 'security-monitoring',
    titleKey: 'mkt.security.s10Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s10P1' },
      { kind: 'p', key: 'mkt.security.s10P2' },
    ],
  },
  {
    id: 'security-incident-response',
    titleKey: 'mkt.security.s11Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s11P1' },
      { kind: 'h3', key: 'mkt.security.s11H1' },
      { kind: 'p', key: 'mkt.security.s11P2' },
      { kind: 'h3', key: 'mkt.security.s11H2' },
      { kind: 'p', key: 'mkt.security.s11P3' },
      { kind: 'h3', key: 'mkt.security.s11H3' },
      { kind: 'p', key: 'mkt.security.s11P4' },
      { kind: 'h3', key: 'mkt.security.s11H4' },
      { kind: 'p', key: 'mkt.security.s11P5' },
      { kind: 'h3', key: 'mkt.security.s11H5' },
      { kind: 'p', key: 'mkt.security.s11P6' },
    ],
  },
  {
    id: 'security-third-party',
    titleKey: 'mkt.security.s12Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s12P1' },
      { kind: 'p', key: 'mkt.security.s12P2' },
    ],
  },
  {
    id: 'security-employees',
    titleKey: 'mkt.security.s13Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s13P1' },
      { kind: 'p', key: 'mkt.security.s13P2' },
    ],
  },
  {
    id: 'security-availability',
    titleKey: 'mkt.security.s14Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s14P1' },
      { kind: 'p', key: 'mkt.security.s14P2' },
    ],
  },
  {
    id: 'security-responsibilities',
    titleKey: 'mkt.security.s15Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s15P1' },
      {
        kind: 'ul',
        items: [
          'mkt.security.s15L1',
          'mkt.security.s15L2',
          'mkt.security.s15L3',
          'mkt.security.s15L4',
          'mkt.security.s15L5',
        ],
      },
      { kind: 'p', key: 'mkt.security.s15P2' },
    ],
  },
  {
    id: 'security-reporting',
    titleKey: 'mkt.security.s16Title',
    blocks: [
      { kind: 'p', key: 'mkt.security.s16P1' },
      { kind: 'p', key: 'mkt.security.s16P2' },
      { kind: 'p', key: 'mkt.security.s16P3' },
      { kind: 'p', key: 'mkt.security.s16P4' },
    ],
  },
  {
    id: 'security-contact',
    titleKey: 'mkt.security.s17Title',
    blocks: [{ kind: 'p', key: 'mkt.security.s17P1' }],
  },
];

// {tokens} that may appear inside i18n strings. Labels resolve to
// the same wording used elsewhere on the site (footer / nav), so
// navigation copy stays consistent in every language.
const TOKENS: Record<string, LegalTokenDef> = {
  privacy: { kind: 'route', href: MKT.privacy, labelKey: 'mkt.footer.privacy' },
  terms: { kind: 'route', href: MKT.terms, labelKey: 'mkt.footer.terms' },
};

// -------------------- Page --------------------

export function SecurityPage() {
  return (
    <LegalPageLayout
      topId="security"
      titleKey="mkt.security.title"
      effectiveAsOfKey="mkt.security.lastUpdated"
      introKey="mkt.security.intro"
      onThisPageKey="mkt.security.onThisPage"
      metaDescriptionKey="mkt.security.metaDescription"
      sections={SECTIONS}
      tokens={TOKENS}
      contact={{
        sectionId: 'security-contact',
        questionsKey: 'mkt.security.questions',
        rows: [
          { labelKey: 'mkt.security.contactEmailLabel', placeholder: 'Security Contact Email' },
        ],
        ctaKey: 'mkt.security.contactCta',
        ctaHref: MKT.contact,
      }}
    />
  );
}
