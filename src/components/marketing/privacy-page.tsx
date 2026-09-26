'use client';

// ============================================================
// PRIVACY POLICY — long-form public legal document (#/privacy)
// ============================================================
// A production-quality SaaS editorial legal page:
//
//   header (compact)  →  H1 + "Effective as of" + intro
//   two-column body   →  article (~70-75%) + sticky TOC (~25-30%)
//   mobile            →  single column + collapsible "On this page"
//
// The page SHARES its layout system with the other public legal
// documents (Terms of Service, …) via <LegalPageLayout> in
// legal-document.tsx — sibling legal pages are rendered by the
// exact same components, so they stay visually identical.
//
// CONTENT lives in the mkt.privacy.s<N>* i18n keys (en + fr) and
// is composed by the SECTIONS table below — the SAME source the
// dashboard's compact privacy module links against. Strings may
// embed {tokens} (rendered as real links/buttons — see TOKENS)
// and [bracketed placeholders] for the legal team to replace;
// no legal facts (GDPR/CCPA claims, certifications, addresses,
// retention periods…) are ever invented here.
// ============================================================

import { MKT } from './marketing-header';
import {
  LegalPageLayout,
  type LegalSectionData,
  type LegalTokenDef,
} from './legal-document';

// -------------------- Content --------------------

// The 20 numbered policy sections (order = document order = TOC order).
const SECTIONS: LegalSectionData[] = [
  {
    id: 'privacy-scope',
    titleKey: 'mkt.privacy.s1Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s1P1' },
      { kind: 'p', key: 'mkt.privacy.s1P2' },
    ],
  },
  {
    id: 'privacy-collection',
    titleKey: 'mkt.privacy.s2Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s2P1' },
      { kind: 'h3', key: 'mkt.privacy.s2H1' },
      { kind: 'p', key: 'mkt.privacy.s2P2' },
      { kind: 'h3', key: 'mkt.privacy.s2H2' },
      { kind: 'p', key: 'mkt.privacy.s2P3' },
    ],
  },
  {
    id: 'privacy-purpose',
    titleKey: 'mkt.privacy.s3Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s3P1' },
      { kind: 'p', key: 'mkt.privacy.s3P2' },
    ],
  },
  {
    id: 'privacy-provided',
    titleKey: 'mkt.privacy.s4Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s4P1' },
      { kind: 'ul', items: ['mkt.privacy.s4L1', 'mkt.privacy.s4L2', 'mkt.privacy.s4L3'] },
      { kind: 'p', key: 'mkt.privacy.s4P2' },
    ],
  },
  {
    id: 'privacy-automatic',
    titleKey: 'mkt.privacy.s5Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s5P1' },
      { kind: 'ul', items: ['mkt.privacy.s5L1', 'mkt.privacy.s5L2'] },
      { kind: 'p', key: 'mkt.privacy.s5P2' },
    ],
  },
  {
    id: 'privacy-sources',
    titleKey: 'mkt.privacy.s6Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s6P1' },
      { kind: 'p', key: 'mkt.privacy.s6P2' },
    ],
  },
  {
    id: 'privacy-use',
    titleKey: 'mkt.privacy.s7Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s7P1' },
      {
        kind: 'ul',
        items: [
          'mkt.privacy.s7L1',
          'mkt.privacy.s7L2',
          'mkt.privacy.s7L3',
          'mkt.privacy.s7L4',
          'mkt.privacy.s7L5',
          'mkt.privacy.s7L6',
        ],
      },
      { kind: 'p', key: 'mkt.privacy.s7P2' },
    ],
  },
  {
    id: 'privacy-cookies',
    titleKey: 'mkt.privacy.s8Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s8P1' },
      { kind: 'ul', items: ['mkt.privacy.s8L1', 'mkt.privacy.s8L2'] },
      { kind: 'p', key: 'mkt.privacy.s8P2' },
      { kind: 'p', key: 'mkt.privacy.s8P3' },
    ],
  },
  {
    id: 'privacy-disclosure',
    titleKey: 'mkt.privacy.s9Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s9P1' },
      { kind: 'ul', items: ['mkt.privacy.s9L1', 'mkt.privacy.s9L2', 'mkt.privacy.s9L3'] },
      { kind: 'p', key: 'mkt.privacy.s9P2' },
    ],
  },
  {
    id: 'privacy-service-providers',
    titleKey: 'mkt.privacy.s10Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s10P1' },
      { kind: 'ul', items: ['mkt.privacy.s10L1', 'mkt.privacy.s10L2'] },
      { kind: 'p', key: 'mkt.privacy.s10P2' },
    ],
  },
  {
    id: 'privacy-legal-requirements',
    titleKey: 'mkt.privacy.s11Title',
    blocks: [{ kind: 'p', key: 'mkt.privacy.s11P1' }],
  },
  {
    id: 'privacy-business-transfers',
    titleKey: 'mkt.privacy.s12Title',
    blocks: [{ kind: 'p', key: 'mkt.privacy.s12P1' }],
  },
  {
    id: 'privacy-affiliates',
    titleKey: 'mkt.privacy.s13Title',
    blocks: [{ kind: 'p', key: 'mkt.privacy.s13P1' }],
  },
  {
    id: 'privacy-retention',
    titleKey: 'mkt.privacy.s14Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s14P1' },
      { kind: 'p', key: 'mkt.privacy.s14P2' },
    ],
  },
  {
    id: 'privacy-data-security',
    titleKey: 'mkt.privacy.s15Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s15P1' },
      { kind: 'p', key: 'mkt.privacy.s15P2' },
    ],
  },
  {
    id: 'privacy-international',
    titleKey: 'mkt.privacy.s16Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s16P1' },
      { kind: 'p', key: 'mkt.privacy.s16P2' },
    ],
  },
  {
    id: 'privacy-rights',
    titleKey: 'mkt.privacy.s17Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s17P1' },
      {
        kind: 'ul',
        items: [
          'mkt.privacy.s17L1',
          'mkt.privacy.s17L2',
          'mkt.privacy.s17L3',
          'mkt.privacy.s17L4',
          'mkt.privacy.s17L5',
          'mkt.privacy.s17L6',
          'mkt.privacy.s17L7',
        ],
      },
      { kind: 'p', key: 'mkt.privacy.s17P2' },
    ],
  },
  {
    id: 'privacy-children',
    titleKey: 'mkt.privacy.s18Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s18P1' },
      { kind: 'p', key: 'mkt.privacy.s18P2' },
    ],
  },
  {
    id: 'privacy-changes',
    titleKey: 'mkt.privacy.s19Title',
    blocks: [
      { kind: 'p', key: 'mkt.privacy.s19P1' },
      { kind: 'p', key: 'mkt.privacy.s19P2' },
    ],
  },
  {
    id: 'privacy-contact',
    titleKey: 'mkt.privacy.s20Title',
    blocks: [{ kind: 'p', key: 'mkt.privacy.s20P1' }],
  },
];

