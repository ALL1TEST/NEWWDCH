'use client';

import React, { Suspense } from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { Loader2, Search, Navigation, FileText, Shield, BarChart3, Activity, Unlink, Share2, Code, Link2, GitBranch, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeoOverviewPage } from './seo-overview-page';
import { SeoRedirectsPage } from './seo-redirects-page';
import { SeoSitemapPage } from './seo-sitemap-page';
import { SeoRobotsPage } from './seo-robots-page';
import { SeoSearchConsolePage } from './seo-search-console-page';
import { SeoIndexingPage } from './seo-indexing-page';
import { SeoBrokenLinksPage } from './seo-broken-links-page';
import { SeoSocialPreviewPage } from './seo-social-preview-page';
import { SeoSchemaPage } from './seo-schema-page';
import { SeoCanonicalsPage } from './seo-canonicals-page';
import { SeoInternalLinksPage } from './seo-internal-links-page';
import { SeoAuditPage } from './seo-audit-page';

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
  { key: 'redirects', label: 'Redirects', icon: Navigation },
  { key: 'sitemap', label: 'Sitemap', icon: FileText },
  { key: 'robots', label: 'Robots.txt', icon: Shield },
  { key: 'search-console', label: 'Search Console', icon: BarChart3 },
  { key: 'indexing', label: 'Indexing', icon: Activity },
  { key: 'broken-links', label: 'Broken Links', icon: Unlink },
  { key: 'social-preview', label: 'Social Preview', icon: Share2 },
  { key: 'schema', label: 'Schema.org', icon: Code },
  { key: 'canonicals', label: 'Canonicals', icon: Link2 },
  { key: 'internal-links', label: 'Internal Links', icon: GitBranch },
  { key: 'audit', label: 'SEO Audit', icon: ClipboardCheck },
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

  return (
    <>
      <SeoSubNav />
      <Suspense fallback={<PageLoader />}>
        {(() => {
          switch (currentSubPage) {
            case 'redirects':
              return <SeoRedirectsPage />;
            case 'sitemap':
              return <SeoSitemapPage />;
            case 'robots':
              return <SeoRobotsPage />;
            case 'search-console':
              return <SeoSearchConsolePage />;
            case 'indexing':
              return <SeoIndexingPage />;
            case 'broken-links':
              return <SeoBrokenLinksPage />;
            case 'social-preview':
              return <SeoSocialPreviewPage />;
            case 'schema':
              return <SeoSchemaPage />;
            case 'canonicals':
              return <SeoCanonicalsPage />;
            case 'internal-links':
              return <SeoInternalLinksPage />;
            case 'audit':
              return <SeoAuditPage />;
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
export { SeoRedirectsPage } from './seo-redirects-page';
export { SeoSitemapPage } from './seo-sitemap-page';
export { SeoRobotsPage } from './seo-robots-page';
export { SeoSearchConsolePage } from './seo-search-console-page';
export { SeoIndexingPage } from './seo-indexing-page';
export { SeoBrokenLinksPage } from './seo-broken-links-page';
export { SeoSocialPreviewPage } from './seo-social-preview-page';
export { SeoSchemaPage } from './seo-schema-page';
export { SeoCanonicalsPage } from './seo-canonicals-page';
export { SeoInternalLinksPage } from './seo-internal-links-page';
export { SeoAuditPage } from './seo-audit-page';
