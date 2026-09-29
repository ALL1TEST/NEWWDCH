'use client';

// ============================================================
// LEGAL DOCUMENT SYSTEM — shared long-form legal page shell
// ============================================================
// Extracted from the Privacy Policy page so that every public
// legal document (Privacy Policy, Terms of Service, …) renders
// with EXACTLY the same design system:
//
//   header (compact)  →  H1 + "Effective as of" + intro
//   two-column body   →  article (~70-75%) + sticky TOC (~25-30%)
//   mobile            →  single column + collapsible "On this page"
//
// Usage — each legal page defines its content and renders the
// SAME layout, so sibling pages are visually identical:
//
//   <LegalPageLayout {…props} />          (see privacy-page.tsx,
//                                          terms-page.tsx)
//
// CONTENT lives in per-page i18n keys (en + fr). Strings may
// embed {tokens} (rendered as real links/buttons — provided by
// each page's token map) and [bracketed placeholders] for the
// legal team to replace; no legal facts are ever invented here.
//
// Navigation notes:
//   • TOC entries are <button> + scrollIntoView, NOT <a href="#id">
//     — the marketing site is hash-ROUTED, so a raw fragment link
//     would be parsed as an unknown route ("not found").
//   • Active-section tracking listens on .mkt-scroll-root (the
//     site's scroll container, not window) with rAF throttling.
//   • Smooth scrolling honors prefers-reduced-motion.
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { openCookiePreferences } from './cookie-banner';

// -------------------- Content model --------------------

export type LegalBlock =
  | { kind: 'p'; key: string }
  | { kind: 'h3'; key: string }
  | { kind: 'ul'; items: string[] };

export interface LegalSectionData {
  id: string;
  titleKey: string;
  blocks: LegalBlock[];
}

// {tokens} that may appear inside i18n strings. Each legal page
// provides its own map; labels resolve to the same wording used
// elsewhere on the site (footer / section titles), so navigation
// copy stays consistent in every language.
export type LegalTokenDef =
  | { kind: 'route'; href: string; labelKey: string }
  | { kind: 'scroll'; targetId: string; labelKey: string }
  | { kind: 'action'; labelKey: string };

// The closing contact card: rendered inside the section whose id
// matches `sectionId`. Rows show [bracketed placeholders] until
// the legal team fills them in.
export interface LegalContactConfig {
  sectionId: string;
  questionsKey: string;
  rows: { labelKey: string; placeholder: string }[];
  ctaKey: string;
  ctaHref: string;
}

export interface LegalPageLayoutProps {
  /** Anchor id of the document header (first TOC target). */
  topId: string;
  titleKey: string;
  effectiveAsOfKey: string;
  introKey: string;
  onThisPageKey: string;
  metaDescriptionKey: string;
  sections: LegalSectionData[];
  tokens: Record<string, LegalTokenDef>;
  contact: LegalContactConfig;
}

// -------------------- Inline tokens & placeholders --------------------

type InlinePart = string | LegalTokenDef | { placeholder: string };

// Split an i18n string into literal text, {token} links and
// [bracketed placeholders] so each can be styled appropriately.
function parseInline(text: string, tokens: Record<string, LegalTokenDef>): InlinePart[] {
  return text
    .split(/(\{[a-zA-Z]+\}|\[[^\]]+\])/g)
    .filter((p) => p !== '')
    .map((p) => {
      const token = p.match(/^\{([a-zA-Z]+)\}$/);
      if (token && tokens[token[1]]) return tokens[token[1]];
      const ph = p.match(/^\[([^\]]+)\]$/);
      if (ph) return { placeholder: ph[1] };
      return p;
    });
}

// Smooth scroll that respects the user's reduced-motion preference
// (the CSS scroll-behavior on .mkt-scroll-root covers the rest).
export function scrollToLegalId(id: string) {
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

function InlineToken({ def }: { def: LegalTokenDef }) {
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
    <button type="button" onClick={() => scrollToLegalId(def.targetId)} className={`cursor-pointer ${INLINE_LINK_CLASS}`}>
      {t(def.labelKey)}
    </button>
  );
}

// Per-page tokens reach the deep RichInline renders via context.
const LegalTokensContext = createContext<Record<string, LegalTokenDef>>({});

