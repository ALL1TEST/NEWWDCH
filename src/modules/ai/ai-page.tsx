'use client';

import React, { useEffect } from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { ProvidersPage } from './providers-page';
import { ModelsPage } from './models-page';
import { ClientAiWorkspace } from './client-ai-workspace';
import { useAiWorkspace } from '@/hooks/use-ai-workspace';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  Server,
  Boxes,
  Info,
} from 'lucide-react';

// ============================================================
// AI PAGE — the CLIENT AI experience.
// ============================================================
// Strictly separated from the Platform Admin AI management page
// (#platform-ai → Providers / Models / Prompt Library / Settings):
//
//   AI Tools (always)      — the client USES Platform AI: generate
//                            articles, titles, outlines, rewrites,
//                            SEO fields, images and ideas + remaining
//                            usage. Requires the Platform AI plan
//                            feature (locked otherwise; enforced
//                            server-side).
//   My Providers (ai_client) — the client's OWN AI provider/API
//                            connections (Client's Own AI API plan
//                            feature). Server-side, non-staff callers
//                            only ever see/manage the providers they
//                            created — never the platform's.
//   My Models (ai_client)    — models of the client's own providers.
//
// The Prompt Library, platform AI Settings, Providers/Models of the
// PLATFORM infrastructure and all prompt management are Platform
// Admin controls (#platform-ai) — they are NOT part of the client
// dashboard.
// ============================================================

const AI_SUB_PAGES = [
  { value: 'tools', label: 'AI Tools', icon: Sparkles },
  { value: 'providers', label: 'My Providers', icon: Server },
  { value: 'models', label: 'My Models', icon: Boxes },
] as const;

type AiSubPage = (typeof AI_SUB_PAGES)[number]['value'];

// Legacy sub-pages that no longer exist in the client AI page —
// Prompt Library, Settings, Playground, Jobs, Logs, Marketplace and
// Usage are Platform Admin controls or legacy screens: redirect to
// the AI Tools workspace.
const LEGACY_REDIRECT: Record<string, AiSubPage> = {
  prompts: 'tools',
  settings: 'tools',
  playground: 'tools',
  jobs: 'tools',
  logs: 'tools',
  marketplace: 'tools',
  usage: 'tools',
};

/** A short explainer shown above the client's own connection tabs. */
function OwnConnectionNote() {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-4">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Client&apos;s Own AI API — you connect your own AI provider and API key here. Your own
        API usage is <strong>never counted</strong> against the Platform AI limits, and the
        platform&apos;s AI infrastructure is never exposed.
      </p>
    </div>
  );
}

export function AiPage() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);
  const { data: workspace, isLoading } = useAiWorkspace();

  // The connection tabs exist only for clients whose plan includes
  // Client's Own AI API (platform staff always see them too).
  const showConnection = workspace?.entitlements.aiClient ?? false;
  const availableTabs = AI_SUB_PAGES.filter(
    (t) => t.value === 'tools' || showConnection,
  );
  const validTabs = new Set(availableTabs.map((t) => t.value));

  // Resolve the effective tab: legacy sub-pages redirect to the AI
  // Tools workspace; tabs the user is not entitled to fall back to
  // 'tools' as well.
  const effectiveTab: AiSubPage =
    currentSubPage && LEGACY_REDIRECT[currentSubPage]
      ? LEGACY_REDIRECT[currentSubPage]
      : currentSubPage && validTabs.has(currentSubPage as AiSubPage)
        ? (currentSubPage as AiSubPage)
        : 'tools';

  const handleTabChange = (value: string) => {
    navigate('ai', null, value);
  };

  useEffect(() => {
    // Redirect legacy sub-pages / non-entitled tabs to the closest valid tab
    if (currentSubPage && LEGACY_REDIRECT[currentSubPage]) {
      navigate('ai', null, LEGACY_REDIRECT[currentSubPage]);
      return;
    }
    if (currentSubPage && !validTabs.has(currentSubPage as AiSubPage)) {
      navigate('ai', null, 'tools');
      return;
    }
    if (!currentSubPage) {
      navigate('ai', null, 'tools');
    }
     
  }, [currentSubPage, showConnection, navigate]);

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={effectiveTab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto">
          <TabsList className="w-full justify-start">
            {availableTabs.map((tab) => {
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

        <TabsContent value="tools">
          <ClientAiWorkspace />
        </TabsContent>
        <TabsContent value="providers">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : showConnection ? (
            <div className="space-y-6">
              <OwnConnectionNote />
              <ProvidersPage />
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="models">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : showConnection ? (
            <div className="space-y-6">
              <OwnConnectionNote />
              <ModelsPage />
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
