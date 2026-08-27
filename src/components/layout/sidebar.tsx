'use client';

import React, { createElement, useState, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  FileText,
  Image,
  FolderOpen,
  Users,
  Tag,
  MessageSquare,
  Mail,
  Search,
  Navigation,
  BarChart3,
  Bell,
  Calendar,
  Sparkles,
  Webhook,
  Settings,
  Database,
  Activity,
  MailPlus,
  ChevronRight,
  Plug,
  Key,
  ScrollText,
  Terminal,
  Link,
  KeyRound,
  Clock,
  RotateCcw,
  HeartPulse,
  Cpu,
  ListTodo,
  BellRing,
  Brain,
  HardDrive,
  ShieldAlert,
  Globe,
  BookOpen,
  Shield,
  Layers,
  Upload,
  AlertTriangle,
  Gauge,
  Zap,
  Server,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { getVisibleNavItems } from '@/lib/permissions';
import type { NavItem } from '@/shared/types';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useCommandPaletteStore } from '@/lib/stores/command-palette-store';
import { useSubscriptionStore } from '@/lib/stores/subscription-store';
import { NotificationBell } from '@/components/layout/notification-bell';
import { UserProfileMenu } from '@/components/layout/user-profile-menu';
import { ThemeToggle } from '@/components/layout/theme-toggle';

// -------------------- Icon Mapping --------------------

const ICON_MAP: Record<string, LucideIcon> = {
  'LayoutDashboard': LayoutDashboard,
  'FileText': FileText,
  'Image': Image,
  'FolderOpen': FolderOpen,
  'Users': Users,
  'Tag': Tag,
  'MessageSquare': MessageSquare,
  'Mail': Mail,
  'Search': Search,
  'Navigation': Navigation,
  'BarChart3': BarChart3,
  'Bell': Bell,
  'Calendar': Calendar,
  'Sparkles': Sparkles,
  'Webhook': Webhook,
  'Settings': Settings,
  'Database': Database,
  'Activity': Activity,
  'MailTemplate': MailPlus,
  'Plug': Plug,
  'Key': Key,
  'ScrollText': ScrollText,
  'Terminal': Terminal,
  'Link': Link,
  'KeyRound': KeyRound,
  'Clock': Clock,
  'RotateCcw': RotateCcw,
  'HeartPulse': HeartPulse,
  'Cpu': Cpu,
  'ListTodo': ListTodo,
  'BellRing': BellRing,
  'Brain': Brain,
  'HardDrive': HardDrive,
  'ShieldAlert': ShieldAlert,
  'Globe': Globe,
  'BookOpen': BookOpen,
  'Shield': Shield,
  'Layers': Layers,
  'Upload': Upload,
  'AlertTriangle': AlertTriangle,
  'Gauge': Gauge,
  'Zap': Zap,
  'Server': Server,
};

function getIcon(iconName?: string): LucideIcon {
  if (!iconName) return FileText;
  return ICON_MAP[iconName] ?? FileText;
}

// -------------------- Collapsed-Rail Tooltip Positioning -------------------
/*
 * SINGLE source of truth for the positioning of every tooltip/label that
 * appears when the sidebar is collapsed into the 48px icon rail.
 *
 *   side="right"         → opens to the RIGHT of the 48px collapsed rail,
 *                          fully inside the main viewport (never overlaps
 *                          the rail, never opens to the left/outside).
 *   align="center"       → vertically centers the bubble on the icon's
 *                          32×32 hover target so labels line up across
 *                          every row of the rail (logo, theme, nav items,
 *                          parent items with submenu).
 *   sideOffset=8         → ~8px visible gap from the trigger button's right
 *                          edge (button right edge ~x=40 inside the 48px
 *                          rail, tooltip left edge ~x=48 = the rail's
 *                          right edge — flush with the RAIL, NOT with the
 *                          icon, so the bubble never touches the glyph).
 *   collisionPadding=12 → 12px viewport-edge collision padding so the
 *                          bubble can never be clipped at any viewport
 *                          edge or scroll past the visible area.
 *
 * Portal-based rendering (Radix TooltipPrimitive.Portal → document.body,
 * wired inside src/components/ui/tooltip.tsx) means every tooltip is
 * rendered OUTSIDE the sidebar DOM tree — so the sidebar's
 * overflow-hidden / overflow-x-hidden on the rail container can NEVER
 * clip or hide the bubble. The tooltip floats above every other
 * element at z-50.
 *
 * Used by:
 *   • CollapsedLogoButton         (header "Expand" tooltip)
 *   • SimpleNavItem              (leaf nav items: Dashboard, Articles,
 *                                  Calendar, Media, Users, Comments,
 *                                  Newsletter, SEO, AI, Automation)
 *   • ExpandableNavItem          (parent nav items in EXPANDED state —
 *                                  tooltip is hidden by SidebarMenuButton
 *                                  when state!=="collapsed", but the
 *                                  positioning object is still applied
 *                                  so the prop stays consistent across
 *                                  every nav item renderer)
 *   • CollapsedParentNavItem     (parent nav items in COLLAPSED state —
 *                                  label tooltip shows when the floating
 *                                  popover is CLOSED; when the popover is
 *                                  open, no tooltip shows to avoid visual
 *                                  conflict)
 *
 * The ThemeToggle component (src/components/layout/theme-toggle.tsx) lives
 * in a separate file and inlines the SAME four values — see the comment
 * there for the rationale.
 */
