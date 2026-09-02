'use client';

// ============================================================
// INTERNAL ACCOUNT DASHBOARD — the dedicated dashboard of the
// INTERNAL-role account (the SaaS owner's internal account).
// ------------------------------------------------------------
// This is a SEPARATE account type from both Platform Admin
// (platform management dashboard) and the Admin User (client CMS
// dashboard). The account has FULL PLATFORM ACCESS — every CMS
// feature, no plan restrictions — so its dashboard renders the
// complete CMS dashboard widget suite (executive KPIs, Site
// Network, Pending Actions, Traffic Overview, Recent Content,
// Content Pipeline — the exact same DashboardWidgets component the
// Admin User Executive Dashboard renders) while clearly identifying
// the signed-in account as "Internal Account" (never Admin User,
// never Platform Admin, never Free/Plus/Pro):
//   • Internal Account identity header + INTERNAL badge
//   • the full shared dashboard widget suite
//   • the account's own identity/security cards
// Data comes from the session-based /api/auth/me (identity) and
// /api/auth/2fa/status (security) — no platform-admin APIs are used:
// the Internal Account is deliberately NOT a platform admin.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useT } from '@/lib/i18n';
import { getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DashboardWidgets } from '@/modules/dashboard';
import {
  ShieldCheck,
  User as UserIcon,
  Mail,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { getApi } from '@/lib/api-client';

interface TwoFactorStatus {
  mfaEnabled: boolean;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function InternalDashboardModule() {
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigationStore((s) => s.navigate);

  // 2FA security status — the same session-based endpoint the profile
  // page's Security card uses (single source of truth).
  const statusQuery = useQuery<TwoFactorStatus>({
    queryKey: ['2fa-status'],
    queryFn: () => getApi<TwoFactorStatus>('/api/auth/2fa/status'),
    retry: false,
  });
  const mfaEnabled = !!statusQuery.data?.mfaEnabled;

  return (
    <div className="space-y-6">
      {/* Page header — mirrors the PlatformPageHeader layout pattern
          (title + subtitle, flush against the top of the content area).
          The INTERNAL badge + Internal Account title/subtitle keep the
          page's own identity (never Admin User / Platform Admin). */}
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
          populated dashboard, never an empty screen. */}
      <DashboardWidgets />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account identity — the authenticated Internal Account identity
            for this session (same layout language as the profile page's
            header card). */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              {t('internal.identityTitle')}
            </CardTitle>
            <CardDescription>{t('internal.identityDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 ring-2 ring-offset-2 ring-border">
                <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? 'User'} />
                <AvatarFallback className="text-lg">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-semibold text-foreground">
                    {user?.name ?? '—'}
                  </p>
                  <Badge className="h-5 shrink-0 px-1.5 text-[10px] bg-emerald-600 dark:bg-emerald-500 text-white border-transparent">
                    {t('internal.badge')}
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground mt-0.5">
                  {user?.email ?? '—'}
                </p>
              </div>
            </div>
            <Separator />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t('internal.role')}</dt>
                <dd className="font-medium mt-0.5">{user?.role ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('internal.emailVerified')}</dt>
                <dd className="font-medium mt-0.5">
                  {t(user ? 'internal.verified' : 'internal.notVerified')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('internal.memberSince')}</dt>
                <dd className="font-medium mt-0.5">{formatDate(user?.createdAt ?? null)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('internal.kpiLastLogin')}</dt>
                <dd className="font-medium mt-0.5">{formatDate(user?.lastLoginAt ?? null)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Security + profile access — the Internal Account manages its
            own credentials (email / password / authenticator) through the
            shared profile page, exactly like every other account type. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {t('internal.securityTitle')}
            </CardTitle>
            <CardDescription>{t('internal.securityDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck
                  className={`h-5 w-5 shrink-0 ${mfaEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {t(mfaEnabled ? 'internal.mfaEnabled' : 'internal.mfaDisabled')}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t('profile.authenticatorConfigured')}
                  </p>
                </div>
              </div>
              <Badge variant={mfaEnabled ? 'default' : 'outline'} className="shrink-0">
                {t(mfaEnabled ? 'profile.enabled' : 'internal.notEnabled')}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3 min-w-0">
                <Mail className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t('internal.credentialsTitle')}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t('internal.credentialsDesc')}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate('profile')}>
                {t('internal.manageCredentials')}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
