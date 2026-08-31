'use client';

// ============================================================
// PLATFORM AI — the Platform Admin AI MANAGEMENT page.
// ============================================================
// Platform Admin CONFIGURES the platform's AI service here:
//   AI → Providers        (AI providers + API keys)
//   AI → Models           (models, defaults)
//   AI → Prompt Library   (internal platform prompts that drive the
//                         client AI tools — clients never see them)
//   AI → Settings         (default text/image provider + model,
//                         temperature, max tokens, budgets)
//
// This is strictly separated from the CLIENT AI experience (#ai →
// Providers / Models / Settings — the client's own connections):
// the client USES Platform AI, never configures it. Server-side,
// the prompt library (incl. versions/duplicate/favorite), the
// platform's global AI settings, marketplace and playground are
// gated to platform staff; clients with the "Client's Own AI API"
// plan feature manage only their OWN provider connections
// (row-level ownership), and the AI tools available to a client
// are controlled by the plan's "Platform AI" feature (generation
// runs on the platform's configured provider/model, usage metered
// against the plan's AI Articles/month + AI Images/month limits).
//
// The only adaptations to the Platform Admin context:
//   1. Navigation module key — this page lives under the
//      `platform-ai` module (#platform-ai/<tab>) so the URL
//      hash, sidebar active state, permissions
//      (canAccessPage / isPlatformPage) and the
//      PLATFORM_ADMIN landing redirect all work inside the
//      Platform Admin dashboard, WITHOUT touching the client
//      `ai` module used by the Admin User dashboard.
//   2. Everything else — data fetching (same /api/ai/*
//      endpoints, already global/site-independent and
//      explicitly open to platform staff via
//      requireFeatureAllowStaff), TanStack Query keys, toasts,
//      dialogs and tables — is the shared, unchanged AI stack.
//
// Legacy AI sub-pages (playground, jobs, logs, marketplace,
// usage) redirect exactly like on the Admin User page.
// ============================================================

import React, { useEffect } from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { ProvidersPage } from '@/modules/ai/providers-page';
import { PromptsPage } from '@/modules/ai/prompts-page';
import { ModelsPage } from '@/modules/ai/models-page';
import { SettingsPage } from '@/modules/ai/settings-page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Server,
  MessageSquare,
  Boxes,
  Settings,
} from 'lucide-react';

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

export function PlatformAiModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  // Resolve the effective tab: legacy sub-pages redirect to 'providers'
  const effectiveTab: AiSubPage = currentSubPage && LEGACY_REDIRECT[currentSubPage]
    ? LEGACY_REDIRECT[currentSubPage]
    : (currentSubPage as AiSubPage) || 'providers';

  const handleTabChange = (value: string) => {
    navigate('platform-ai', null, value);
  };

  useEffect(() => {
    // Redirect legacy sub-pages to the closest valid tab
    if (currentSubPage && LEGACY_REDIRECT[currentSubPage]) {
      navigate('platform-ai', null, LEGACY_REDIRECT[currentSubPage]);
      return;
    }
    if (!currentSubPage) {
      navigate('platform-ai', null, 'providers');
    }
  }, [currentSubPage, navigate]);

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={effectiveTab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto">
          <TabsList className="w-full justify-start">
            {AI_SUB_PAGES.map((tab) => {
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
        <TabsContent value="prompts">
          <PromptsPage />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
