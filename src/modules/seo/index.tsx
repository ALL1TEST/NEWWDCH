'use client';

import React, { Suspense } from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { Loader2, Search, ClipboardCheck, BarChart3, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeoOverviewPage } from './seo-overview-page';
import { SeoAuditPage } from './seo-audit-page';
import { SeoSearchConsolePage } from './seo-search-console-page';
import { SeoSettingsPage } from './seo-settings-page';
import { SeoDetailPage } from './seo-detail-page';

// Legacy pages kept for internal reuse inside Settings (redirects) but no longer routed standalone.
import { SeoRedirectsPage } from './seo-redirects-page';
import { SeoSitemapPage } from './seo-sitemap-page';
import { SeoRobotsPage } from './seo-robots-page';

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// ==================== SEO Sub-Navigation ====================

const SEO_TABS = [
  { key: null, label: 'Overview', icon: Search },
  { key: 'audit', label: 'SEO Audit', icon: ClipboardCheck },
  { key: 'search-console', label: 'Search Console', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

function SeoSubNav() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  return (
    <div className="mb-6 overflow-x-auto -mx-1 px-1">
      <div className="flex items-center gap-1 min-w-max pb-1">
        {SEO_TABS.map((tab) => {
          const isActive = tab.key === null
            ? !currentSubPage
            : currentSubPage === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key ?? 'overview'}
              onClick={() => navigate('seo', null, tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== Router ====================

// Detail page types that can be navigated to from Overview metric cards
const DETAIL_TYPES = new Set([
  'indexed', 'not-indexed', 'missing-meta-title', 'missing-meta-description',
  'missing-h1', 'duplicate-titles', 'duplicate-descriptions',
  'broken-links', 'missing-canonicals', 'canonical-issues',
]);

// Settings sub-tab mapping (for redirects → settings/redirects)
const SETTINGS_TAB_MAP: Record<string, string> = {
  'settings/redirects': 'redirects',
  'settings/sitemap': 'sitemap',
  'settings/robots': 'robots',
};

// Legacy sub-page → canonical sub-page. Applied SYNCHRONOUSLY in SeoRouter
// (see below) so we render the correct page on the very first paint — never
// an intermediate/wrong screen. The URL is normalized to the canonical form
// via navigate() in an effect (no visual change, just a clean hash).
//   - 'robots'/'sitemap'/'redirects' previously mapped to 'settings' (which
//     rendered the SITEMAP tab — wrong). Now they map to 'settings/<tab>'
//     so the correct tab opens directly.
const LEGACY_REDIRECT: Record<string, string | null> = {
  'indexing': 'audit',
  'canonicals': 'audit',
  'internal-links': 'audit',
  'schema': 'audit',
  'social-preview': null,
  'sitemap': 'settings/sitemap',
  'robots': 'settings/robots',
  'redirects': 'settings/redirects',
};

function SeoRouter() {
  const rawSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  // Synchronous legacy redirect: compute the canonical sub-page BEFORE render.
  // This guarantees we paint the correct page immediately — the user never sees
  // an intermediate Overview or wrong-tab screen. (Previously the redirect ran
  // in a useEffect, so the first render showed <SeoOverviewPage /> for a frame
  // before switching — that was the "incorrect/intermediate Robots.txt screen".)
  const currentSubPage = (rawSubPage && rawSubPage in LEGACY_REDIRECT)
    ? LEGACY_REDIRECT[rawSubPage]
    : rawSubPage;

  // Normalize the browser hash to the canonical sub-page (purely a URL update —
  // the rendered page is already correct, so this causes no visual change).
  React.useEffect(() => {
    if (rawSubPage && rawSubPage !== currentSubPage) {
      navigate('seo', null, currentSubPage);
    }
  }, [rawSubPage, currentSubPage, navigate]);

  // Check if this is a settings sub-tab (e.g., "settings/redirects")
  const settingsTab = currentSubPage && SETTINGS_TAB_MAP[currentSubPage]
    ? SETTINGS_TAB_MAP[currentSubPage]
    : null;

  // Check if this is a detail page
  const isDetailPage = currentSubPage && DETAIL_TYPES.has(currentSubPage);

  // Check if this is a "settings" or "settings/X" route
  const isSettings = currentSubPage === 'settings' || !!settingsTab;

  // Hide sub-nav on detail pages
  const showSubNav = !isDetailPage;

  return (
    <>
      {showSubNav && <SeoSubNav />}
      <Suspense fallback={<PageLoader />}>
        {(() => {
          // Detail page (filtered view from Overview metric cards)
          if (isDetailPage) {
            return <SeoDetailPage type={currentSubPage as any} />;
          }

          switch (currentSubPage) {
            case 'audit':
              return <SeoAuditPage />;
            case 'search-console':
              return <SeoSearchConsolePage />;
            case 'settings':
            case 'settings/redirects':
            case 'settings/sitemap':
            case 'settings/robots':
              // `key` forces a fresh mount whenever the settings tab changes via
              // URL navigation, so useState(initialTab) always initializes the
              // correct active tab (no stale-tab flash when switching tabs).
              return (
                <SeoSettingsPage
                  key={settingsTab ?? 'sitemap'}
                  initialTab={(settingsTab ?? 'sitemap') as any}
                />
              );
            default:
              return <SeoOverviewPage />;
          }
        })()}
      </Suspense>
    </>
  );
}

export function SeoModule() {
  return <SeoRouter />;
}

export { SeoOverviewPage } from './seo-overview-page';
export { SeoAuditPage } from './seo-audit-page';
export { SeoSearchConsolePage } from './seo-search-console-page';
export { SeoSettingsPage } from './seo-settings-page';
// Legacy exports kept for backwards compatibility (internal reuse)
export { SeoRedirectsPage } from './seo-redirects-page';
export { SeoSitemapPage } from './seo-sitemap-page';
export { SeoRobotsPage } from './seo-robots-page';
