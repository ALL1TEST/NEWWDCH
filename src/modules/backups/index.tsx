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
// The Backups internal navigation tabs (Overview, Backups, Schedules,
// Restore, Storage, Logs) have been MOVED to the topbar — see
// src/components/layout/topbar.tsx (rendered when currentModule ===
// 'backups', next to the "All Sites" selector) and the BackupsSubNav
// component in ./backups-sub-nav. This module now renders ONLY the
// active sub-page content (no in-page tab bar, no inline breadcrumb
// above the title) — the page title + description start directly below
// the topbar.

export function BackupsModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);

  return (
    <>
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
export { BackupsSubNav } from './backups-sub-nav';
