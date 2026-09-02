'use client';

import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AdminShell } from './admin-shell';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanEntitlements, isModuleAllowedByPlan, isSmtpSettingsAllowedByPlan } from '@/hooks/use-entitlements';
import { useSubscriptionServerSync } from '@/hooks/use-subscription-sync';
import { moduleRegistry } from '@/lib/module-registry';
import { canAccessPage, isPlatformPage } from '@/lib/permissions';
import { useT } from '@/lib/i18n';

export default function AdminApp() {
  const currentModule = useNavigationStore((s) => s.currentModule);
  const currentItemId = useNavigationStore((s) => s.currentItemId);
  const navigate = useNavigationStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);
  const { t } = useT();

  // PLATFORM_ADMIN and OWNER users land on the Platform Overview by default
  // (the hash defaults to 'dashboard' which is a client page they
  // cannot access). Redirect once on mount. The 'profile' page is a
  // shared account-settings page accessible to platform staff too
  // (name / email / change-password / account info) — it is excluded
  // from the redirect so the profile menu's "Profile" action works for
  // platform admins.
  useEffect(() => {
    const isPlatformStaff = user?.role === 'PLATFORM_ADMIN' || user?.role === 'OWNER';
    if (isPlatformStaff && !isPlatformPage(currentModule) && currentModule !== 'profile') {
      navigate('platform-overview');
    }
    // INTERNAL — the dedicated Internal Account. It lands on its OWN
    // Internal Account dashboard (never the Platform Admin dashboard,
    // never the Admin User client dashboard). 'profile' / 'billing' /
    // 'notifications' are its shared self-service account pages and are
    // excluded from the redirect; anything else (including platform-
    // * pages and client CMS pages the account cannot access) routes
    // back to the internal dashboard.
    const isInternalAccount = user?.role === 'INTERNAL';
    if (isInternalAccount && !(currentModule === 'internal-dashboard' || currentModule === 'profile' || currentModule === 'billing' || currentModule === 'notifications')) {
      navigate('internal-dashboard');
    }
    // No other account type may land on the Internal Account dashboard —
    // it belongs exclusively to the INTERNAL-role account.
    if (user && !isInternalAccount && currentModule === 'internal-dashboard') {
      navigate(isPlatformStaff ? 'platform-overview' : 'dashboard');
    }
    // CLIENT roles that somehow land on a platform page fall back to
    // their client dashboard. (INTERNAL is handled above — platform
    // pages route it back to its own internal dashboard.)
    if (user && !isPlatformStaff && !isInternalAccount && isPlatformPage(currentModule)) {
      navigate('dashboard');
    }
    // ANALYTICS REMOVAL (Admin User dashboard only) — the Analytics
    // module is no longer part of the client CMS: the sidebar entry and
    // the command palette entry are gone, and this guard closes the
    // direct-URL path, so a client role manually entering #analytics is
    // redirected to their dashboard and can never reach the module.
    // Platform staff were already redirected to platform pages by the
    // rule above — the Platform Admin dashboard is unaffected.
    if (user && !isPlatformStaff && !isInternalAccount && currentModule === 'analytics') {
      navigate('dashboard');
    }
  }, [user, currentModule, navigate]);

  const ModuleComponent = moduleRegistry[currentModule] ?? moduleRegistry.dashboard;

  // Access control — if the user cannot access the current page,
  // render an "Access Denied" notice instead of the module.
  const pageKey = currentModule || 'dashboard';

  // PLAN FEATURE SYNC (route guard) — Platform Admin → Plans & Pricing
  // → Feature Access for the customer's ACTIVE plan is the single
  // source of truth for the Admin User dashboard (never the plan name):
  // modules whose page key requires a plan feature (MODULE_FEATURE_MAP:
  // seo → Advanced SEO, analytics → Advanced Analytics, comments,
  // newsletter, automation, email-templates, backups, ai → Client's
  // Own AI API) are blocked with the Access Denied notice when the plan
  // lacks the feature — hiding the sidebar entry alone is NOT enough, a
  // user manually entering the disabled feature's URL is stopped here.
  // SMTP SETTINGS (derived): the 'settings' module IS the SMTP Settings
  // page (its only page — #settings and #settings/smtp both land there),
  // and SMTP Settings is NOT a plan feature but supporting configuration
  // for Email Templates + Newsletter → the whole module is blocked with
  // Access Denied when the plan enables NEITHER dependent.
  // While the entitlements query loads the page renders (cosmetic
  // fail-open) — every feature API route enforces requireFeature /
  // requireAnyFeatureAllowStaff server-side (403 FEATURE_NOT_AVAILABLE),
  // so no data leaks.
  const { data: planEntitlements } = usePlanEntitlements();
  const isStaff = user?.role === 'PLATFORM_ADMIN' || user?.role === 'OWNER';

  // SUBSCRIPTION SYNC — mirrors the user's ACTIVE server-side plan
  // (the same /api/platform/billing/me data Billing & Subscription
  // renders) into the subscription store, so every badge render site
  // (sidebar footer, profile dropdown header, profile page) shows the
  // actual plan with the plan's own styling. Shared query key →
  // plan changes on the billing page refresh the badge immediately;
  // refresh/login re-sync automatically. Badge sites hide until the
  // first sync lands (never a default/stale value).
  useSubscriptionServerSync();

  const featureAllowed = isStaff || (pageKey === 'settings'
    ? isSmtpSettingsAllowedByPlan(planEntitlements)
    : isModuleAllowedByPlan(pageKey, planEntitlements));

  const hasAccess = user
    ? canAccessPage(user.role, user.pagePermissions, pageKey) && featureAllowed
    : true;

  // Suppress unused-var warning for currentItemId (kept for nav sync).
  void currentItemId;

  return (
    <AdminShell>
      {hasAccess ? (
        <ModuleComponent />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">{t('app.accessDenied')}</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {t('app.accessDeniedDescription')}
          </p>
        </div>
      )}
    </AdminShell>
  );
}
