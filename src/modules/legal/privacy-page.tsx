'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useT } from '@/lib/i18n';

// ============================================================
// PRIVACY POLICY — dashboard-native module (#/privacy)
// ============================================================
// The Privacy Policy CONTENT is the SAME single source of truth
// as the marketing privacy page (the mkt.privacy.* i18n keys in
// src/lib/i18n/fragments/{en,fr}/client-marketing.ts) — this
// module only re-skins it with dashboard typography so a signed-
// in user can read the policy WITHOUT leaving the app (opened
// from the Help panel's "Privacy" action).
//
// Routing notes:
//   • 'privacy' is intentionally NOT in AdminShell's
//     MARKETING_HASHES redirect list, so an authenticated
//     full-page load on /#/privacy lands HERE instead of
//     bouncing to the dashboard; unauthenticated visitors keep
//     getting the marketing page (MarketingSite owns #/privacy
//     when logged out).
//   • 'privacy' is registered in module-registry.tsx and allowed
//     for every role (profile-style exceptions in admin-app.tsx).
// ============================================================

// One policy section — title + body, both i18n-driven from the
// marketing privacy content keys (shared with the public page).
function PrivacySection({ titleKey, bodyKey }: { titleKey: string; bodyKey: string }) {
  const { t } = useT();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold leading-6 text-foreground">
        {t(titleKey)}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t(bodyKey)}
      </p>
    </section>
  );
}

export default function PrivacyPage() {
  const { t } = useT();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-6">
      {/* Page header — the same structure as every dashboard
          document page: icon chip + title + meta line + intro. */}
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold leading-tight text-foreground">
            {t('mkt.privacy.title')}
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('mkt.privacy.updated')}:{' '}
          {new Date().toLocaleDateString('en', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('mkt.privacy.intro')}
        </p>
      </header>

      {/* Policy sections — identical content (and order) to the
          public marketing privacy page. */}
      <div className="flex flex-col gap-6">
        <PrivacySection titleKey="mkt.privacy.collectTitle" bodyKey="mkt.privacy.collectBody" />
        <PrivacySection titleKey="mkt.privacy.whyTitle" bodyKey="mkt.privacy.whyBody" />
        <PrivacySection titleKey="mkt.privacy.cookiesTitle" bodyKey="mkt.privacy.cookiesBody" />
        <PrivacySection titleKey="mkt.privacy.thirdTitle" bodyKey="mkt.privacy.thirdBody" />
        <PrivacySection titleKey="mkt.privacy.rightsTitle" bodyKey="mkt.privacy.rightsBody" />
      </div>
    </div>
  );
}