const COLLAPSED_TOOLTIP_PROPS: React.ComponentProps<typeof TooltipContent> = {
  side: 'right',
  align: 'center',
  sideOffset: 8,
  collisionPadding: 12,
};

// -------------------- Navigation Config --------------------

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '#',
    icon: 'LayoutDashboard',
  },
  {
    label: 'Articles',
    href: '#content',
    icon: 'FileText',
  },
  {
    label: 'Calendar',
    href: '#calendar',
    icon: 'Calendar',
  },
  {
    label: 'Media',
    href: '#media',
    icon: 'Image',
  },
  {
    label: 'Users',
    href: '#users',
    icon: 'Users',
    requiredRole: 'ADMIN',
  },
  {
    label: 'Comments',
    href: '#comments',
    icon: 'MessageSquare',
    requiredPermission: 'comments:read',
  },
  {
    label: 'Newsletter',
    href: '#newsletter',
    icon: 'Mail',
  },
  {
    label: 'SEO',
    href: '#seo',
    icon: 'Search',
  },
  {
    label: 'AI',
    href: '#ai',
    icon: 'Sparkles',
  },
  {
    label: 'Automation',
    href: '#automation',
    icon: 'Zap',
    requiredRole: 'ADMIN',
  },
  {
    label: 'Settings',
    href: '#settings',
    icon: 'Settings',
    requiredRole: 'ADMIN',
    children: [
      { label: 'Email Templates', href: '#email-templates', icon: 'MailTemplate' },
      { label: 'SMTP Settings', href: '#settings/smtp', icon: 'Server' },
      { label: 'Notifications', href: '#notifications', icon: 'Bell' },
      { label: 'Backups', href: '#backups', icon: 'Database' },
    ],
  },
];

// -------------------- Explicit Top-Level Section Mapping --------------------
// This is the SINGLE source of truth for which top-level section a route belongs to.
// It uses EXPLICIT route prefix matching — NO iteration, NO guessing.

const ROUTE_PREFIX_TO_SECTION: Record<string, string> = {
  'content': 'Content',
  'automation': 'Automation',
  'settings': 'Settings',
  // Modules moved under Settings — keep them mapped to the Settings section
  // so the Settings submenu auto-expands when navigating to these pages.
  'backups': 'Settings',
  'email-templates': 'Settings',
  'notifications': 'Settings',
};

/**
 * Derive the top-level section ID from the current browser hash.
 * Uses EXPLICIT prefix matching — #settings/seo always returns 'Settings', never 'SEO'.
 */
