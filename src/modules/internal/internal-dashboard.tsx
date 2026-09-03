'use client';

// ============================================================
// INTERNAL ACCOUNT DASHBOARD — the dedicated dashboard of the
// INTERNAL-role account (the SaaS owner's internal account).
// ------------------------------------------------------------
// This is a SEPARATE account type from both Platform Admin
// (platform management dashboard) and the Admin User (client CMS
// dashboard). The account has FULL CMS PLATFORM ACCESS — every CMS
// feature, no plan restrictions — so its dashboard renders the
// complete CMS dashboard widget suite (executive KPIs, Site
// Network, Pending Actions, Traffic Overview, Recent Content,
// Content Pipeline — the exact same DashboardWidgets component the
// Admin User Executive Dashboard renders).
//
// The dashboard header intentionally reads "Overview" (not
// "Internal Account"): the account identity is already surfaced in
// the sidebar footer (name + INTERNAL ACCOUNT badge) and the profile
// dropdown, so duplicating "Internal Account" here would be
// redundant. The INTERNAL badge is kept next to the title to preserve
// the account-type distinction.
//
// The previous "Account Identity" and "Security & Credentials"
// cards were removed entirely (they duplicated information already
// available on the dedicated Profile page). No empty cards,
// placeholders or spacing are left behind — the dashboard focuses on
// the actual CMS dashboard content.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useT } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DashboardWidgets } from '@/modules/dashboard';
import { User as UserIcon } from 'lucide-react';
import { getApi } from '@/lib/api-client';

// Kept so the existing /api/auth/2fa/status request the page made is
// not silently dropped on existing clients / caches. The security
// card itself is gone, but the query still runs harmlessly so the
// session-bound 2FA probe stays consistent with the rest of the app
// (and so a future Profile-page deep link reuses the cached result).
interface TwoFactorStatus {
  mfaEnabled: boolean;
}

export function InternalDashboardModule() {
  const { t } = useT();
  const navigate = useNavigationStore((s) => s.navigate);

  // 2FA security status — the query is retained (single source of
  // truth shared with the Profile page) but its result is no longer
  // rendered here. See comment above.
  useQuery<TwoFactorStatus>({
    queryKey: ['2fa-status'],
    queryFn: () => getApi<TwoFactorStatus>('/api/auth/2fa/status'),
    retry: false,
  });

  return (
    <div className="space-y-6">
      {/* Page header — "Overview" title + professional internal-platform
          subtitle. The INTERNAL badge is kept to preserve the account-type
          identity at a glance, but the title is NOT "Internal Account"
          (that identity is already visible in the sidebar footer + profile
          dropdown, so duplicating it here was redundant). The "Open Profile"
          shortcut stays as the header's single action. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('internal.title')}
            </h1>
            <Badge className="h-5 shrink-0 px-1.5 text-[10px] bg-emerald-600 dark:bg-emerald-500 text-white border-transparent">
              {t('internal.badge')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t('internal.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('profile')}>
          <UserIcon className="h-4 w-4 mr-1.5" />
          {t('internal.openProfile')}
        </Button>
      </div>

      {/* The FULL CMS dashboard content — the same complete widget
          suite the Admin User Executive Dashboard renders (executive
          KPIs, Site Network, Pending Actions, Traffic Overview, Recent
          Content, Content Pipeline). Full platform access means a
          populated dashboard, never an empty screen.

          The previous "Account Identity" + "Security & Credentials"
          cards that used to render below this have been removed
          entirely — no empty cards, headings or placeholders remain.
          The account identity lives on the dedicated Profile page
          (reachable via the "Open Profile" action above). */}
      <DashboardWidgets />
    </div>
  );
}
