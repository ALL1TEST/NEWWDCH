'use client';

// ============================================================
// SOLUTIONS + LEGAL + CONTACT pages
// ============================================================
// The legal pages (privacy/terms/security/accessibility), the
// legal center, and the contact page. All content is product-
// honest — no invented team, stats or claims.
// (The About experience now lives in about-page.tsx.)
// ============================================================

import React from 'react';
import {
  Accessibility,
  BookOpen,
  Cookie,
  CreditCard,
  Lock,
  MessagesSquare,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Eyebrow, Reveal } from './primitives';
import { MKT } from './marketing-header';
import { openCookiePreferences } from './cookie-banner';

// (The About page now lives in about-page.tsx; the Solutions
// experience lives in solutions-overview.tsx + solution-page.tsx
// — editorial landing page and per-solution story pages rendered
// from the solutions catalog.)

// -------------------- Legal pages --------------------

function LegalSection({ titleKey, bodyKey }: { titleKey: string; bodyKey: string }) {
  const { t } = useT();
  return (
    <section>
      <h2 className="text-base font-semibold text-text-primary">{t(titleKey)}</h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t(bodyKey)}</p>
    </section>
  );
}

export function PrivacyPage() {
  const { t } = useT();
  return (
    <div className="mkt-container max-w-2xl pt-32 pb-10 sm:pt-40">
      <Reveal>
        <header className="flex flex-col gap-4 border-b border-border pb-8">
          <Eyebrow>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('mkt.footer.legal')}
          </Eyebrow>
          <h1 className="mkt-display text-3xl text-text-primary sm:text-4xl">{t('mkt.privacy.title')}</h1>
          <p className="text-sm text-text-muted">
            {t('mkt.privacy.updated')}: {new Date().toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-sm leading-relaxed text-text-secondary">{t('mkt.privacy.intro')}</p>
        </header>
      </Reveal>
      <div className="mt-8 flex flex-col gap-8">
        <Reveal><LegalSection titleKey="mkt.privacy.collectTitle" bodyKey="mkt.privacy.collectBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.privacy.whyTitle" bodyKey="mkt.privacy.whyBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.privacy.cookiesTitle" bodyKey="mkt.privacy.cookiesBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.privacy.thirdTitle" bodyKey="mkt.privacy.thirdBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.privacy.rightsTitle" bodyKey="mkt.privacy.rightsBody" /></Reveal>
      </div>
    </div>
  );
}

export function TermsPage() {
  const { t } = useT();
  return (
    <div className="mkt-container max-w-2xl pt-32 pb-10 sm:pt-40">
      <Reveal>
        <header className="flex flex-col gap-4 border-b border-border pb-8">
          <Eyebrow>
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            {t('mkt.footer.legal')}
          </Eyebrow>
          <h1 className="mkt-display text-3xl text-text-primary sm:text-4xl">{t('mkt.terms.title')}</h1>
          <p className="text-sm leading-relaxed text-text-secondary">{t('mkt.terms.intro')}</p>
        </header>
      </Reveal>
      <div className="mt-8 flex flex-col gap-8">
        <Reveal><LegalSection titleKey="mkt.terms.accountTitle" bodyKey="mkt.terms.accountBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.terms.serviceTitle" bodyKey="mkt.terms.serviceBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.terms.fairUseTitle" bodyKey="mkt.terms.fairUseBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.terms.billingTitle" bodyKey="mkt.terms.billingBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.terms.liabilityTitle" bodyKey="mkt.terms.liabilityBody" /></Reveal>
      </div>
    </div>
  );
}

// -------------------- Security --------------------

