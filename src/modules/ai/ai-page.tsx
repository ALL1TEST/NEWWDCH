'use client';

import React, { useEffect } from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ProvidersPage } from './providers-page';
import { PromptsPage } from './prompts-page';
import { ModelsPage } from './models-page';
import { SettingsPage } from './settings-page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Server,
  MessageSquare,
  Boxes,
  Settings,
} from 'lucide-react';

// ============================================================
// AI PAGE — the Admin User / client AI page (original design).
// ============================================================
// Tabs: Providers / Models / Prompt Library / Settings.
//
// The ONE platform rule applied here: the Prompt Library is a
// Platform Admin control (Platform Admin → AI → Prompt Library).
// The tab is only rendered for platform staff (OWNER /
// PLATFORM_ADMIN) — normal clients never see it, and the
// /api/ai/prompts* routes reject non-staff server-side as well.
//
// Platform AI connection (plan feature "Platform AI"):
//   • The client's AI tools (content editor assistant, AI Ideas,
//     AI Generate in Media, …) run on the Platform Admin's
//     configured provider/model internally — the client never
//     configures platform API keys. Enforced server-side.
//   • AI usage counts against the plan's AI Articles/month and
//     AI Images/month limits.
//   • The Providers/Models tabs here manage the CLIENT'S OWN AI
//     connections (plan feature "Client's Own AI API") — usage
//     never consumes Platform AI limits. Platform staff see and
//     manage every provider/model.
// ============================================================

// Simplified AI section — only features relevant to a blogging CMS.
// Removed: Playground, Jobs, Logs, Marketplace, Usage (provider dashboards handle analytics).
const AI_SUB_PAGES = [
  { value: 'providers', label: 'Providers', icon: Server },
  { value: 'models', label: 'Models', icon: Boxes },
  { value: 'prompts', label: 'Prompt Library', icon: MessageSquare },
  { value: 'settings', label: 'Settings', icon: Settings },
] as const;

type AiSubPage = (typeof AI_SUB_PAGES)[number]['value'];

// Legacy sub-pages that no longer have their own tab — redirect to Providers.
const LEGACY_REDIRECT: Record<string, AiSubPage> = {
  playground: 'providers',
  jobs: 'providers',
  logs: 'providers',
  marketplace: 'providers',
  usage: 'settings',
};

export function AiPage() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);

  // Platform staff (OWNER / PLATFORM_ADMIN / INTERNAL) — mirrors the
  // server-side isPlatformStaff check. Only staff get the Prompt
  // Library tab; the prompts API rejects everyone else server-side.
  const isStaff = !!user && (
    user.role === 'OWNER' ||
    user.role === 'PLATFORM_ADMIN' ||
    user.billingMode === 'INTERNAL'
  );

  // The Prompt Library is Platform-Admin-only — hidden from the
  // normal Admin User/client dashboard.
  const visibleTabs = AI_SUB_PAGES.filter(
    (tab) => isStaff || tab.value !== 'prompts',
  );
  const validTabs = new Set<string>(visibleTabs.map((tab) => tab.value));

  // Resolve the effective tab: legacy sub-pages redirect to 'providers';
  // hidden tabs (Prompt Library for non-staff) fall back to 'providers'.
  const effectiveTab: AiSubPage = currentSubPage && LEGACY_REDIRECT[currentSubPage]
    ? LEGACY_REDIRECT[currentSubPage]
    : currentSubPage && !validTabs.has(currentSubPage)
      ? 'providers'
      : (currentSubPage as AiSubPage) || 'providers';

  const handleTabChange = (value: string) => {
    navigate('ai', null, value);
  };

  useEffect(() => {
    // Redirect legacy sub-pages to the closest valid tab
    if (currentSubPage && LEGACY_REDIRECT[currentSubPage]) {
      navigate('ai', null, LEGACY_REDIRECT[currentSubPage]);
      return;
    }
    // Non-staff landing on the (hidden) prompts tab → Providers
    if (currentSubPage && !validTabs.has(currentSubPage)) {
      navigate('ai', null, 'providers');
      return;
    }
    if (!currentSubPage) {
      navigate('ai', null, 'providers');
    }
  }, [currentSubPage, isStaff, navigate]);

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={effectiveTab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto">
          <TabsList className="w-full justify-start">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="providers">
          <ProvidersPage />
        </TabsContent>
        <TabsContent value="models">
          <ModelsPage />
        </TabsContent>
        {isStaff && (
          <TabsContent value="prompts">
            <PromptsPage />
          </TabsContent>
        )}
        <TabsContent value="settings">
          <SettingsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
