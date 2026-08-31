'use client';

import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AdminShell } from './admin-shell';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlanEntitlements, isModuleAllowedByPlan } from '@/hooks/use-entitlements';
import { moduleRegistry } from '@/lib/module-registry';
import { canAccessPage, isPlatformPage } from '@/lib/permissions';

export default function AdminApp() {
  const currentModule = useNavigationStore((s) => s.currentModule);
  const currentItemId = useNavigationStore((s) => s.currentItemId);
  const navigate = useNavigationStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);

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
    // CLIENT roles that somehow land on a platform page fall back to
    // their client dashboard.
    if (user && !isPlatformStaff && isPlatformPage(currentModule)) {
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
  // While the entitlements query loads the page renders (cosmetic
  // fail-open) — every feature API route enforces requireFeature
  // server-side (403 FEATURE_NOT_AVAILABLE), so no data leaks.
  const { data: planEntitlements } = usePlanEntitlements();
  const isStaff = user?.role === 'PLATFORM_ADMIN' || user?.role === 'OWNER';
  const featureAllowed = isStaff || isModuleAllowedByPlan(pageKey, planEntitlements);

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
          <h2 className="text-xl font-semibold tracking-tight">Access Denied</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            You don&apos;t have permission to view this page.
            Contact an administrator if you believe this is an error.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
