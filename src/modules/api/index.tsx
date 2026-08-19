'use client';

import React from 'react';
import {
  LayoutDashboard,
  Key,
  ScrollText,
  FileText,
  Terminal,
  Link,
  KeyRound,
  Gauge,
} from 'lucide-react';
import { PageSubNav } from '@/components/patterns';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { ApiDashboardPage } from './api-dashboard-page';
import { ApiKeysPage } from './api-keys-page';
import { ApiLogsPage } from './api-logs-page';
import { ApiDocsPage } from './api-docs-page';
import { ApiExplorerPage } from './api-explorer-page';
import { OAuthClientsPage } from './oauth-clients-page';
import { PatPage } from './pat-page';
import { RateLimitsPage } from './rate-limits-page';

// ==================== Sub-Navigation Tabs ====================

const API_TABS = [
  { key: null, label: 'Dashboard', icon: LayoutDashboard },
  { key: 'keys', label: 'API Keys', icon: Key },
  { key: 'logs', label: 'API Logs', icon: ScrollText },
  { key: 'docs', label: 'Documentation', icon: FileText },
  { key: 'explorer', label: 'Explorer', icon: Terminal },
  { key: 'oauth', label: 'OAuth Clients', icon: Link },
  { key: 'tokens', label: 'Access Tokens', icon: KeyRound },
  { key: 'rate-limits', label: 'Rate Limits', icon: Gauge },
];

const SUB_PAGES: Record<string, React.ComponentType> = {
  keys: ApiKeysPage,
  logs: ApiLogsPage,
  docs: ApiDocsPage,
  explorer: ApiExplorerPage,
  oauth: OAuthClientsPage,
  tokens: PatPage,
  'rate-limits': RateLimitsPage,
};

export function ApiModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);

  const SubPage = currentSubPage ? SUB_PAGES[currentSubPage] : ApiDashboardPage;

  return (
    <>
      <PageSubNav module="api" tabs={API_TABS} />
      {SubPage ? <SubPage /> : (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground text-lg font-medium">Page not found</p>
            <p className="text-muted-foreground text-sm mt-1">The requested API sub-page does not exist.</p>
          </div>
        </div>
      )}
    </>
  );
}
