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
// CONTENT lives in the mkt.privacy.s<N>* i18n keys (en + fr) and
// is composed by the SECTIONS table below — the SAME source the
// dashboard's compact privacy module links against. Strings may
// embed {tokens} (rendered as real links/buttons — see TOKENS)
// and [bracketed placeholders] for the legal team to replace;
// no legal facts (GDPR/CCPA claims, certifications, addresses,
// retention periods…) are ever invented here.
//
// Navigation notes:
//   • TOC entries are <button> + scrollIntoView, NOT <a href="#id">
//     — the marketing site is hash-ROUTED, so a raw fragment link
//     would be parsed as an unknown route ("not found").
//   • Active-section tracking listens on .mkt-scroll-root (the
//     site's scroll container, not window) with rAF throttling.
//   • Smooth scrolling honors prefers-reduced-motion.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { MKT } from './marketing-header';
import { openCookiePreferences } from './cookie-banner';

// -------------------- Content model --------------------

type Block =
  | { kind: 'p'; key: string }
  | { kind: 'h3'; key: string }
  | { kind: 'ul'; items: string[] };

interface PolicySectionData {
  id: string;
  titleKey: string;
  blocks: Block[];
}

// The 20 numbered policy sections (order = document order = TOC order).
const SECTIONS: PolicySectionData[] = [
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

// Every TOC target: the article header first ("Privacy Policy" →
// top of the document), then the 20 sections in order.
const TOP_ID = 'privacy-policy';
const TOC_TARGETS: { id: string; labelKey: string }[] = [
  { id: TOP_ID, labelKey: 'mkt.privacy.title' },
  ...SECTIONS.map((s) => ({ id: s.id, labelKey: s.titleKey })),
];

// -------------------- Inline tokens & placeholders --------------------

type TokenDef =
  | { kind: 'route'; href: string; labelKey: string }
  | { kind: 'scroll'; targetId: string; labelKey: string }
  | { kind: 'action'; labelKey: string };

// {tokens} that may appear inside i18n strings. Labels resolve to
// the same wording used elsewhere on the site (footer / section
// titles), so navigation copy stays consistent in every language.
const TOKENS: Record<string, TokenDef> = {
  terms: { kind: 'route', href: MKT.terms, labelKey: 'mkt.footer.terms' },
  security: { kind: 'route', href: MKT.security, labelKey: 'mkt.footer.security' },
  cookiePrefs: { kind: 'action', labelKey: 'mkt.privacy.manageCookies' },
  serviceProviders: { kind: 'scroll', targetId: 'privacy-service-providers', labelKey: 'mkt.privacy.s10Title' },
  legalRequirements: { kind: 'scroll', targetId: 'privacy-legal-requirements', labelKey: 'mkt.privacy.s11Title' },
  businessTransfers: { kind: 'scroll', targetId: 'privacy-business-transfers', labelKey: 'mkt.privacy.s12Title' },
};

type InlinePart = string | TokenDef | { placeholder: string };

// Split an i18n string into literal text, {token} links and
// [bracketed placeholders] so each can be styled appropriately.
function parseInline(text: string): InlinePart[] {
  return text
    .split(/(\{[a-zA-Z]+\}|\[[^\]]+\])/g)
    .filter((p) => p !== '')
    .map((p) => {
      const token = p.match(/^\{([a-zA-Z]+)\}$/);
      if (token && TOKENS[token[1]]) return TOKENS[token[1]];
      const ph = p.match(/^\[([^\]]+)\]$/);
      if (ph) return { placeholder: ph[1] };
      return p;
    });
}

// Smooth scroll that respects the user's reduced-motion preference
// (the CSS scroll-behavior on .mkt-scroll-root covers the rest).
function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

// Legal links: brand accent, underlined, focus-visible ring.
const INLINE_LINK_CLASS =
  'mkt-focus font-medium text-mkt-accent underline decoration-mkt-accent/30 underline-offset-[3px] transition-colors hover:decoration-mkt-accent';

// Bracketed placeholder: visibly a slot for the legal team.
const PLACEHOLDER_CLASS =
  'rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em] text-text-secondary';

function InlineToken({ def }: { def: TokenDef }) {
  const { t } = useT();
  if (def.kind === 'route') {
    return (
      <a href={def.href} className={INLINE_LINK_CLASS}>
        {t(def.labelKey)}
      </a>
    );
  }
  if (def.kind === 'action') {
    return (
      <button type="button" onClick={openCookiePreferences} className={`cursor-pointer ${INLINE_LINK_CLASS}`}>
        {t(def.labelKey)}
      </button>
    );
  }
  return (
    <button type="button" onClick={() => scrollToId(def.targetId)} className={`cursor-pointer ${INLINE_LINK_CLASS}`}>
      {t(def.labelKey)}
    </button>
  );
}

