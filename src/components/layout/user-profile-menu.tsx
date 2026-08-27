'use client';

import React from 'react';
import {
  User,
  LogOut,
  CreditCard,
  Languages,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { useLocaleStore } from '@/lib/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

/**
 * SINGLE-SOURCE profile menu (Profile / Language / Manage Subscription /
 * Log out).
 *
 * Used by BOTH the topbar avatar and the collapsed-sidebar avatar so there
 * is exactly one implementation of the menu itself. The caller provides the
 * trigger element as `children`.
 *
 * Positioning defaults match the original topbar usage (side bottom +
 * align end); callers may override via props without touching the menu
 * contents.
 */
export function UserProfileMenu({
  children,
  side,
  align = 'end',
  collisionPadding,
}: {
  /** The dropdown trigger element (must accept refs / event props). */
  children: React.ReactNode;
  /** Optional Radix side override (e.g. right for the collapsed rail). */
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Optional viewport collision padding (corner-anchored triggers). */
  collisionPadding?: number;
}) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  // NOTE: no plan badge here — the plan badge lives ONLY on the topbar
  // avatar trigger (this menu's own trigger). Duplicating it inside the
  // dropdown header read as "Beta Beta"; removing it keeps a single,
  // always-in-sync subscription badge per the top-right avatar.

  const handleNavigate = (targetMod: string) => {
    useNavigationStore.getState().navigate(targetMod);
    closeMobile();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      {/* z-[60]: floats above sidebar (z-10) and sticky headers (z-40/50)
          so the menu is never hidden behind any layer. Compact 224px
          popover: header → Profile → Language → Manage Subscription →
          Log out, with a subtle divider between every section. */}
      <DropdownMenuContent
        className="w-56 z-[60]"
        side={side}
        align={align}
        collisionPadding={collisionPadding}
      >
        {/* 1 — Profile header: circular avatar on the LEFT, vertically
            centered; name on the first line and email directly below in
            smaller gray text, both aligned to the right of the avatar.
            Same image source as the sidebar/topbar triggers (avatarUrl →
            initials fallback). truncate keeps long names/emails from
            breaking the two-line alignment. */}
        <DropdownMenuLabel className="font-normal px-2 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border">
              <AvatarImage
                src={user?.avatarUrl ?? undefined}
                alt={user?.name ?? 'User'}
              />
              <AvatarFallback className="text-xs font-medium">
                {user ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col space-y-0.5">
              <p className="truncate text-sm font-medium leading-5">
                {user?.name ?? 'User'}
              </p>
              <p className="truncate text-xs leading-4 text-muted-foreground">
                {user?.email ?? ''}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* 2 — Profile → existing profile page */}
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => handleNavigate('profile')}
        >
          <User className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* 3 — Language with EN / FR selector (existing locale state) */}
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Language</span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className={cn(
                'h-6 px-2.5 text-xs font-medium rounded-md transition-colors',
                locale === 'en'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => { setLocale('en'); toast.success('Language set to EN'); }}
            >
              EN
            </button>
            <button
              type="button"
              className={cn(
                'h-6 px-2.5 text-xs font-medium rounded-md transition-colors',
                locale === 'fr'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => { setLocale('fr'); toast.success('Langue définie sur FR'); }}
            >
              FR
            </button>
          </div>
        </div>
        <DropdownMenuSeparator />

        {/* 4 — Manage Subscription → existing billing module */}
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => handleNavigate('billing')}
        >
          <CreditCard className="h-4 w-4" />
          Manage Subscription
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* 5 — Log out (destructive, existing auth-store handler) */}
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
