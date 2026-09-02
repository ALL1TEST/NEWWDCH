'use client';

import { Search } from 'lucide-react';
import { useCommandPaletteStore } from '@/lib/stores/command-palette-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Breadcrumbs, hasBreadcrumb } from '@/components/layout/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// -------------------- Topbar --------------------
//
// The "All Sites" site selector lives INSIDE THE SIDEBAR HEADER, directly
// below the "CMS Admin" logo row — see `src/components/layout/site-
// selector.tsx` → `SiteSelector`, rendered inside `SidebarHeader` in
// sidebar.tsx. It is NOT rendered here in the topbar (no duplication).
//
// The topbar carries: the mobile drawer toggle, the breadcrumb path (when
// the current module renders one), and the mobile-only Search icon.
//
// VERTICAL SPACE RULE:
// On mobile the topbar is ALWAYS visible (h-14) because the mobile drawer
// toggle (`SidebarTrigger`) lives here.
// On DESKTOP, when the current module has NO breadcrumb to show (see
// `hasBreadcrumb()` in `breadcrumbs.tsx` — Dashboard, Calendar, Users,
// Comments, Media, Settings, etc.), the topbar would be an empty 56px
// white strip — so we hide it entirely (`sm:hidden`) on desktop in that
// case. The main content then sits flush against the top of the viewport,
// right under where the topbar used to be (no empty blank space above
// the page title). When the module DOES have a breadcrumb (e.g. Profile,
// Billing), the topbar shows normally on desktop with the breadcrumb path.

export function Topbar() {
  const openCommandPalette = useCommandPaletteStore((s) => s.open);
  const currentModule = useNavigationStore((s) => s.currentModule);
  const showBreadcrumb = hasBreadcrumb(currentModule);
  const { t } = useT();

  return (
    <header
      className={cn(
        'h-14 shrink-0 border-b bg-background flex items-center gap-2 px-3 sm:px-4',
        // On desktop, hide the entire topbar when there is no breadcrumb to
        // show — otherwise it's a 56px empty white strip above the title.
        !showBreadcrumb && 'sm:hidden',
      )}
    >
      {/* Mobile drawer toggle — the desktop collapse control lives in the
          sidebar header, next to the CMS Admin name. */}
      <SidebarTrigger className="-ml-1 sm:hidden" />

      <Separator orientation="vertical" className="mr-1 h-4 sm:hidden" />

      {/* Breadcrumb path. The "All Sites" site selector now lives in the
          sidebar header (below the CMS Admin logo) — not in the topbar.
          For modules that render a topbar breadcrumb, this shows the
          "All Sites > [icon] Label" path; for no-breadcrumb modules the
          topbar is hidden entirely on desktop (see the className above). */}
      <div className="flex-1 overflow-hidden flex items-center">
        <Breadcrumbs />
      </div>

      {/* Right side actions — the standalone Theme / Notifications /
          Profile-avatar controls have been consolidated: Theme now lives
          INSIDE the profile dropdown (see user-profile-menu.tsx), and
          Notifications + the profile avatar live in the sidebar footer
          (expanded) / collapsed rail. The topbar no longer duplicates
          them. Only the mobile-only Search icon remains here (desktop
          search lives in the sidebar header). */}
      <div className="flex items-center gap-1">
        {/* Search icon (mobile only — desktop keeps it next to the
            CMS Admin title in the sidebar header) */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:hidden"
          onClick={openCommandPalette}
          aria-label={t('app.search')}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">{t('app.search')}</span>
        </Button>
      </div>
    </header>
  );
}
