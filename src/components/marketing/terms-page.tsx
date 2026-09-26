'use client';

// ============================================================
// TERMS OF SERVICE — long-form public legal document (#/terms)
// ============================================================
// The direct visual sibling of the Privacy Policy page: it is
// rendered by the SAME <LegalPageLayout> system (legal-
// document.tsx), so header, container, two-column body, sticky
// "On this page" TOC, typography, spacing, colors and responsive
// behavior are identical by construction.
//
// CONTENT lives in the mkt.terms.s<N>* i18n keys (en + fr) and
// is composed by the SECTIONS table below. The document only
// states capabilities that actually exist in the project (plans
// and billing through Stripe, AI features, integrations,
// backups, audit log, per-user roles …); everything unverified
// — liability caps, indemnification, governing law, dispute
// resolution, refund policy … — stays a [bracketed placeholder]
// for the legal team to replace. No legal facts are invented.
// ============================================================

import { MKT } from './marketing-header';
import {
  LegalPageLayout,
  type LegalSectionData,
  type LegalTokenDef,
} from './legal-document';

// -------------------- Content --------------------

// The 23 numbered sections (order = document order = TOC order).
const SECTIONS: LegalSectionData[] = [
  {
    id: 'terms-acceptance',
    titleKey: 'mkt.terms.s1Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s1P1' },
      { kind: 'p', key: 'mkt.terms.s1P2' },
      { kind: 'p', key: 'mkt.terms.s1P3' },
    ],
  },
  {
    id: 'terms-account',
    titleKey: 'mkt.terms.s2Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s2P1' },
      { kind: 'p', key: 'mkt.terms.s2P2' },
      { kind: 'p', key: 'mkt.terms.s2P3' },
      { kind: 'p', key: 'mkt.terms.s2P4' },
    ],
  },
  {
    id: 'terms-service',
    titleKey: 'mkt.terms.s3Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s3P1' },
      { kind: 'p', key: 'mkt.terms.s3P2' },
      { kind: 'p', key: 'mkt.terms.s3P3' },
    ],
  },
  {
    id: 'terms-billing',
    titleKey: 'mkt.terms.s4Title',
    blocks: [
      { kind: 'h3', key: 'mkt.terms.s4H1' },
      { kind: 'p', key: 'mkt.terms.s4P2' },
      { kind: 'h3', key: 'mkt.terms.s4H2' },
      { kind: 'p', key: 'mkt.terms.s4P3' },
      { kind: 'h3', key: 'mkt.terms.s4H3' },
      { kind: 'p', key: 'mkt.terms.s4P4' },
      { kind: 'h3', key: 'mkt.terms.s4H4' },
      { kind: 'p', key: 'mkt.terms.s4P5' },
      { kind: 'h3', key: 'mkt.terms.s4H5' },
      { kind: 'p', key: 'mkt.terms.s4P6' },
      { kind: 'h3', key: 'mkt.terms.s4H6' },
      { kind: 'p', key: 'mkt.terms.s4P7' },
    ],
  },
  {
    id: 'terms-trials',
    titleKey: 'mkt.terms.s5Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s5P1' },
      { kind: 'p', key: 'mkt.terms.s5P2' },
    ],
  },
  {
    id: 'terms-acceptable-use',
    titleKey: 'mkt.terms.s6Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s6P1' },
      {
        kind: 'ul',
        items: [
          'mkt.terms.s6L1',
          'mkt.terms.s6L2',
          'mkt.terms.s6L3',
          'mkt.terms.s6L4',
          'mkt.terms.s6L5',
          'mkt.terms.s6L6',
          'mkt.terms.s6L7',
        ],
      },
      { kind: 'p', key: 'mkt.terms.s6P2' },
    ],
  },
  {
    id: 'terms-user-content',
    titleKey: 'mkt.terms.s7Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s7P1' },
      { kind: 'p', key: 'mkt.terms.s7P2' },
      { kind: 'p', key: 'mkt.terms.s7P3' },
    ],
  },
  {
    id: 'terms-ip',
    titleKey: 'mkt.terms.s8Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s8P1' },
      { kind: 'p', key: 'mkt.terms.s8P2' },
    ],
  },
  {
    id: 'terms-third-party',
    titleKey: 'mkt.terms.s9Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s9P1' },
      { kind: 'p', key: 'mkt.terms.s9P2' },
    ],
  },
  {
    id: 'terms-ai',
    titleKey: 'mkt.terms.s10Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s10P1' },
      { kind: 'p', key: 'mkt.terms.s10P2' },
      { kind: 'p', key: 'mkt.terms.s10P3' },
      { kind: 'p', key: 'mkt.terms.s10P4' },
    ],
  },
  {
    id: 'terms-privacy',
    titleKey: 'mkt.terms.s11Title',
    blocks: [{ kind: 'p', key: 'mkt.terms.s11P1' }],
  },
  {
    id: 'terms-security',
    titleKey: 'mkt.terms.s12Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s12P1' },
      { kind: 'p', key: 'mkt.terms.s12P2' },
    ],
  },
  {
    id: 'terms-availability',
    titleKey: 'mkt.terms.s13Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s13P1' },
      { kind: 'p', key: 'mkt.terms.s13P2' },
    ],
  },
  {
    id: 'terms-termination',
    titleKey: 'mkt.terms.s14Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s14P1' },
      { kind: 'p', key: 'mkt.terms.s14P2' },
      { kind: 'p', key: 'mkt.terms.s14P3' },
    ],
  },
  {
    id: 'terms-disclaimers',
    titleKey: 'mkt.terms.s15Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s15P1' },
      { kind: 'p', key: 'mkt.terms.s15P2' },
    ],
  },
  {
    id: 'terms-liability',
    titleKey: 'mkt.terms.s16Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s16P1' },
      { kind: 'p', key: 'mkt.terms.s16P2' },
    ],
  },
  {
    id: 'terms-indemnification',
    titleKey: 'mkt.terms.s17Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s17P1' },
      { kind: 'p', key: 'mkt.terms.s17P2' },
    ],
  },
  {
    id: 'terms-service-changes',
    titleKey: 'mkt.terms.s18Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s18P1' },
      { kind: 'p', key: 'mkt.terms.s18P2' },
    ],
  },
  {
    id: 'terms-terms-changes',
    titleKey: 'mkt.terms.s19Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s19P1' },
      { kind: 'p', key: 'mkt.terms.s19P2' },
    ],
  },
  {
    id: 'terms-governing-law',
    titleKey: 'mkt.terms.s20Title',
    blocks: [{ kind: 'p', key: 'mkt.terms.s20P1' }],
  },
  {
    id: 'terms-disputes',
    titleKey: 'mkt.terms.s21Title',
    blocks: [
      { kind: 'p', key: 'mkt.terms.s21P1' },
      { kind: 'p', key: 'mkt.terms.s21P2' },
    ],
  },
  {
    id: 'terms-general',
    titleKey: 'mkt.terms.s22Title',
    blocks: [
      { kind: 'h3', key: 'mkt.terms.s22H1' },
      { kind: 'p', key: 'mkt.terms.s22P1' },
      { kind: 'h3', key: 'mkt.terms.s22H2' },
      { kind: 'p', key: 'mkt.terms.s22P2' },
      { kind: 'h3', key: 'mkt.terms.s22H3' },
      { kind: 'p', key: 'mkt.terms.s22P3' },
      { kind: 'h3', key: 'mkt.terms.s22H4' },
      { kind: 'p', key: 'mkt.terms.s22P4' },
      { kind: 'h3', key: 'mkt.terms.s22H5' },
      { kind: 'p', key: 'mkt.terms.s22P5' },
    ],
  },
  {
    id: 'terms-contact',
    titleKey: 'mkt.terms.s23Title',
    blocks: [{ kind: 'p', key: 'mkt.terms.s23P1' }],
  },
];

