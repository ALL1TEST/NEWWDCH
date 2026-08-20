'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { Database, Clock, RotateCcw, HardDrive, ScrollText, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardPage } from './dashboard-page';
import { BackupsListPage } from './backups-list-page';
import { SchedulesPage } from './schedules-page';
import { RestorePage } from './restore-page';
import { StoragePage } from './storage-page';
import { LogsPage } from './logs-page';

// -------------------- Backups Internal Navigation --------------------
// Matches the SEO module pattern: internal tab bar inside the page,
// sidebar is the only sidebar navigation (flat "Backups" item, no dropdown).

const BACKUPS_TABS = [
  { key: null, label: 'Overview', icon: LayoutDashboard },
  { key: 'backups', label: 'Backups', icon: Database },
  { key: 'schedules', label: 'Schedules', icon: Clock },
  { key: 'restore', label: 'Restore', icon: RotateCcw },
  { key: 'storage', label: 'Storage', icon: HardDrive },
  { key: 'logs', label: 'Logs', icon: ScrollText },
] as const;

function BackupsSubNav() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  return (
    <div className="mb-6 overflow-x-auto -mx-1 px-1">
      <div className="flex items-center gap-1 min-w-max pb-1">
        {BACKUPS_TABS.map((tab) => {
          const isActive = tab.key === null
            ? !currentSubPage
            : currentSubPage === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key ?? 'overview'}
              onClick={() => navigate('backups', null, tab.key)}
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

// -------------------- Module Router --------------------

export function BackupsModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);

  return (
    <>
      <BackupsSubNav />
      {currentSubPage === 'backups' && <BackupsListPage />}
      {currentSubPage === 'schedules' && <SchedulesPage />}
      {currentSubPage === 'restore' && <RestorePage />}
      {currentSubPage === 'storage' && <StoragePage />}
      {currentSubPage === 'logs' && <LogsPage />}
      {(!currentSubPage || currentSubPage === null) && <DashboardPage />}
    </>
  );
}

// Re-export sub-pages for external use
export { DashboardPage } from './dashboard-page';
export { BackupsListPage } from './backups-list-page';
export { SchedulesPage } from './schedules-page';
export { RestorePage } from './restore-page';
export { StoragePage } from './storage-page';
export { LogsPage } from './logs-page';
