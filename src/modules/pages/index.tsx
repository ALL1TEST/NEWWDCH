'use client';

import React, { useEffect } from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSiteStore } from '@/lib/stores/site-store';
import { ContentListPage } from '@/modules/content/content-list-page';
import { ContentCreatePage } from '@/modules/content/content-create-page';
import { ContentEditPage } from '@/modules/content/content-edit-page';
import { ContentDetailPage } from '@/modules/content/content-detail-page';

// -------------------- Pages Module Router --------------------
// Determines which static page sub-page to render based on the navigation store.
//
// Hash routing patterns handled:
//   #pages              → Static Pages List
//   #pages/new          → Create Static Page (defaults to ContentType = PAGE)
//   #pages/:id          → Detail
//   #pages/:id/edit     → Edit Static Page
//

export function PagesModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const currentItemId = useNavigationStore((s) => s.currentItemId);
  const navigate = useNavigationStore((s) => s.navigate);
  const isAllSites = useSiteStore((s) => s.isAllSites());
  const isSiteInitialized = useSiteStore((s) => s.isInitialized);

  useEffect(() => {
    if (isSiteInitialized && isAllSites && (currentSubPage === 'new' || currentSubPage === 'create')) {
      navigate('pages');
    }
  }, [isSiteInitialized, isAllSites, currentSubPage, navigate]);

  // Create page (disallowed in All Sites mode)
  if (!isAllSites && (currentSubPage === 'new' || currentSubPage === 'create')) {
    return <ContentCreatePage fixedContentType="page" />;
  }

  // Edit page (requires both itemId and subPage)
  if (currentSubPage === 'edit' && currentItemId) {
    return <ContentEditPage contentId={currentItemId} isPage={true} />;
  }

  // Detail page (has itemId but no subPage)
  if (currentItemId && !currentSubPage) {
    return <ContentDetailPage contentId={currentItemId} isPage={true} />;
  }

  // Default: list page filtered to ContentType = PAGE
  return <ContentListPage contentType="page" />;
}
