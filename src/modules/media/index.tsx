'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { MediaListPage } from './media-list-page';
import { MediaDetailPage } from './media-detail-page';

// -------------------- Media Module Router --------------------
// Determines which media sub-page to render based on the navigation store.
//
// Hash routing patterns handled:
//   #media              → List
//   #media/:id          → Detail
//   #media/:id/edit     → Detail (edit mode)

export function MediaModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const currentItemId = useNavigationStore((s) => s.currentItemId);

  // Detail page (has itemId)
  if (currentItemId) {
    return <MediaDetailPage mediaId={currentItemId} />;
  }

  // Default: list page
  return <MediaListPage />;
}

export { MediaListPage } from './media-list-page';
export { MediaDetailPage } from './media-detail-page';
