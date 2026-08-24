'use client';

import React, { createElement, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  LogOut,
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
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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

// -------------------- Collapsible Submenu (NO Radix) --------------------
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
        tooltip={item.label}
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
        tooltip={item.label}
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
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const hasChildren = item.children && item.children.length > 0;

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
  const logout = useAuthStore((s) => s.logout);
  const currentModule = useNavigationStore((s) => s.currentModule);
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);

  const userRole = user?.role;
  const visibleItems = useMemo(() => {
    if (!userRole) return [];
    return getVisibleNavItems(userRole, NAV_ITEMS);
  }, [userRole]);

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
      <SidebarHeader className="px-4 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            C
          </div>
          <motion.span
            className="font-semibold text-sm tracking-tight whitespace-nowrap group-data-[collapsible=icon]:hidden"
            initial={{ opacity: 1, width: 'auto' }}
            animate={{ opacity: 1 }}
          >
            CMS Admin
          </motion.span>
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

      <SidebarSeparator className="mx-0" />

      <SidebarFooter className="shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
            <AvatarFallback className="text-xs">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium leading-tight">
              {user.name}
            </span>
            <Badge variant="secondary" className="mt-0.5 h-4 w-fit text-[10px] px-1.5">
              {user.role.replace(/_/g, ' ')}
            </Badge>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => void logout()}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Log out</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Log out</TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