function getSectionFromHash(hash: string): string | null {
  const path = hash.replace(/^#\/?,?/, '').trim();
  if (!path || path === 'dashboard') return null;

  const firstSegment = path.split('/')[0];
  return ROUTE_PREFIX_TO_SECTION[firstSegment] ?? null;
}

// -------------------- Group Definitions --------------------

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Flat sidebar: all items in a single group, no section headings.
function buildNavGroups(items: NavItem[]): NavGroup[] {
  return [{ label: '', items }];
}

// -------------------- Helpers --------------------

function hrefToModule(href: string): string {
  const hash = href.replace(/^#/, '');
  return hash.split('/')[0] || 'dashboard';
}

function NavIcon({ name }: { name?: string }) {
  const Icon = getIcon(name);
  return createElement(Icon);
}

// -------------------- Shared Icon Grid -------------------
/*
 * ONE icon grid governs every sidebar row:
 *
 *   collapsed rail width ......... var(--sidebar-width-icon) = 48px
 *   cell width (every icon/logo).. 32px × 32px   (h-8 w-8)
 *   horizontal padding ............ 8px each side
 *   ⇒ horizontal center-line ..... x = 24px for LOGO, NAV ICONS,
 *     SETTINGS POPOVER ANCHOR, AVATAR and LOGOUT alike.
 *
 * No ad-hoc margins: anything square in the sidebar is exactly this
 * geometry, so the "C" logo, the collapse control, nav icons (including
 * the AI star/sparkle) and footer controls share one visual axis.
 */
function LogoMark() {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm select-none"
    >
      C
    </div>
  );
}

/**
 * Collapsed-rail logo cell. Since the extra collapse-toggle icon was removed
 * from below the logo, THIS cell is the explicit expand control:
 *   • identical 32×32 grid geometry as every other rail icon
 *   • click toggles the sidebar open (SidebarRail edge strip still works)
 * No new icon is introduced and no empty clickable ghost remains.
 *
 * HOVER BEHAVIOR (collapsed state only — this button is rendered ONLY
 * inside the collapsed-rail cluster, so the expanded LogoMark is untouched):
 *   • at rest ............ shows the "C" logo mark on its bg-primary black
 *                           box (NORMAL LOGO — background UNCHANGED, same
 *                           as the expanded LogoMark).
 *   • on mouse-enter ..... the "C" is replaced by a PanelLeftOpen icon AND
 *                           the button's background becomes transparent so
 *                           ONLY the Expand icon is visible with no box
 *                           behind it. The icon color switches to
 *                           muted-foreground (gray) so it stays visible
 *                           against the transparent/page bg in both Light
 *                           and Dark mode.
 *   • on mouse-leave ..... restores the "C" logo mark AND its bg-primary box.
 *   • click ............. calls toggleSidebar (existing functionality, unchanged).
 *
 * Background is removed ONLY from the temporary Expand-icon state; the
 * normal logo (at rest) keeps its bg-primary background exactly as-is.
 *
 * Implementation: React state (useState + onMouseEnter/onMouseLeave) — NOT
 * CSS :hover / group-hover variants. This is deliberate: Tailwind v4 wraps
 * its hover:/group-hover: utilities inside @media (hover: hover), so on
 * any browser that reports (hover: none) (headless, touch, some preview
 * iframes) those utilities NEVER activate and the swap + bg-transparent
 * would silently fail. React mouse events fire on ANY pointer input
 * regardless of the hover media query, so the behavior is identical in
 * every environment. The conditional className + conditional render swap
 * the bg/color/glyph atomically per state. Works in both Light and Dark.
 */
function CollapsedLogoButton() {
  const { toggleSidebar } = useSidebar();
  // Local hover state drives the logo↔Expand-icon swap AND the per-state
  // background/color. Using React state (not CSS :hover / group-hover)
  // guarantees the swap works in ALL environments — including browsers
  // that report (hover: none), where Tailwind's @media (hover: hover)-
  // gated hover:/group-hover: variants would never activate.
  const [hovered, setHovered] = useState(false);
  return (
    /* Hover-only "Expand" tooltip: instant (provider delayDuration=0),
       appears on mouse-enter, disappears on mouse-leave. Radix closes it
       on any pointer exit — disableHoverableContent guarantees it can
       never linger or trap the pointer. */
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Expand sidebar"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={cn(
            'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg font-bold text-sm outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring select-none',
            // NORMAL LOGO STATE (at rest): bg-primary black box +
            // text-primary-foreground white "C" — background UNCHANGED,
            // same as the expanded LogoMark.
            // EXPAND-ICON STATE (on hover): bg-transparent (NO background)
            // + text-muted-foreground gray icon — ONLY this temporary
            // state loses the background. The icon stays visible (gray
            // on transparent/page bg) in both Light and Dark mode.
            hovered
              ? 'bg-transparent text-muted-foreground'
              : 'bg-primary text-primary-foreground',
          )}
        >
          {/* Conditional render: "C" logo at rest, PanelLeftOpen icon on
              hover. h-4 w-4 matches the CollapseToggle's PanelLeftClose
              icon size; the icon is the visual opposite of the collapse
              icon so the collapsed logo reads as a clear "expand"
              affordance when the pointer is over it. */}
          {hovered ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <span>C</span>
          )}
          <span className="sr-only">Expand sidebar</span>
        </button>
      </TooltipTrigger>
      {/* Collapsed-rail tooltip — uses the SHARED COLLAPSED_TOOLTIP_PROPS
          constant so the "Expand" label has IDENTICAL positioning (side,
          align, sideOffset, collisionPadding) to every other collapsed-
          rail tooltip (ThemeToggle, SimpleNavItem, ExpandableNavItem,
          CollapsedParentNavItem). Portal-based rendering means the bubble
          floats outside the sidebar DOM at z-50 — never clipped by the
          rail's overflow-hidden. */}
      <TooltipContent {...COLLAPSED_TOOLTIP_PROPS}>Expand</TooltipContent>
    </Tooltip>
  );
}

