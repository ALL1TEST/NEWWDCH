'use client';

import { AdminShell } from './admin-shell';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { moduleRegistry } from '@/lib/module-registry';

export default function AdminApp() {
  const currentModule = useNavigationStore((s) => s.currentModule);
  const ModuleComponent = moduleRegistry[currentModule] ?? moduleRegistry.dashboard;
  return (
    <AdminShell>
      <ModuleComponent />
    </AdminShell>
  );
}
