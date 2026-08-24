'use client';

import { ShieldAlert } from 'lucide-react';
import { AdminShell } from './admin-shell';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { moduleRegistry } from '@/lib/module-registry';
import { canAccessPage } from '@/lib/permissions';

export default function AdminApp() {
  const currentModule = useNavigationStore((s) => s.currentModule);
  const user = useAuthStore((s) => s.user);

  const ModuleComponent = moduleRegistry[currentModule] ?? moduleRegistry.dashboard;

  // Access control — if the user cannot access the current page, render an
  // "Access Denied" notice instead of the module.
  const pageKey = currentModule || 'dashboard';
  const hasAccess = user
    ? canAccessPage(user.role, user.pagePermissions, pageKey)
    : true; // unauthenticated users fall through to the login screen

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
