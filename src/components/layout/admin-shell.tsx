'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSiteStore } from '@/lib/stores/site-store';
import { LoginScreen } from './login-screen';
import { AppSidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from '@/components/patterns/command-palette';
import { SidebarProvider } from '@/components/ui/sidebar';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isCheckingAuth, checkAuth } = useAuthStore();
  const initializeSites = useSiteStore((s) => s.initialize);
  const isSiteInitialized = useSiteStore((s) => s.isInitialized);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && !isSiteInitialized) {
      initializeSites();
    }
  }, [isAuthenticated, isSiteInitialized, initializeSites]);

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
    // Canonical shadcn shell contract: the provider is viewport-clamped
    // (h-svh + overflow-hidden). Do NOT relax it to h-auto/overflow-visible —
    // that lets this wrapper (and the in-flow [data-slot=sidebar] peer)
    // stretch to full page height on short viewports, so transparent box of
    // stretched rows ends up under the footer utility cluster and hijacks
    // its clicks (avatar "not responding" bug).
    <SidebarProvider>
      {/* Inner row must not outgrow the clamped wrapper; main becomes the
          scroll container so tall pages still scroll — just internally,
          exactly like every standard shadcn dashboard layout. */}
      <div className="flex h-full w-full bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Topbar />
          <main className="flex-1 min-h-0 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
