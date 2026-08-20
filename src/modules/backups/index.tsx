'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { DashboardPage } from './dashboard-page';
import { BackupsListPage } from './backups-list-page';
import { SchedulesPage } from './schedules-page';
import { RestorePage } from './restore-page';
import { StoragePage } from './storage-page';
import { LogsPage } from './logs-page';

// -------------------- Module Router --------------------
// No duplicated top navigation — the left sidebar is the only navigation.
// Backups → Dashboard | Backups | Schedules | Restore | Storage | Logs

export function BackupsModule() {
  const subPage = useNavigationStore((s) => s.currentSubPage);

  return (
    <>
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
