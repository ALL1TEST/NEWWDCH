'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Shield, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { SeoSitemapPage } from './seo-sitemap-page';
import { SeoRobotsPage } from './seo-robots-page';
import { SeoRedirectsPage } from './seo-redirects-page';

// ==================== SEO Settings ====================
// Consolidates Sitemap, Robots.txt, and Redirects (Advanced) into one settings page.
// Provides a single dynamic title + tab bar. Child pages render content only (no
// duplicate PageHeader / breadcrumb).

type SettingsTab = 'sitemap' | 'robots' | 'redirects';

const SETTINGS_TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: 'sitemap', label: 'Sitemap', icon: FileText },
  { key: 'robots', label: 'Robots.txt', icon: Shield },
  { key: 'redirects', label: 'Redirects', icon: GitBranch },
];

const TAB_META: Record<SettingsTab, { title: string; description: string }> = {
  sitemap: { title: 'Sitemap', description: 'Generate and manage your XML sitemap for search engines' },
  robots: { title: 'Robots.txt', description: 'Control how search engine crawlers access your site' },
  redirects: { title: 'Redirects', description: 'Manage URL redirect rules for your site' },
};

interface RedirectCountResponse {
  pagination: { total: number };
}

export function SeoSettingsPage({ initialTab = 'sitemap' }: { initialTab?: SettingsTab }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const meta = TAB_META[activeTab];

  // Lightweight redirect count for the Redirects tab badge. Shares the
  // `redirects` query scope, so it auto-invalidates whenever the Redirects
  // page creates / deletes / toggles a redirect (those mutations all call
  // queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all })).
  const { data: redirectCountData, isLoading: isRedirectCountLoading } = useQuery<RedirectCountResponse>({
    queryKey: queryKeys.redirects.count(),
    queryFn: () =>
      getApi<RedirectCountResponse>('/api/redirects', { page: 1, pageSize: 1 }),
    staleTime: 10_000,
  });
  // Undefined while loading — the badge stays hidden instead of flashing an
  // incorrect "0" before the real count arrives (no intermediate state).
  const redirectCount = redirectCountData?.pagination?.total;

  return (
    <div className="space-y-6">
      {/* Single dynamic page title — no duplicate "SEO Settings" heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{meta.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
      </div>

      {/* Single tab bar */}
      <div className="flex items-center gap-1 border-b">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.key === 'redirects' && !isRedirectCountLoading && redirectCount !== undefined && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground tabular-nums">
                  {redirectCount.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content — child pages render content only */}
      <div>
        {activeTab === 'sitemap' && <SeoSitemapPage />}
        {activeTab === 'robots' && <SeoRobotsPage />}
        {activeTab === 'redirects' && <SeoRedirectsPage />}
      </div>
    </div>
  );
}