/**
 * Collapse/expand control that lives INSIDE the sidebar header (original
 * position, restored) — at the far right of the [logo][title] row, with
 * the Search icon directly to its LEFT (per instruction).
 * The C logo (collapsed rail) and the invisible SidebarRail edge strip
 * keep their existing toggle behavior too.
 */
function CollapseToggle({ side = 'right' }: { side?: 'left' | 'right' }) {
  const { toggleSidebar } = useSidebar();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-md"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>Collapse</TooltipContent>
    </Tooltip>
  );
}

// This custom component uses CSS grid for smooth open/close animation.
// It conditionally renders children so closed sections occupy ZERO layout space.

function AccordionSubmenu({
  isOpen,
  children,
  sectionLabel,
}: {
  isOpen: boolean;
  children: React.ReactNode;
  sectionLabel: string;
}) {
  const contentId = `submenu-${sectionLabel.toLowerCase().replace(/\s+/g, '-')}`;

  if (!isOpen) {
    return null;
  }

  return (
    <SidebarMenuSub id={contentId}>
      {children}
    </SidebarMenuSub>
  );
}

// -------------------- Nav Item Renderers --------------------

/*
 * STATE RULE (decoupled by design):
 *   • Inline submenu visibility  → controlled ONLY by openSection/onToggle
 *     in AppSidebar (route-derived or user-toggled while expanded).
 *   • Floating popover           → local state per item, ONLY used when the
 *     rail is collapsed. It never expands the rail and is fully independent.
 * Nothing here maps settingsExpanded ⇒ sidebarCollapsed (forbidden coupling).
 */
function useCollapsedRail(): boolean {
  const { state, isMobile } = useSidebar();
  return !isMobile && state === 'collapsed';
}

/**
 * Settings parent item rendered on the COLLAPSED 48px rail.
 * Clicking it opens a portal-based popover to the RIGHT of the icon —
 * the sidebar itself NEVER expands, and the popover anchors to this
 * exact button so the "star/sparkle alignment" grid stays intact.
 */
