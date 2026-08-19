'use client';

import React, { useEffect } from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { ProvidersPage } from './providers-page';
import { PromptsPage } from './prompts-page';
import { ModelsPage } from './models-page';
import { PlaygroundPage } from './playground-page';
import { JobsPage } from './jobs-page';
import { UsagePage } from './usage-page';
import { SettingsPage } from './settings-page';
import { LogsPage } from './logs-page';
import { MarketplacePage } from './marketplace-page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Server,
  MessageSquare,
  Boxes,
  Play,
  Clock,
  BarChart3,
  Settings,
  FileText,
  Store,
} from 'lucide-react';

const AI_SUB_PAGES = [
  { value: 'providers', label: 'Providers', icon: Server },
  { value: 'prompts', label: 'Prompt Library', icon: MessageSquare },
  { value: 'models', label: 'Models', icon: Boxes },
  { value: 'playground', label: 'Playground', icon: Play },
  { value: 'jobs', label: 'Jobs', icon: Clock },
  { value: 'usage', label: 'Usage', icon: BarChart3 },
  { value: 'settings', label: 'Settings', icon: Settings },
  { value: 'logs', label: 'Logs', icon: FileText },
  { value: 'marketplace', label: 'Marketplace', icon: Store },
] as const;

type AiSubPage = (typeof AI_SUB_PAGES)[number]['value'];

export function AiPage() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  const activeTab: AiSubPage =
    (currentSubPage as AiSubPage) || 'providers';

  const handleTabChange = (value: string) => {
    navigate('ai', null, value);
  };

  useEffect(() => {
    if (!currentSubPage) {
      navigate('ai', null, 'providers');
    }
  }, [currentSubPage, navigate]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
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
        <TabsContent value="prompts">
          <PromptsPage />
        </TabsContent>
        <TabsContent value="models">
          <ModelsPage />
        </TabsContent>
        <TabsContent value="playground">
          <PlaygroundPage />
        </TabsContent>
        <TabsContent value="jobs">
          <JobsPage />
        </TabsContent>
        <TabsContent value="usage">
          <UsagePage />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsPage />
        </TabsContent>
        <TabsContent value="logs">
          <LogsPage />
        </TabsContent>
        <TabsContent value="marketplace">
          <MarketplacePage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
