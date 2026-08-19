'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { UsersListPage } from './users-list-page';
import { UsersDetailPage } from './users-detail-page';

// -------------------- Users Module Router --------------------
// Determines which users sub-page to render based on the navigation store.
//
// Hash routing patterns handled:
//   #users              → List
//   #users/:id          → Detail

export function UsersModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const currentItemId = useNavigationStore((s) => s.currentItemId);

  // Detail page (has itemId)
  if (currentItemId && !currentSubPage) {
    return <UsersDetailPage userId={currentItemId} />;
  }

  // Default: list page
  return <UsersListPage />;
}

export { UsersListPage } from './users-list-page';
export { UsersDetailPage } from './users-detail-page';
