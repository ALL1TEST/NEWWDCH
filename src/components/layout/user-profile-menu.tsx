'use client';

import React from 'react';
import {
  User,
  LogOut,
  CreditCard,
  Languages,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { useLocaleStore } from '@/lib/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
}: {
  /** The dropdown trigger element (must accept refs / event props). */
  children: React.ReactNode;
  /** Optional Radix side override (e.g. right for the collapsed rail). */
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const handleNavigate = (targetMod: string) => {
    useNavigationStore.getState().navigate(targetMod);
    closeMobile();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" side={side} align={align}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name ?? 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email ?? ''}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleNavigate('profile')}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Languages className="mr-2 h-4 w-4 text-muted-foreground" />
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
          <DropdownMenuItem onClick={() => handleNavigate('billing')}>
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Subscription
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => void logout()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
