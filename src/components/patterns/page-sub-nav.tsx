'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { cn } from '@/lib/utils';

export interface SubNavTab {
  key: string | null;
  label: string;
  icon: LucideIcon;
}

interface PageSubNavProps {
  /** The module name used in hash routing, e.g. 'backups', 'monitoring' */
  module: string;
  /** Ordered list of tabs. key=null means the default/overview tab. */
  tabs: SubNavTab[];
}

/**
 * Horizontal scrollable pill-tab bar, matching the SEO sub-nav pattern.
 * Renders a row of icon+label buttons. The active tab gets primary fill;
 * inactive tabs get muted styling with hover feedback.
 */
export function PageSubNav({ module, tabs }: PageSubNavProps) {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  return (
    <div className="mb-6 overflow-x-auto -mx-1 px-1">
      <div className="flex items-center gap-1 min-w-max pb-1">
        {tabs.map((tab) => {
          const isActive =
            tab.key === null ? !currentSubPage : currentSubPage === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key ?? 'overview'}
              onClick={() => navigate(module, null, tab.key)}
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