// {tokens} that may appear inside i18n strings. Labels resolve to
// the same wording used elsewhere on the site (footer / section
// titles), so navigation copy stays consistent in every language.
const TOKENS: Record<string, LegalTokenDef> = {
  terms: { kind: 'route', href: MKT.terms, labelKey: 'mkt.footer.terms' },
  security: { kind: 'route', href: MKT.security, labelKey: 'mkt.footer.security' },
  cookiePrefs: { kind: 'action', labelKey: 'mkt.privacy.manageCookies' },
  serviceProviders: { kind: 'scroll', targetId: 'privacy-service-providers', labelKey: 'mkt.privacy.s10Title' },
  legalRequirements: { kind: 'scroll', targetId: 'privacy-legal-requirements', labelKey: 'mkt.privacy.s11Title' },
  businessTransfers: { kind: 'scroll', targetId: 'privacy-business-transfers', labelKey: 'mkt.privacy.s12Title' },
};

// -------------------- Page --------------------

export function PrivacyPage() {
  return (
    <LegalPageLayout
      topId="privacy-policy"
      titleKey="mkt.privacy.title"
      effectiveAsOfKey="mkt.privacy.effectiveAsOf"
      introKey="mkt.privacy.intro"
      onThisPageKey="mkt.privacy.onThisPage"
      metaDescriptionKey="mkt.privacy.metaDescription"
      sections={SECTIONS}
      tokens={TOKENS}
      contact={{
        sectionId: 'privacy-contact',
        questionsKey: 'mkt.privacy.questions',
        rows: [
          { labelKey: 'mkt.privacy.contactEmailLabel', placeholder: 'Privacy Contact Email' },
          { labelKey: 'mkt.privacy.contactCompanyLabel', placeholder: 'Company Legal Name' },
          { labelKey: 'mkt.privacy.contactAddressLabel', placeholder: 'Business Address' },
        ],
        ctaKey: 'mkt.privacy.contactCta',
        ctaHref: MKT.contact,
      }}
    />
  );
}