function RichInline({ text }: { text: string }) {
  const parts = useMemo(() => parseInline(text), [text]);
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === 'string') return <React.Fragment key={i}>{p}</React.Fragment>;
        if ('placeholder' in p) {
          return (
            <span key={i} className={PLACEHOLDER_CLASS} title="Placeholder — replace with verified information">
              [{p.placeholder}]
            </span>
          );
        }
        return <InlineToken key={i} def={p} />;
      })}
    </>
  );
}

// -------------------- Body typography --------------------
// Legal-document measure: 17px body on a 1.75 line-height — the
// same reading rhythm as .mkt-prose, scoped to this page.

const P_CLASS = 'text-[1.0625rem] leading-[1.75] text-text-secondary';
const H3_CLASS = 'text-xl font-semibold tracking-[-0.01em] text-text-primary';

// List item: brand-dot bullet + bold lead-in before the first
// em-dash (a display convention of the section content).
function LegalListItem({ itemKey }: { itemKey: string }) {
  const { t } = useT();
  const raw = t(itemKey);
  const split = raw.split(' — '); // typographic em dash with spaces
  const lead = split.length > 1 ? split.shift() : null;
  const rest = split.join(' — ');
  return (
    <li className="relative pl-5 text-[1.0625rem] leading-[1.7] text-text-secondary">
      <span
        className="absolute left-0 top-[0.66em] h-1.5 w-1.5 rounded-full bg-mkt-accent/70"
        aria-hidden="true"
      />
      {lead && <strong className="font-semibold text-text-primary">{lead}</strong>}
      {lead ? ' — ' : ''}
      <RichInline text={rest} />
    </li>
  );
}

function PolicySection({ index, data }: { index: number; data: PolicySectionData }) {
  const { t } = useT();
  const isContact = data.id === 'privacy-contact';

  return (
    <section id={data.id} aria-labelledby={`${data.id}-heading`} className="scroll-mt-28">
      <h2
        id={`${data.id}-heading`}
        className="mkt-h2 text-[1.75rem] text-text-primary sm:text-[2rem]"
      >
        <span className="mr-3 font-semibold text-text-muted" aria-hidden="true">
          {index}.
        </span>
        {t(data.titleKey)}
      </h2>

      <div className="mt-5 flex flex-col gap-[1.1rem]">
        {data.blocks.map((b, i) => {
          if (b.kind === 'h3') return <h3 key={i} className={H3_CLASS}>{t(b.key)}</h3>;
          if (b.kind === 'p') {
            return (
              <p key={i} className={P_CLASS}>
                <RichInline text={t(b.key)} />
              </p>
            );
          }
          return (
            <ul key={i} className="flex flex-col gap-2.5">
              {b.items.map((itemKey) => (
                <LegalListItem key={itemKey} itemKey={itemKey} />
              ))}
            </ul>
          );
        })}
      </div>

      {/* Contact section — the closing block: a quiet card with the
          privacy contact details (placeholders until the legal team
          fills them in) and a link to the real contact page. */}
      {isContact && (
        <div className="mt-8 rounded-2xl border border-border bg-mkt-surface-2/70 p-6 sm:p-7">
          <p className="text-base font-semibold text-text-primary">{t('mkt.privacy.questions')}</p>
          <dl className="mt-4 flex flex-col gap-2.5 text-[0.9375rem]">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-5">
              <dt className="w-24 shrink-0 text-text-muted">{t('mkt.privacy.contactEmailLabel')}</dt>
              <dd className="leading-relaxed text-text-secondary">
                <span className={PLACEHOLDER_CLASS} title="Placeholder — replace with verified information">
                  [Privacy Contact Email]
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-5">
              <dt className="w-24 shrink-0 text-text-muted">{t('mkt.privacy.contactCompanyLabel')}</dt>
              <dd className="leading-relaxed text-text-secondary">
                <span className={PLACEHOLDER_CLASS} title="Placeholder — replace with verified information">
                  [Company Legal Name]
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-5">
              <dt className="w-24 shrink-0 text-text-muted">{t('mkt.privacy.contactAddressLabel')}</dt>
              <dd className="leading-relaxed text-text-secondary">
                <span className={PLACEHOLDER_CLASS} title="Placeholder — replace with verified information">
                  [Business Address]
                </span>
              </dd>
            </div>
          </dl>
          <a
            href={MKT.contact}
            className="mkt-focus mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-mkt-accent transition-colors hover:underline"
          >
            {t('mkt.privacy.contactCta')}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      )}
    </section>
  );
}

// -------------------- Table of contents --------------------

