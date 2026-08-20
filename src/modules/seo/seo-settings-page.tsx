'use client';

import React, { useState } from 'react';
import { FileText, Shield, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/patterns';
import { SeoSitemapPage } from './seo-sitemap-page';
import { SeoRobotsPage } from './seo-robots-page';
import { SeoRedirectsPage } from './seo-redirects-page';

// ==================== SEO Settings ====================
// Consolidates Sitemap, Robots.txt, and Redirects (Advanced) into one settings page.
// Internal tabbed navigation — not separate sidebar pages.

type SettingsTab = 'sitemap' | 'robots' | 'redirects';

const SETTINGS_TABS: { key: SettingsTab; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'sitemap', label: 'Sitemap', icon: FileText, description: 'Automatically generated XML sitemap' },
  { key: 'robots', label: 'Robots.txt', icon: Shield, description: 'Crawler directives for search engines' },
  { key: 'redirects', label: 'Advanced: Redirects', icon: GitBranch, description: 'Manage URL redirects (advanced tool)' },
];

export function SeoSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('sitemap');
  const activeTabDef = SETTINGS_TABS.find((t) => t.key === activeTab)!;
  const ActiveIcon = activeTabDef.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO Settings"
        description="Manage sitemap, robots.txt, and advanced redirect configuration"
      />

      {/* Settings Tab Bar */}
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

      {/* Active Tab Content */}
      <div>
        {activeTab === 'sitemap' && <SeoSitemapPage />}
        {activeTab === 'robots' && <SeoRobotsPage />}
        {activeTab === 'redirects' && <SeoRedirectsPage />}
      </div>
    </div>
  );
}
