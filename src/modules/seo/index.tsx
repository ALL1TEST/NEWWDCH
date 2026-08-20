'use client';

import React, { Suspense } from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { Loader2, Search, ClipboardCheck, BarChart3, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeoOverviewPage } from './seo-overview-page';
import { SeoAuditPage } from './seo-audit-page';
import { SeoSearchConsolePage } from './seo-search-console-page';
import { SeoSettingsPage } from './seo-settings-page';

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
// Consolidated from 12 tabs to 4 clean tabs:
//   Overview | SEO Audit | Search Console | Settings
// Legacy sub-pages (redirects, indexing, broken-links, canonicals, internal-links,
// social-preview, schema, sitemap, robots) are redirected to the closest new tab.

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

function SeoRouter() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  // ---- Legacy sub-page redirects → new consolidated tabs ----
  // These pages no longer exist as standalone tabs. Redirect to the closest new tab.
  React.useEffect(() => {
    if (!currentSubPage) return;
    const legacyMap: Record<string, string | null> = {
      // Redirects → Settings (Advanced tab handles redirects)
      'redirects': 'settings',
      // Indexing / Canonicals / Internal-links / Broken-links → SEO Audit (integrated checks)
      'indexing': 'audit',
      'canonicals': 'audit',
      'internal-links': 'audit',
      'broken-links': 'audit',
      // Schema → SEO Audit (schema validation is part of the audit)
      'schema': 'audit',
      // Social Preview → moved to Article Editor; redirect to Overview
      'social-preview': null,
      // Sitemap / Robots → Settings
      'sitemap': 'settings',
      'robots': 'settings',
    };
    if (currentSubPage in legacyMap) {
      navigate('seo', null, legacyMap[currentSubPage]);
    }
  }, [currentSubPage, navigate]);

  const effectiveSubPage = (() => {
    // Treat legacy sub-pages as their redirect target for rendering
    if (!currentSubPage) return null;
    const legacyRedirect: Record<string, string | null> = {
      'redirects': 'settings',
      'indexing': 'audit',
      'canonicals': 'audit',
      'internal-links': 'audit',
      'broken-links': 'audit',
      'schema': 'audit',
      'social-preview': null,
      'sitemap': 'settings',
      'robots': 'settings',
    };
    return currentSubPage in legacyRedirect ? legacyRedirect[currentSubPage] : currentSubPage;
  })();

  return (
    <>
      <SeoSubNav />
      <Suspense fallback={<PageLoader />}>
        {(() => {
          switch (effectiveSubPage) {
            case 'audit':
              return <SeoAuditPage />;
            case 'search-console':
              return <SeoSearchConsolePage />;
            case 'settings':
              return <SeoSettingsPage />;
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
