'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutomationListPage } from './automation-list-page';
import { AutomationBuilderPage } from './automation-builder-page';
import { AutomationDetailsPage } from './automation-details-page';

const AUTOMATION_TABS = [
  { key: null, label: 'Automations', icon: Zap },
  { key: 'runs', label: 'Runs', icon: Activity },
] as const;

function AutomationSubNav() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  return (
    <div className="mb-6 overflow-x-auto -mx-1 px-1">
      <div className="flex items-center gap-1 min-w-max pb-1">
        {AUTOMATION_TABS.map((tab) => {
          const isActive = tab.key === null ? !currentSubPage : currentSubPage === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key ?? 'automations'}
              onClick={() => navigate('automation', null, tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
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

export function AutomationModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const currentItemId = useNavigationStore((s) => s.currentItemId);

  // Builder page (create/edit)
  if (currentSubPage === 'create' || currentSubPage === 'edit') {
    return <AutomationBuilderPage />;
  }

  // Details page (view specific automation)
  if (currentItemId && (currentSubPage === 'details' || (!currentSubPage && false))) {
    return <AutomationDetailsPage automationId={currentItemId} />;
  }

  // Runs page
  if (currentSubPage === 'runs') {
    return (
      <>
        <AutomationSubNav />
        <AutomationListPage showRunsOnly />
      </>
    );
  }

  // Default: list page
  return (
    <>
      <AutomationSubNav />
      <AutomationListPage />
    </>
  );
}

export { AutomationListPage } from './automation-list-page';
export { AutomationBuilderPage } from './automation-builder-page';
export { AutomationDetailsPage } from './automation-details-page';
