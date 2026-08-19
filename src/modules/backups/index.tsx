'use client';

import React from 'react';
import {
  Database,
  Clock,
  RotateCcw,
  ScrollText,
} from 'lucide-react';
import { PageSubNav } from '@/components/patterns';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { DashboardPage } from './dashboard-page';
import { BackupsListPage } from './backups-list-page';
import { SchedulesPage } from './schedules-page';
import { RestorePage } from './restore-page';
import { StoragePage } from './storage-page';
import { LogsPage } from './logs-page';

// ==================== Sub-Navigation Tabs ====================

const BACKUPS_TABS = [
  { key: null, label: 'Dashboard', icon: Database },
  { key: 'backups', label: 'Backups', icon: Database },
  { key: 'schedules', label: 'Schedules', icon: Clock },
  { key: 'restore', label: 'Restore', icon: RotateCcw },
  { key: 'storage', label: 'Storage', icon: Database },
  { key: 'logs', label: 'Logs', icon: ScrollText },
];

// -------------------- Module Router --------------------

export function BackupsModule() {
  const subPage = useNavigationStore((s) => s.currentSubPage);

  return (
    <>
      <PageSubNav module="backups" tabs={BACKUPS_TABS} />
      {subPage === 'backups' && <BackupsListPage />}
      {subPage === 'schedules' && <SchedulesPage />}
      {subPage === 'restore' && <RestorePage />}
      {subPage === 'storage' && <StoragePage />}
      {subPage === 'logs' && <LogsPage />}
      {subPage === null && <DashboardPage />}
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
