'use client';

import { Search } from 'lucide-react';
import { useCommandPaletteStore } from '@/lib/stores/command-palette-store';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

// -------------------- Topbar --------------------
//
// The "All Sites" site selector USED to live here in the topbar. It has
// been MOVED INTO THE SIDEBAR HEADER (directly below the "CMS Admin"
// logo row) — see `src/components/layout/site-selector.tsx` →
// `SiteSelector`, rendered inside `SidebarHeader` in sidebar.tsx.
//
// The topbar now only carries: the mobile drawer toggle, the breadcrumb
// path, and the mobile-only Search icon. Desktop collapse control +
// search live in the sidebar header; the site selector lives in the
// sidebar header; theme/notifications/profile live in the sidebar footer.

export function Topbar() {
  const openCommandPalette = useCommandPaletteStore((s) => s.open);

  return (
    <header className="h-14 shrink-0 border-b bg-background flex items-center gap-2 px-3 sm:px-4">
      {/* Mobile drawer toggle — the desktop collapse control lives in the
          sidebar header, next to the CMS Admin name. */}
      <SidebarTrigger className="-ml-1 sm:hidden" />

      <Separator orientation="vertical" className="mr-1 h-4 sm:hidden" />

      {/* Breadcrumb path. The "All Sites" site selector now lives in the
          sidebar header (below the CMS Admin logo) — not in the topbar.
          For modules that render a topbar breadcrumb, this shows the
          "All Sites > [icon] Label" path; for no-breadcrumb modules the
          topbar keeps just empty space here. */}
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
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
      </div>
    </header>
  );
}