function RichInline({ text }: { text: string }) {
  const tokens = useContext(LegalTokensContext);
  const parts = useMemo(() => parseInline(text, tokens), [text, tokens]);
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
// same reading rhythm as .mkt-prose, scoped to legal pages.

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

function LegalSection({
  index,
  data,
  contact,
}: {
  index: number;
  data: LegalSectionData;
  contact: LegalContactConfig;
}) {
  const { t } = useT();
  const isContact = data.id === contact.sectionId;

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
          document's contact details (placeholders until the legal
          team fills them in) and a link to the real contact page. */}
      {isContact && (
        <div className="mt-8 rounded-2xl border border-border bg-mkt-surface-2/70 p-6 sm:p-7">
          <p className="text-base font-semibold text-text-primary">{t(contact.questionsKey)}</p>
          <dl className="mt-4 flex flex-col gap-2.5 text-[0.9375rem]">
            {contact.rows.map((row) => (
              <div key={row.labelKey} className="flex flex-col gap-0.5 sm:flex-row sm:gap-5">
                <dt className="w-24 shrink-0 text-text-muted">{t(row.labelKey)}</dt>
                <dd className="leading-relaxed text-text-secondary">
                  <span className={PLACEHOLDER_CLASS} title="Placeholder — replace with verified information">
                    [{row.placeholder}]
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <a
            href={contact.ctaHref}
            className="mkt-focus mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-mkt-accent transition-colors hover:underline"
          >
            {t(contact.ctaKey)}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      )}
    </section>
  );
}

// -------------------- Table of contents --------------------

interface TocTarget {
  id: string;
  labelKey: string;
}

function TocList({
  targets,
  activeId,
  onNavigate,
}: {
  targets: TocTarget[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  const { t } = useT();
  return (
    <ul className="flex flex-col">
      {targets.map((item) => {
        const active = activeId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'location' : undefined}
              className={`mkt-focus flex w-full items-start gap-2.5 border-l-2 py-[0.25rem] pl-3 pr-1 text-left text-[0.8125rem] leading-[1.35] transition-colors ${
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

// -------------------- Layout --------------------

export function LegalPageLayout({
  topId,
  titleKey,
  effectiveAsOfKey,
  introKey,
  onThisPageKey,
  metaDescriptionKey,
  sections,
  tokens,
  contact,
}: LegalPageLayoutProps) {
  const { t, locale } = useT();
  const [activeId, setActiveId] = useState<string>(topId);
  const [tocOpen, setTocOpen] = useState(false);

  // Every TOC target: the article header first (page title →
  // top of the document), then the sections in order.
  const tocTargets: TocTarget[] = useMemo(
    () => [{ id: topId, labelKey: titleKey }, ...sections.map((s) => ({ id: s.id, labelKey: s.titleKey }))],
    [topId, titleKey, sections],
  );

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
      let current = topId;
      for (const target of tocTargets) {
        const el = document.getElementById(target.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= threshold) current = target.id;
        else break;
      }
      if (
        root.scrollHeight - root.scrollTop - root.clientHeight < 8 &&
        tocTargets.length > 0
      ) {
        current = tocTargets[tocTargets.length - 1].id;
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
  }, [topId, tocTargets]);

  // ---- Per-route meta description (client-side; complements the
  //      route document title set by MarketingSite) ----
  useEffect(() => {
    const el = document.querySelector('meta[name="description"]');
    if (!el) return;
    const previous = el.getAttribute('content');
    el.setAttribute('content', t(metaDescriptionKey));
    return () => {
      if (previous !== null) el.setAttribute('content', previous);
    };
  }, [t, metaDescriptionKey]);

  const navigate = (id: string) => {
    // On mobile the collapsible TOC sits ABOVE the content: if it is
    // open, collapsing it shifts every section up while the smooth
    // scroll is measuring its target — the section would overshoot.
    // Collapse first, then scroll once the 200ms height transition
    // has settled and the layout is final.
    if (tocOpen) {
      setTocOpen(false);
      window.setTimeout(() => scrollToLegalId(id), 230);
    } else {
      scrollToLegalId(id);
    }
  };

  return (
    <LegalTokensContext.Provider value={tokens}>
      <div className="pt-32 pb-24 sm:pt-40">
        <div className="mkt-container max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14">
            {/* ============ Article ============ */}
            <article>
              {/* Compact document header — H1, effective date, intro. */}
              <header id={topId} className="scroll-mt-28 border-b border-border pb-10">
                <h1 className="mkt-display text-4xl text-text-primary sm:text-5xl">
                  {t(titleKey)}
                </h1>
                <p className="mt-4 text-sm text-text-muted">
                  {t(effectiveAsOfKey)}: {effectiveDate}
                </p>
                <p className={`mt-5 max-w-[46rem] ${P_CLASS}`}>{t(introKey)}</p>
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
                      {t(onThisPageKey)}
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
                      <div className="max-h-80 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-5 pb-4 pt-1">
                        <TocList targets={tocTargets} activeId={activeId} onNavigate={navigate} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* The numbered sections */}
              <div className="mt-12 flex flex-col gap-12 sm:gap-14">
                {sections.map((s, i) => (
                  <LegalSection key={s.id} index={i + 1} data={s} contact={contact} />
                ))}
              </div>
            </article>

            {/* ============ Desktop sticky TOC ============ */}
            <aside className="hidden lg:block">
              <nav
                aria-label={t(onThisPageKey)}
                className="sticky top-25 rounded-2xl border border-border bg-card p-4"
              >
                <TocList targets={tocTargets} activeId={activeId} onNavigate={navigate} />
              </nav>
            </aside>
          </div>
        </div>
      </div>
    </LegalTokensContext.Provider>
  );
}
