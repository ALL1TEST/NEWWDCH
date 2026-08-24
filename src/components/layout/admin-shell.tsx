'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSiteStore } from '@/lib/stores/site-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { LoginScreen } from './login-screen';
import { AppSidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from '@/components/patterns/command-palette';
import { SidebarProvider } from '@/components/ui/sidebar';

// Modules where the page-level vertical scrollbar should be masked (hidden)
// while keeping scrolling fully functional.
const SCROLLBAR_MASKED_MODULES = new Set([
  'content',
  'comments',
  'seo',
  'smtp',
  'notifications',
  'backups',
]);

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isCheckingAuth, checkAuth } = useAuthStore();
  const initializeSites = useSiteStore((s) => s.initialize);
  const isSiteInitialized = useSiteStore((s) => s.isInitialized);
  const currentModule = useNavigationStore((s) => s.currentModule);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && !isSiteInitialized) {
      initializeSites();
    }
  }, [isAuthenticated, isSiteInitialized, initializeSites]);

  // Toggle the scrollbar-masked class on <html> based on the current module.
  useEffect(() => {
    const html = document.documentElement;
    if (SCROLLBAR_MASKED_MODULES.has(currentModule)) {
      html.classList.add('scrollbar-masked');
    } else {
      html.classList.remove('scrollbar-masked');
    }
    // Cleanup on unmount
    return () => html.classList.remove('scrollbar-masked');
  }, [currentModule]);

  if (isCheckingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <SidebarProvider className="h-auto min-h-svh overflow-visible">
      <div className="min-h-svh flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Topbar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
