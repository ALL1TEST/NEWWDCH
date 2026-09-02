'use client';

// ============================================================
// INTERNAL ACCOUNT DASHBOARD — the dedicated dashboard of the
// INTERNAL-role account (the platform team's internal SaaS account).
// ------------------------------------------------------------
// This is a SEPARATE account type from both Platform Admin
// (platform management dashboard) and the Admin User (client CMS
// dashboard). The page:
//   • clearly identifies the signed-in account as "Internal Account"
//   • shows the account's own identity/session data
//   • links to the shared profile page for self-service email /
//     password / 2FA changes
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
import {
  Building2,
  ShieldCheck,
  User as UserIcon,
  Mail,
  Lock,
  CalendarClock,
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

  const kpis = [
    {
      label: t('internal.kpiAccountType'),
      value: t('internal.accountTypeValue'),
      icon: Building2,
      description: t('internal.accountTypeDesc'),
    },
    {
      label: t('internal.kpiBilling'),
      value: user?.billingMode === 'INTERNAL' ? t('internal.billingValue') : (user?.billingMode ?? '—'),
      icon: ShieldCheck,
      description: t('internal.billingDesc'),
    },
    {
      label: t('internal.kpiStatus'),
      value: user?.status ?? '—',
      icon: UserIcon,
      description: user?.status === 'ACTIVE' ? t('internal.statusDesc') : undefined,
    },
    {
      label: t('internal.kpiLastLogin'),
      value: formatDate(user?.lastLoginAt ?? null),
      icon: CalendarClock,
      description: `${t('internal.memberSince')}: ${formatDate(user?.createdAt ?? null)}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header — mirrors the PlatformPageHeader layout pattern
          (title + subtitle, flush against the top of the content area). */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t('internal.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('internal.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('profile')}>
          <UserIcon className="h-4 w-4 mr-1.5" />
          {t('internal.openProfile')}
        </Button>
      </div>

      {/* KPI cards — the account's own type/billing/status data. Same
          card grid pattern as the platform overview KPI row. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-foreground">{kpi.value}</div>
                {kpi.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {kpi.description}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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
