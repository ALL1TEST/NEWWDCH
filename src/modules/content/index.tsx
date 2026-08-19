'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { ContentListPage } from './content-list-page';
import { ContentCreatePage } from './content-create-page';
import { ContentEditPage } from './content-edit-page';
import { ContentDetailPage } from './content-detail-page';

// -------------------- Content Module Router --------------------
// Determines which content sub-page to render based on the navigation store.
//
// Hash routing patterns handled:
//   #content              → List
//   #content/new          → Create
//   #content/:id          → Detail
//   #content/:id/edit     → Edit

export function ContentModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const currentItemId = useNavigationStore((s) => s.currentItemId);

  // Create page
  if (currentSubPage === 'new' || currentSubPage === 'create') {
    return <ContentCreatePage />;
  }

  // Edit page (requires both itemId and subPage)
  if (currentSubPage === 'edit' && currentItemId) {
    return <ContentEditPage contentId={currentItemId} />;
  }

  // Detail page (has itemId but no subPage)
  if (currentItemId && !currentSubPage) {
    return <ContentDetailPage contentId={currentItemId} />;
  }

  // Default: list page
  return <ContentListPage />;
}

export { ContentListPage } from './content-list-page';
export { ContentCreatePage } from './content-create-page';
export { ContentEditPage } from './content-edit-page';
export { ContentDetailPage } from './content-detail-page';