function CollapsedParentNavItem({
  item,
  currentModule,
  currentSubPage,
}: {
  item: NavItem;
  currentModule: string;
  currentSubPage: string | null;
}) {
  const [floatOpen, setFloatOpen] = useState(false);
  const mod = hrefToModule(item.href);
  const isActive = currentModule === mod;

  const handleChildNavigate = (
    e: React.MouseEvent<HTMLAnchorElement>,
    child: NavItem,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setFloatOpen(false); // close the floating submenu after navigation…
    // …but do NOT touch sidebar expansion state (rule #7).
    const hash = child.href.replace(/^#/, '');
    const parts = hash.split('/');
    const childSubPage = parts[1] || null;
    useNavigationStore.getState().navigate(parts[0], null, childSubPage);
  };

  return (
    <SidebarMenuItem>
      <Popover open={floatOpen} onOpenChange={setFloatOpen}>
        <PopoverTrigger asChild>
          <SidebarMenuButton
            isActive={isActive || floatOpen}
            aria-expanded={floatOpen}
            aria-haspopup="menu"
            // Collapsed-rail tooltip — uses the SHARED COLLAPSED_TOOLTIP_PROPS
            // so the parent item's label has IDENTICAL positioning (side,
            // align, sideOffset, collisionPadding) to every other collapsed-
            // rail tooltip (CollapsedLogoButton, ThemeToggle, SimpleNavItem,
            // ExpandableNavItem). Suppressed when the popover is open so the
            // floating submenu never visually conflicts with a lingering
            // label bubble. Portal-based rendering means the bubble floats
            // outside the sidebar DOM at z-50 — never clipped by the rail's
            // overflow-hidden.
            tooltip={
              floatOpen
                ? undefined
                : { ...COLLAPSED_TOOLTIP_PROPS, children: item.label }
            }
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              setFloatOpen((o) => !o);
            }}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </PopoverTrigger>
        {/* Portal → document.body: immune to sidebar overflow clipping.
            Radix handles Esc + outside-click closing and re-anchors at any
            viewport size/zoom via avoidCollisions. */}
        <PopoverContent
          side="right"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="w-56 rounded-md border bg-popover p-1.5 shadow-md"
          onEscapeKeyDown={() => setFloatOpen(false)}
        >
          <ul
            role="menu"
            aria-label={`${item.label} submenu`}
            className="flex min-w-0 list-none flex-col gap-0.5 p-0 m-0"
          >
            {item.children!.map((child) => {
              const hash = child.href.replace(/^#/, '');
              const parts = hash.split('/');
              const childSubPage = parts[1] || null;
              const isChildActive =
                currentModule === parts[0] &&
                (!childSubPage || currentSubPage === childSubPage);
              return (
                <SidebarMenuSubItem key={child.label} className="list-none p-0">
                  <SidebarMenuSubButton asChild isActive={isChildActive}>
                    <a
                      href={child.href}
                      role="menuitem"
                      onClick={(e) => handleChildNavigate(e, child)}
                    >
                      <NavIcon name={child.icon} />
                      <span>{child.label}</span>
                    </a>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}

function ExpandableNavItem({
  item,
  currentModule,
  currentSubPage,
  isExpanded,
  onToggle,
}: {
  item: NavItem;
  currentModule: string;
  currentSubPage: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const mod = hrefToModule(item.href);
  const isActive = currentModule === mod;
  const sectionId = `submenu-${item.label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        // Expandable parent item rendered in EXPANDED state. SidebarMenuButton
        // hides its tooltip whenever state!=="collapsed" (see ui/sidebar.tsx),
        // so this label never shows while expanded — but passing the SAME
        // COLLAPSED_TOOLTIP_PROPS object as every other nav-item renderer
        // keeps the prop consistent across the codebase. If the sidebar
        // toggles between expanded and collapsed while this row stays
        // mounted, the tooltip that appears is identical in positioning to
        // SimpleNavItem / CollapsedParentNavItem / CollapsedLogoButton.
        tooltip={{ ...COLLAPSED_TOOLTIP_PROPS, children: item.label }}
        isActive={isActive}
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          onToggle();
        }}
        aria-expanded={isExpanded}
        aria-controls={sectionId}
      >
        <NavIcon name={item.icon} />
        <span>{item.label}</span>
        <ChevronRight
          className={cn(
            'ml-auto h-4 w-4 shrink-0 transition-transform duration-200',
            isExpanded && 'rotate-90',
          )}
        />
      </SidebarMenuButton>

      {item.badge != null && (
        <SidebarMenuBadge>
          {item.badge}
        </SidebarMenuBadge>
      )}

      <AccordionSubmenu isOpen={isExpanded} sectionLabel={item.label}>
        {item.children!.map((child) => {
          const hash = child.href.replace(/^#/, '');
          const parts = hash.split('/');
          const childMod = parts[0];
          const childSubPage = parts[1] || null;
          const isChildActive =
            currentModule === childMod &&
            (!childSubPage || currentSubPage === childSubPage);

          return (
            <SidebarMenuSubItem key={child.label}>
              <SidebarMenuSubButton
                asChild
                isActive={isChildActive}
              >
                <a
                  href={child.href}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    useNavigationStore
                      .getState()
                      .navigate(childMod, null, childSubPage);
                  }}
                >
                  <NavIcon name={child.icon} />
                  <span>{child.label}</span>
                </a>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          );
        })}
      </AccordionSubmenu>
    </SidebarMenuItem>
  );
}

function SimpleNavItem({
  item,
  currentModule,
}: {
  item: NavItem;
  currentModule: string;
}) {
  const mod = hrefToModule(item.href);
  const isActive = currentModule === mod;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        // Collapsed-rail tooltip — uses the SHARED COLLAPSED_TOOLTIP_PROPS
        // so every leaf nav item (Dashboard, Articles, Calendar, Media,
        // Users, Comments, Newsletter, SEO, AI, Automation) shows its label
        // to the RIGHT of the 48px collapsed rail with IDENTICAL positioning
        // (side, align, sideOffset, collisionPadding) to every other
        // collapsed-rail tooltip (CollapsedLogoButton, ThemeToggle,
        // ExpandableNavItem, CollapsedParentNavItem). Portal-based rendering
        // means the bubble floats outside the sidebar DOM at z-50 — never
        // clipped by the rail's overflow-hidden.
        tooltip={{ ...COLLAPSED_TOOLTIP_PROPS, children: item.label }}
      >
        <a
          href={item.href}
          onClick={(e) => {
            e.preventDefault();
            useNavigationStore.getState().navigate(mod);
          }}
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </a>
      </SidebarMenuButton>

      {item.badge != null && (
        <SidebarMenuBadge>
          {item.badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

// -------------------- NavGroupSection --------------------

function NavGroupSection({
  group,
  currentModule,
  currentSubPage,
  openSection,
  onToggleSection,
}: {
  group: NavGroup;
  currentModule: string;
  currentSubPage: string | null;
  openSection: string | null;
  onToggleSection: (label: string) => void;
}) {
  const isCollapsedRail = useCollapsedRail();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const hasChildren = item.children && item.children.length > 0;

            if (hasChildren && isCollapsedRail) {
              /* Collapsed rail → parents with children become floating
                 popovers anchored to their own icon. The rail NEVER
                 auto-expands (#4/#5/#6). */
              return (
                <CollapsedParentNavItem
                  key={item.label}
                  item={item}
                  currentModule={currentModule}
                  currentSubPage={currentSubPage}
                />
              );
            }

            if (hasChildren) {
              return (
                <ExpandableNavItem
                  key={item.label}
                  item={item}
                  currentModule={currentModule}
                  currentSubPage={currentSubPage}
                  isExpanded={openSection === item.label}
                  onToggle={() => onToggleSection(item.label)}
                />
              );
            }

            return (
              <SimpleNavItem
                key={item.label}
                item={item}
                currentModule={currentModule}
              />
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// -------------------- Main Sidebar Component --------------------

export function AppSidebar() {
  const user = useAuthStore((s) => s.user);
  // Active plan — the footer role badge shows the plan NAME (e.g. "Beta")
  // instead of the static user role, styled with the plan's amber accent.
  const { currentPlan } = useSubscriptionStore();
  const currentModule = useNavigationStore((s) => s.currentModule);
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const openCommandPalette = useCommandPaletteStore((s) => s.open);
  // Sidebar context hook — MUST run before any early return.
  const sidebarCtx = useSidebar();

  const userRole = user?.role;
  const pagePermissions = user?.pagePermissions ?? null;
  const visibleItems = useMemo(() => {
    if (!userRole) return [];
    return getVisibleNavItems(userRole, NAV_ITEMS, pagePermissions);
  }, [userRole, pagePermissions]);

  /*
   * SINGLE SOURCE OF TRUTH for the expanded top-level section.
   *
   * manualOverride is a tri-state:
   *   null  → not overridden; use route-derived value
   *   ""   → explicitly closed by user
   *   "SEO" → explicitly opened by user
   *
   * When the module changes (navigation event), we reset manualOverride
   * to null so the route-derived value takes over.
   */
  const [manualOverride, setManualOverride] = useState<string | null>(null);
  // Track previous module to detect navigation changes synchronously during render.
  // This is the React-approved pattern for "derived state from props".
  const [prevModule, setPrevModule] = useState(currentModule);
  if (currentModule !== prevModule) {
    setPrevModule(currentModule);
    setManualOverride(null);
  }

  // Derive the section from the current route hash (EXPLICIT prefix matching)
  const routeDerivedSection = useMemo(() => {
    return getSectionFromHash(window.location.hash);
  }, [currentModule, currentSubPage]);

  // Compute the actual open section
  const openSection = useMemo(() => {
    if (manualOverride !== null) {
      // User manually toggled: empty string = closed, non-empty = that section
      return manualOverride || null;
    }
    return routeDerivedSection;
  }, [manualOverride, routeDerivedSection]);

  // Toggle a section open/closed
  const handleToggleSection = useCallback(
    (label: string) => {
      setManualOverride((prev) => {
        // Determine what's currently open (considering route-derived if no override)
        const currentlyOpen =
          prev !== null ? (prev || null) : routeDerivedSection;
        // If clicking the same section that's open, close it
        if (currentlyOpen === label) {
          return ''; // explicitly closed
        }
        // Otherwise, open the clicked section (closing any other)
        return label;
      });
    },
    [routeDerivedSection],
  );

  if (!user) return null;

  const groups = buildNavGroups(visibleItems);

  return (
    <Sidebar collapsible="icon">
      {/* ---- Header: one 32px icon cell per row, all centered at x=24px ---- */}
      <SidebarHeader className="px-2 py-3 shrink-0">
        {/* Expanded: [logo][title][…spacer…][Search][Collapse toggle].
            Per instruction the Search icon sits directly NEXT TO the
            Collapse toggle at the far right — NOT next to the "CMS Admin"
            name (the old position was removed, never duplicated). */}
        <div className="flex h-8 items-center gap-2 group-data-[collapsible=icon]:hidden">
          <LogoMark />
          <span className="truncate font-semibold text-sm tracking-tight whitespace-nowrap text-text-primary">
            CMS Admin
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-md"
                  onClick={openCommandPalette}
                  aria-label="Search"
                >
                  <Search className="h-4 w-4" />
                  <span className="sr-only">Search</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search</TooltipContent>
            </Tooltip>
            <CollapseToggle side="bottom" />
          </div>
        </div>
        {/* Collapsed rail: ONLY the "C" logo. The previously stacked
            collapse-toggle icon was removed on purpose — no extra icon may
            appear under/next to the logo.
            Expand affordance: the logo cell itself toggles the sidebar
            (same 32px grid cell, same x=24 center-line), and the invisible
            SidebarRail edge strip keeps its native toggle behavior too. */}
        <div className="hidden flex-col items-center group-data-[collapsible=icon]:flex">
          <CollapsedLogoButton />
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent className="sidebar-thin-scroll">
        {groups.map((group) => (
          <NavGroupSection
            key={group.label}
            group={group}
            currentModule={currentModule}
            currentSubPage={currentSubPage}
            openSection={openSection}
            onToggleSection={handleToggleSection}
          />
        ))}
      </SidebarContent>

      {/* Bottom separator shows in BOTH states: the collapsed footer now
          carries the Search / Bell / avatar utility cluster, so there is
          real content to separate below it in both modes. */}
      <SidebarSeparator className="mx-0" />

      <SidebarFooter className="shrink-0">
        {/* Expanded: [profile-menu avatar][name/plan-badge][bell].
            The avatar opens the SAME shared UserProfileMenu as the
            collapsed rail and the topbar (single source — identical
            content/styling), so the profile dropdown works consistently
            in BOTH sidebar states. side="top" grows upward from the
            bottom-anchored trigger; Radix collision handling keeps it
            inside the viewport at any height. */}
        <div className="flex items-center gap-3 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <UserProfileMenu side="top" align="start" sideOffset={8} alignOffset={8} collisionPadding={12}>
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 shrink-0 rounded-full"
              aria-label={`${user.name} — open profile menu`}
              aria-haspopup="menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback className="text-xs">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </UserProfileMenu>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium leading-tight">
              {user.name}
            </span>
            {/* Plan badge — SAME shape/size/typography/spacing as the
                previous role badge (h-4, text-[10px], px-1.5, rounded-md,
                mt-0.5, w-fit) but rendered with the active plan's amber
                accent (bg-amber-500 text-white) instead of the generic
                secondary surface. Shows the plan NAME ("Beta") so it stays
                in sync with the PlanBadge used in the topbar avatar trigger
                and the profile dropdown header. */}
            <Badge
              className="mt-0.5 h-4 w-fit text-[10px] px-1.5 bg-amber-500 text-white border-transparent"
            >
              {currentPlan.name}
            </Badge>
          </div>
          {/* Notifications bell — replaces the previous standalone Log out
              button. Uses the SAME NotificationBell component as the
              collapsed rail and the topbar (live unread badge + dropdown
              panel + polling all reused). Positioning props mirror the
              profile dropdown above (side/align/sideOffset/alignOffset/
              collisionPadding) so both dropdowns open upward with the
              same gap from the sidebar's left edge — never flush, never
              clipped. Log out is still reachable via the profile dropdown
              menu (UserProfileMenu above) so no functionality is lost. */}
          <NotificationBell side="top" align="start" sideOffset={8} alignOffset={8} collisionPadding={12} />
        </div>

        {/* Collapsed rail: icon-only utility cluster + bare avatar.
            Order (top → bottom): Theme, Notifications, Profile.
            · Theme    → SAME next-themes state via shared ThemeToggle
            · Bell     → the SAME NotificationBell component (unread badge,
                         dropdown panel and polling all reused verbatim)
            · Avatar   → opens the SAME UserProfileMenu used by the topbar
                         (Profile / Language / Manage Subscription / Log out)
            One 32px cell per row on the shared x=24 center-line. NO name,
            NO email, NO "ADMIN" badge, NO visible logout icon. None of
            these controls expand the sidebar — they render popovers via
            Radix portals instead (#7: independent of sidebarCollapsed).
            While the rail owns these controls the topbar hides them, so
            there is never a duplicate. */}
        <div className="hidden flex-col items-center gap-1 py-1 group-data-[collapsible=icon]:flex">
          {/* Theme toggle — shared component, same theme state as header */}
          <ThemeToggle withTooltip />

          {/* Collapsed-rail notification bell — icon-only trigger, live
              badge. Positioning MIRRORS the collapsed-rail profile menu
              directly below (same side / align / sideOffset /
              collisionPadding) so both dropdowns behave identically:
                side="right"          → opens to the RIGHT of the 48px rail,
                                       fully inside the main viewport
                align="end"           → dropdown's bottom aligns with the
                                       bell's bottom, so it grows UPWARD
                                       (Radix collision handling flips /
                                       shifts it if it would otherwise clip
                                       the top of the viewport)
                sideOffset=16         → visible ~8px GAP from the rail's
                                       right edge (trigger is centered in the
                                       48px rail → right edge ~x=40, rail
                                       right edge ~x=48, dropdown left edge
                                       ~x=56 → 8px gap)
                collisionPadding=12   → 12px viewport collision padding so
                                       the 320px-wide panel can never touch
                                       the viewport edges or get clipped
              The expanded-state positioning (side="top" align="start"
              sideOffset=8 alignOffset=8 collisionPadding=12 above) is NOT
              touched — only the collapsed rail is fixed here. */}
          <NotificationBell
            side="right"
            align="end"
            sideOffset={16}
            collisionPadding={12}
            withTooltip
          />

          {/* Collapsed-rail avatar — tapping it opens the shared profile
              menu. Positioning is IDENTICAL to the collapsed-rail
              NotificationBell directly above (same side / align /
              sideOffset / collisionPadding) so both dropdowns behave
              identically:
                side="right"          → opens to the RIGHT of the 48px rail,
                                       fully inside the main viewport (never
                                       touches the left edge / never opens
                                       outside the viewport)
                align="end"           → menu's bottom aligns with the
                                       avatar's bottom, so it grows UPWARD
                                       from the bottom-corner trigger (Radix
                                       collision handling flips / shifts it
                                       if it would otherwise clip the top of
                                       the viewport)
                sideOffset=16         → visible ~8px GAP from the rail's
                                       right edge (avatar right edge ~x=40,
                                       rail right edge ~x=48, menu left edge
                                       ~x=56 → 8px gap; matches the bell)
                collisionPadding=12   → 12px viewport collision padding so
                                       the 224px-wide menu can never touch
                                       the viewport edges or get clipped
              The sidebar itself never expands; outside click / Esc close
              it (Radix portal, z-50). The expanded-state positioning
              (side="top" align="start" sideOffset=8 alignOffset=8
              collisionPadding=12 above) is NOT touched — only the collapsed
              rail is fixed here. Works identically in Light + Dark mode
              (all colors come from theme tokens). */}
          <UserProfileMenu
            side="right"
            align="end"
            sideOffset={16}
            collisionPadding={12}
            withTooltip
          >
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 shrink-0 rounded-full"
              aria-label={`${user.name} — open profile menu`}
              aria-haspopup="menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback className="text-xs">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </UserProfileMenu>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
