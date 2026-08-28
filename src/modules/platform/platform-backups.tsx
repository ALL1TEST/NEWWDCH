'use client';

// ============================================================
// PLATFORM BACKUPS — thin scope-aware wrapper.
// ONE backup system, two scopes. The Client Backups sub-pages each
// accept `{ scope?: 'client' | 'platform' }` (default 'client').
// This wrapper renders the SAME sub-pages with `scope="platform"`,
// which sends `scope=platform` on every API call, gates mutations
// with requirePlatformAdmin, uses PlatformPageHeader (keeps the
// PLATFORM badge), uses `platform-backups` navigation module (so the
// URL hash is `#platform-backups/<tab>`), and uses platform-scoped
// TanStack Query cache keys. No duplicate table/form/dialog.
// ============================================================

import { useNavigationStore } from '@/lib/stores/navigation-store';
import {
  BackupsSubNav,
  DashboardPage,
  BackupsListPage,
  SchedulesPage,
  RestorePage,
  StoragePage,
  LogsPage,
} from '@/modules/backups';

export function PlatformBackupsModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);

  return (
    <>
      <BackupsSubNav module="platform-backups" />
      {(!currentSubPage || currentSubPage === null) && <DashboardPage scope="platform" />}
      {currentSubPage === 'backups' && <BackupsListPage scope="platform" />}
      {currentSubPage === 'schedules' && <SchedulesPage scope="platform" />}
      {currentSubPage === 'restore' && <RestorePage scope="platform" />}
      {currentSubPage === 'storage' && <StoragePage scope="platform" />}
      {currentSubPage === 'logs' && <LogsPage scope="platform" />}
    </>
  );
}
