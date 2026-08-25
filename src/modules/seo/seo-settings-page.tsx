'use client';

import React, { useState } from 'react';
import { FileText, Shield, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  { key: 'redirects', label: 'Advanced: Redirects', icon: GitBranch },
];

const TAB_META: Record<SettingsTab, { title: string; description: string }> = {
  sitemap: { title: 'Sitemap', description: 'Generate and manage your XML sitemap for search engines' },
  robots: { title: 'Robots.txt', description: 'Control how search engine crawlers access your site' },
  redirects: { title: 'Redirects', description: 'Manage URL redirect rules for your site' },
};

export function SeoSettingsPage({ initialTab = 'sitemap' }: { initialTab?: SettingsTab }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const meta = TAB_META[activeTab];

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