function TocList({ activeId, onNavigate }: { activeId: string; onNavigate: (id: string) => void }) {
  const { t } = useT();
  return (
    <ul className="flex flex-col">
      {TOC_TARGETS.map((item) => {
        const active = activeId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'location' : undefined}
              className={`mkt-focus flex w-full items-start gap-2.5 border-l-2 py-[0.3rem] pl-3 pr-1 text-left text-[0.8125rem] leading-[1.4] transition-colors ${
                active
                  ? 'border-mkt-accent font-medium text-mkt-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {t(item.labelKey)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// -------------------- Page --------------------

export function PrivacyPage() {
  const { t, locale } = useT();
  const [activeId, setActiveId] = useState<string>(TOP_ID);
  const [tocOpen, setTocOpen] = useState(false);

  const effectiveDate = useMemo(
    () =>
      new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [locale],
  );

  // ---- Active-section tracking ----
  // The marketing site scrolls inside .mkt-scroll-root (not the
  // window), so the listener attaches there. The last target whose
  // top edge has passed the header line (fixed header + breathing
  // room) is the current section; the page bottom pins the last.
  useEffect(() => {
    const root = document.querySelector('.mkt-scroll-root');
    if (!root) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const threshold = 150;
      let current = TOP_ID;
      for (const target of TOC_TARGETS) {
        const el = document.getElementById(target.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= threshold) current = target.id;
        else break;
      }
      if (
        root.scrollHeight - root.scrollTop - root.clientHeight < 8 &&
        TOC_TARGETS.length > 0
      ) {
        current = TOC_TARGETS[TOC_TARGETS.length - 1].id;
      }
      setActiveId((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ---- Per-route meta description (client-side; complements the
  //      route document title set by MarketingSite) ----
  useEffect(() => {
    const el = document.querySelector('meta[name="description"]');
    if (!el) return;
    const previous = el.getAttribute('content');
    el.setAttribute('content', t('mkt.privacy.metaDescription'));
    return () => {
      if (previous !== null) el.setAttribute('content', previous);
    };
  }, [t]);

  const navigate = (id: string) => {
    // On mobile the collapsible TOC sits ABOVE the content: if it is
    // open, collapsing it shifts every section up while the smooth
    // scroll is measuring its target — the section would overshoot.
    // Collapse first, then scroll once the 200ms height transition
    // has settled and the layout is final.
    if (tocOpen) {
      setTocOpen(false);
      window.setTimeout(() => scrollToId(id), 230);
    } else {
      scrollToId(id);
    }
  };

  return (
    <div className="pt-32 pb-24 sm:pt-40">
      <div className="mkt-container max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14">
          {/* ============ Article ============ */}
          <article>
            {/* Compact document header — H1, effective date, intro. */}
            <header id={TOP_ID} className="scroll-mt-28 border-b border-border pb-10">
              <h1 className="mkt-display text-4xl text-text-primary sm:text-5xl">
                {t('mkt.privacy.title')}
              </h1>
              <p className="mt-4 text-sm text-text-muted">
                {t('mkt.privacy.effectiveAsOf')}: {effectiveDate}
              </p>
              <p className={`mt-5 max-w-[46rem] ${P_CLASS}`}>{t('mkt.privacy.intro')}</p>
            </header>

            {/* Mobile / tablet — collapsible "On this page" */}
            <div className="mt-8 lg:hidden">
              <div className="rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setTocOpen((v) => !v)}
                  aria-expanded={tocOpen}
                  className="mkt-focus flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left"
                >
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-text-muted">
                    {t('mkt.privacy.onThisPage')}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${
                      tocOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                    tocOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  {/* Collapsed list stays mounted for the height
                      animation but leaves the a11y tree via inert. */}
                  <div className="overflow-hidden" inert={!tocOpen}>
                    <div className="max-h-80 overflow-y-auto px-5 pb-4 pt-1">
                      <TocList activeId={activeId} onNavigate={navigate} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* The 20 numbered sections */}
            <div className="mt-12 flex flex-col gap-12 sm:gap-14">
              {SECTIONS.map((s, i) => (
                <PolicySection key={s.id} index={i + 1} data={s} />
              ))}
            </div>
          </article>

          {/* ============ Desktop sticky TOC ============ */}
          <aside className="hidden lg:block">
            <nav
              aria-label={t('mkt.privacy.onThisPage')}
              className="sticky top-25 max-h-[calc(100vh-9.5rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5"
            >
              <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-text-muted">
                {t('mkt.privacy.onThisPage')}
              </p>
              <div className="mt-3">
                <TocList activeId={activeId} onNavigate={navigate} />
              </div>
            </nav>
          </aside>
        </div>
      </div>
    </div>
  );
}
