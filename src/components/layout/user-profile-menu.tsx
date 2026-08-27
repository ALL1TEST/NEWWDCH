'use client';

import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import {
  User,
  LogOut,
  CreditCard,
  Languages,
  Sun,
  Moon,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { useLocaleStore } from '@/lib/i18n';
import {
  useSubscriptionStore,
  getPlanBadgeStyle,
} from '@/lib/stores/subscription-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PlanBadge } from '@/components/layout/plan-badge';
import { toast } from 'sonner';

/**
 * SINGLE-SOURCE profile menu (Profile / Language / Theme /
 * Manage Subscription / Log out).
 *
 * Used by BOTH the topbar avatar and the collapsed-sidebar avatar so there
 * is exactly one implementation of the menu itself. The caller provides the
 * trigger element as `children`.
 *
 * Positioning defaults match the original topbar usage (side bottom +
 * align end); callers may override via props without touching the menu
 * contents.
 *
 * HOVER TOOLTIP (withTooltip=true, used ONLY by the collapsed-rail
 * avatar): wraps the trigger children in a HOVER Tooltip showing the
 * "Profile" label to the right of the collapsed sidebar rail (positioned
 * identically to every other collapsed-rail tooltip — see
 * COLLAPSED_TOOLTIP_PROPS in sidebar.tsx). The Tooltip is suppressed
 * while the dropdown is open so the two never visually conflict. The
 * TooltipTrigger asChild + DropdownMenuTrigger asChild composition
 * (Radix Slot chaining) lets the same Button serve BOTH triggers:
 * hover → Tooltip, click → Dropdown. NO clicking required to see the
 * label. The Dropdown's open state is tracked internally via useState
 * (instead of leaving it uncontrolled) so the Tooltip's `hidden={open}`
 * suppression works.
 */
export function UserProfileMenu({
  children,
  side,
  align = 'end',
  sideOffset = 8,
  alignOffset = 0,
  collisionPadding = 8,
  withTooltip = false,
  tooltipLabel = 'Profile',
}: {
  /** The dropdown trigger element (must accept refs / event props). */
  children: React.ReactNode;
  /** Optional Radix side override (e.g. right for the collapsed rail). */
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Vertical gap between the trigger and the dropdown (px). */
  sideOffset?: number;
  /** Horizontal shift from the alignment anchor (px). A positive value
      with align="start" shifts the dropdown rightward — used by the
      sidebar footer to create a visible gap from the sidebar's left
      edge so the dropdown opens slightly inside the page. */
  alignOffset?: number;
  /** Optional viewport collision padding (corner-anchored triggers). */
  collisionPadding?: number;
  /** When true, wraps the trigger children in a HOVER Tooltip showing
      the label (default "Profile"). See component JSDoc above. */
  withTooltip?: boolean;
  /** Label text for the hover Tooltip (default "Profile"). */
  tooltipLabel?: string;
}) {
  // Track the Dropdown's open state so the hover Tooltip can be
  // suppressed (hidden={open}) while the dropdown is open — without
  // this, the Tooltip bubble would visually conflict with the open
  // dropdown panel.
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  // Active plan — drives the colored ring on the header avatar so the
  // dropdown header's avatar matches the top-right topbar avatar trigger
  // exactly (same ring color/thickness/offset).
  const { currentPlan } = useSubscriptionStore();
  // Theme — same next-themes state the old topbar ThemeToggle used. The
  // dropdown is now the single in-header access point for the theme
  // control (the standalone topbar toggle was removed to avoid a
  // duplicate). setTheme persists via next-themes (localStorage +
  // html.dark class), so the whole app re-renders consistently.
  const { theme, setTheme } = useTheme();

  const handleNavigate = (targetMod: string) => {
    useNavigationStore.getState().navigate(targetMod);
    closeMobile();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {withTooltip ? (
        /* HOVER Tooltip wraps the trigger children (the avatar Button
           passed by the caller) so the label appears on plain mouse
           hover (no click required) — positioned identically to every
           other collapsed-rail tooltip (side=right, align=center,
           sideOffset=8, collisionPadding=12 — the SAME four values as
           COLLAPSED_TOOLTIP_PROPS in sidebar.tsx, inlined here because
           user-profile-menu.tsx is a leaf component). The values are
           inlined (not imported) to keep the file self-contained; if
           you change them here, change them in sidebar.tsx +
           theme-toggle.tsx + notification-bell.tsx too.

           Slot chaining: TooltipTrigger asChild → DropdownMenuTrigger
           asChild → children (the avatar Button). Both Slots clone the
           Button and merge their props, so the same Button element
           serves BOTH triggers — hover fires the Tooltip, click fires
           the Dropdown. hidden={open} forces the Tooltip content
           display:none while the dropdown is open so the label never
           visually conflicts with the open profile menu panel. */
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              {children}
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            align="center"
            sideOffset={8}
            collisionPadding={12}
            hidden={open}
          >
            {tooltipLabel}
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>
          {children}
        </DropdownMenuTrigger>
      )}
      {/* z-[60]: floats above sidebar (z-10) and sticky headers (z-40/50)
          so the menu is never hidden behind any layer. Compact 224px
          popover: header → Profile → Language → Manage Subscription →
          Log out, with a subtle divider between every section. */}
      <DropdownMenuContent
        className="w-56 z-[60] rounded-lg shadow-lg"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
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
            {/* Header avatar — visually identical ring treatment to the
                top-right topbar avatar trigger: same size class family
                (rounded-full), same ring-2 + ring-offset-2 + plan-derived
                ring color, so the two avatars look like the same profile
                "chip" in both locations. Slightly larger (h-11 w-11) than
                the topbar trigger (h-8 w-8) so it reads as the prominent
                header of the open menu, matching the reference layout. */}
            <Avatar className={cn(
              'h-11 w-11 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-background',
              getPlanBadgeStyle(currentPlan).ring,
            )}>
              <AvatarImage
                src={user?.avatarUrl ?? undefined}
                alt={user?.name ?? 'User'}
              />
              <AvatarFallback className="text-sm font-medium">
                {user ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col space-y-0.5">
              {/* Name + plan badge on the first line. The badge is the
                  SAME PlanBadge component used on the top-right avatar
                  trigger (see topbar.tsx) — single source of truth, so
                  the two always render identically. Only the positioning
                  differs: the avatar trigger anchors it with absolute
                  -bottom-1.5, while here it sits inline next to the name
                  with shrink-0 so the flex row never compresses it. */}
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-sm font-medium leading-5">
                  {user?.name ?? 'User'}
                </p>
                <PlanBadge className="shrink-0" />
              </div>
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

        {/* 4 — Theme with Light / Dark selector. Reuses the SAME
            next-themes state the rest of the app uses (no second source
            of truth). The dropdown is now the single in-header place to
            switch theme — the old standalone topbar ThemeToggle was
            removed to avoid a duplicate. Layout mirrors the Language
            selector above (icon + label on the left, two segmented
            buttons on the right) for visual consistency. */}
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Sun className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">Theme</span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className={cn(
                'h-6 px-2.5 text-xs font-medium rounded-md transition-colors',
                theme === 'light'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => { setTheme('light'); toast.success('Theme set to Light'); }}
            >
              Light
            </button>
            <button
              type="button"
              className={cn(
                'h-6 px-2.5 text-xs font-medium rounded-md transition-colors',
                theme === 'dark'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => { setTheme('dark'); toast.success('Theme set to Dark'); }}
            >
              Dark
            </button>
          </div>
        </div>
        <DropdownMenuSeparator />

        {/* 5 — Manage Subscription → existing billing module */}
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => handleNavigate('billing')}
        >
          <CreditCard className="h-4 w-4" />
          Manage Subscription
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* 6 — Log out (destructive, existing auth-store handler) */}
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