// {tokens} that may appear inside i18n strings. Labels resolve to
// the same wording used elsewhere on the site (footer / nav), so
// navigation copy stays consistent in every language.
const TOKENS: Record<string, LegalTokenDef> = {
  privacy: { kind: 'route', href: MKT.privacy, labelKey: 'mkt.footer.privacy' },
  security: { kind: 'route', href: MKT.security, labelKey: 'mkt.footer.security' },
  pricing: { kind: 'route', href: MKT.pricing, labelKey: 'mkt.nav.pricing' },
};

// -------------------- Page --------------------

export function TermsPage() {
  return (
    <LegalPageLayout
      topId="terms-of-service"
      titleKey="mkt.terms.title"
      effectiveAsOfKey="mkt.terms.effectiveAsOf"
      introKey="mkt.terms.intro"
      onThisPageKey="mkt.terms.onThisPage"
      metaDescriptionKey="mkt.terms.metaDescription"
      sections={SECTIONS}
      tokens={TOKENS}
      contact={{
        sectionId: 'terms-contact',
        questionsKey: 'mkt.terms.questions',
        rows: [
          { labelKey: 'mkt.terms.contactEmailLabel', placeholder: 'Legal Contact Email' },
          { labelKey: 'mkt.terms.contactCompanyLabel', placeholder: 'Company Legal Name' },
        ],
        ctaKey: 'mkt.terms.contactCta',
        ctaHref: MKT.contact,
      }}
    />
  );
}
