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

import { useAuthStore } from '@/lib/stores/auth-store';

export function PagesModule() {
  const currentModule = useNavigationStore((s) => s.currentModule);
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const currentItemId = useNavigationStore((s) => s.currentItemId);
  const navigate = useNavigationStore((s) => s.navigate);
  const isAllSites = useSiteStore((s) => s.isAllSites());
  const isSiteInitialized = useSiteStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);
  const isPlatformStaff = user?.role === 'PLATFORM_ADMIN' || user?.role === 'OWNER' || currentModule.startsWith('platform-');

  useEffect(() => {
    if (!isPlatformStaff && isSiteInitialized && isAllSites && (currentSubPage === 'new' || currentSubPage === 'create')) {
      navigate('pages');
    }
  }, [isPlatformStaff, isSiteInitialized, isAllSites, currentSubPage, navigate]);

  // Create page (allowed when not All Sites mode OR for Platform Admin)
  if ((!isAllSites || isPlatformStaff) && (currentSubPage === 'new' || currentSubPage === 'create')) {
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