export function SecurityPage() {
  const { t } = useT();
  return (
    <div className="mkt-container max-w-2xl pt-32 pb-10 sm:pt-40">
      <Reveal>
        <header className="flex flex-col gap-4 border-b border-border pb-8">
          <Eyebrow>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {t('mkt.footer.legal')}
          </Eyebrow>
          <h1 className="mkt-display text-3xl text-text-primary sm:text-4xl">{t('mkt.security.title')}</h1>
          <p className="text-sm text-text-muted">
            {t('mkt.privacy.updated')}: {new Date().toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-sm leading-relaxed text-text-secondary">{t('mkt.security.intro')}</p>
        </header>
      </Reveal>
      <div className="mt-8 flex flex-col gap-8">
        <Reveal><LegalSection titleKey="mkt.security.accountsTitle" bodyKey="mkt.security.accountsBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.security.dataTitle" bodyKey="mkt.security.dataBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.security.backupsTitle" bodyKey="mkt.security.backupsBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.security.auditTitle" bodyKey="mkt.security.auditBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.security.reportTitle" bodyKey="mkt.security.reportBody" /></Reveal>
      </div>
    </div>
  );
}

// -------------------- Accessibility --------------------

export function AccessibilityPage() {
  const { t } = useT();
  return (
    <div className="mkt-container max-w-2xl pt-32 pb-10 sm:pt-40">
      <Reveal>
        <header className="flex flex-col gap-4 border-b border-border pb-8">
          <Eyebrow>
            <Accessibility className="h-3.5 w-3.5" aria-hidden="true" />
            {t('mkt.footer.legal')}
          </Eyebrow>
          <h1 className="mkt-display text-3xl text-text-primary sm:text-4xl">{t('mkt.footer.accessibility')}</h1>
          <p className="text-sm leading-relaxed text-text-secondary">{t('mkt.a11y.intro')}</p>
        </header>
      </Reveal>
      <div className="mt-8 flex flex-col gap-8">
        <Reveal><LegalSection titleKey="mkt.a11y.keyboardTitle" bodyKey="mkt.a11y.keyboardBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.a11y.motionTitle" bodyKey="mkt.a11y.motionBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.a11y.contrastTitle" bodyKey="mkt.a11y.contrastBody" /></Reveal>
        <Reveal><LegalSection titleKey="mkt.a11y.feedbackTitle" bodyKey="mkt.a11y.feedbackBody" /></Reveal>
      </div>
    </div>
  );
}

// -------------------- Contact --------------------

// The contact page lists the REAL support channels that exist in
// the product today — the dashboard's self-serve billing, the
// pricing FAQ, the security disclosure page and the signup flow.
// No invented email address or contact form: every row links to a
// page that actually exists.
export function ContactPage() {
  const { t } = useT();

  const channels = [
    {
      icon: CreditCard,
      titleKey: 'mkt.contact.billingTitle',
      bodyKey: 'mkt.contact.billingBody',
      ctaKey: 'mkt.contact.billingCta',
      href: MKT.pricing,
    },
    {
      icon: MessagesSquare,
      titleKey: 'mkt.contact.faqTitle',
      bodyKey: 'mkt.contact.faqBody',
      ctaKey: 'mkt.contact.faqCta',
      href: `${MKT.pricing}#faq`,
    },
    {
      icon: ShieldCheck,
      titleKey: 'mkt.contact.securityTitle',
      bodyKey: 'mkt.contact.securityBody',
      ctaKey: 'mkt.contact.securityCta',
      href: MKT.security,
    },
    {
      icon: Sparkles,
      titleKey: 'mkt.contact.tryTitle',
      bodyKey: 'mkt.contact.tryBody',
      ctaKey: 'mkt.contact.tryCta',
      href: MKT.signup,
    },
  ];

  return (
    <div className="mkt-container max-w-2xl pt-32 pb-10 sm:pt-40">
      <Reveal>
        <header className="flex flex-col gap-4 border-b border-border pb-8">
          <Eyebrow>
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {t('mkt.contact.eyebrow')}
          </Eyebrow>
          <h1 className="mkt-display text-3xl text-text-primary sm:text-4xl">{t('mkt.contact.title')}</h1>
          <p className="text-sm leading-relaxed text-text-secondary">{t('mkt.contact.intro')}</p>
        </header>
      </Reveal>

      <div className="mt-8 flex flex-col gap-5">
        {channels.map((c, i) => {
          const Icon = c.icon;
          return (
            <Reveal key={c.titleKey} delay={i * 50}>
              <div className="mkt-card-hover flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mkt-accent-soft text-mkt-accent-soft-fg">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-text-primary">{t(c.titleKey)}</h2>
                <p className="text-sm leading-relaxed text-text-secondary">{t(c.bodyKey)}</p>
                <a
                  href={c.href}
                  className="mkt-focus mt-1 inline-flex w-fit items-center gap-1 text-sm font-semibold text-mkt-accent hover:underline"
                >
                  {t(c.ctaKey)} <span aria-hidden="true">→</span>
                </a>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

// -------------------- Legal Center --------------------

export function LegalCenterPage() {
  const { t } = useT();

  const docs = [
    { labelKey: 'mkt.footer.privacy', href: MKT.privacy, icon: ShieldCheck },
    { labelKey: 'mkt.footer.terms', href: MKT.terms, icon: Scale },
    { labelKey: 'mkt.footer.security', href: MKT.security, icon: Lock },
    { labelKey: 'mkt.footer.accessibility', href: MKT.accessibility, icon: Accessibility },
  ];

  return (
    <div className="mkt-container max-w-2xl pt-32 pb-10 sm:pt-40">
      <Reveal>
        <header className="flex flex-col gap-4 border-b border-border pb-8">
          <Eyebrow>
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {t('mkt.footer.legal')}
          </Eyebrow>
          <h1 className="mkt-display text-3xl text-text-primary sm:text-4xl">{t('mkt.footer.legalCenter')}</h1>
          <p className="text-sm leading-relaxed text-text-secondary">{t('mkt.legal.intro')}</p>
        </header>
      </Reveal>

      <ul className="mt-8 flex flex-col gap-3">
        {docs.map((d, i) => {
          const Icon = d.icon;
          return (
            <Reveal key={d.labelKey} delay={i * 40} as="li">
              <a
                href={d.href}
                className="mkt-focus mkt-card-hover group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-mkt-accent-border"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mkt-accent-soft text-mkt-accent-soft-fg">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-text-primary">{t(d.labelKey)}</span>
                </span>
                <span
                  className="text-mkt-accent transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  →
                </span>
              </a>
            </Reveal>
          );
        })}

        {/* Cookie preferences — the real control from the banner */}
        <Reveal delay={200} as="li">
          <button
            type="button"
            onClick={openCookiePreferences}
            className="mkt-focus mkt-card-hover group flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left transition-colors hover:border-mkt-accent-border"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mkt-accent-soft text-mkt-accent-soft-fg">
                <Cookie className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-text-primary">{t('mkt.footer.cookiePrefs')}</span>
            </span>
            <span
              className="text-mkt-accent transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              →
            </span>
          </button>
        </Reveal>
      </ul>
    </div>
  );
}
