// ============================================================
// PERMISSION SYSTEM — Simplified CMS Admin Dashboard
// ============================================================
// Two roles: ADMIN (full access) and EDITOR (limited to the
// pages in their `pagePermissions` array). Custom permissions
// (created via /api/custom-permissions) are referenced by their
// generated key in the same `pagePermissions` array.
// ============================================================

import type { UserRole, NavItem } from '@/shared/types';

// -------------------- Built-in CMS Pages --------------------

export const BUILTIN_PAGES = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { key: 'calendar', label: 'Calendar', icon: 'Calendar' },
  { key: 'content', label: 'Articles', icon: 'FileText' },
  { key: 'media', label: 'Media', icon: 'Image' },
  { key: 'users', label: 'Users', icon: 'Users' },
  { key: 'comments', label: 'Comments', icon: 'MessageSquare' },
  { key: 'newsletter', label: 'Newsletter', icon: 'Mail' },
  { key: 'seo', label: 'SEO', icon: 'Search' },
  { key: 'ai', label: 'AI', icon: 'Sparkles' },
  { key: 'automation', label: 'Automation', icon: 'Workflow' },
  { key: 'settings', label: 'Settings', icon: 'Settings' },
] as const;

// -------------------- Platform Admin Pages --------------------
// The PLATFORM_ADMIN role sees these pages instead of the client
// CMS pages. They are platform-level management screens.

export const PLATFORM_PAGES = [
  { key: 'platform-overview', label: 'Overview', icon: 'LayoutDashboard' },
  { key: 'platform-customers', label: 'Customers', icon: 'Users' },
  { key: 'platform-sites', label: 'Sites', icon: 'Globe' },
  { key: 'platform-subscriptions', label: 'Subscriptions', icon: 'CreditCard' },
  { key: 'platform-payments', label: 'Payments', icon: 'Receipt' },
  { key: 'platform-usage', label: 'Usage / Analytics', icon: 'BarChart3' },
  { key: 'platform-system-health', label: 'System Health', icon: 'HeartPulse' },
  { key: 'platform-audit', label: 'Activity / Audit Log', icon: 'ScrollText' },
  { key: 'platform-settings', label: 'Settings', icon: 'Settings' },
] as const;

export function isPlatformPage(pageKey: string): boolean {
  return pageKey.startsWith('platform-');
}

// -------------------- Settings Sub-pages --------------------

export const SETTINGS_SUBPAGES = [
  { key: 'email-templates', label: 'Email Templates', parent: 'settings' },
  { key: 'smtp', label: 'SMTP Settings', parent: 'settings' },
  { key: 'notifications', label: 'Notifications', parent: 'settings' },
  { key: 'backups', label: 'Backups', parent: 'settings' },
] as const;

// -------------------- Custom Permission key helper --------------------

/**
 * Convert a custom permission name (e.g. "Manage Authors")
 * into the key that gets stored in user.pagePermissions
 * (e.g. "manage-authors").
 */
export function customPermissionKeyFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// -------------------- Page Access Helpers --------------------

/**
 * Check whether a user with the given role + pagePermissions array
 * is allowed to access the page identified by `pageKey`.
 *
 * PLATFORM_ADMIN: may access platform-* pages only.
 * ADMIN: full access to all built-in CMS + settings pages; may NOT
 *        access platform-* pages (that's a different experience).
 * EDITOR: only pages in their pagePermissions array.
 */
export function canAccessPage(
  role: string,
  pagePermissions: string[] | null | undefined,
  pageKey: string,
): boolean {
  // PLATFORM_ADMIN sees only the Platform Admin experience.
  if (role === 'PLATFORM_ADMIN') {
    return isPlatformPage(pageKey);
  }

  // Client roles must never reach platform pages.
  if (isPlatformPage(pageKey)) return false;

  // ADMIN always has full access to the client CMS.
  if (role === 'ADMIN') return true;

  // EDITOR: check pagePermissions
  if (role === 'EDITOR') {
    if (!pagePermissions || pagePermissions.length === 0) return false;

    // If they have 'settings', they can access all settings sub-pages
    if (pagePermissions.includes('settings')) {
      const subpage = SETTINGS_SUBPAGES.find((s) => s.key === pageKey);
      if (subpage) return true;
    }
    return pagePermissions.includes(pageKey);
  }
  return false;
}

/**
 * Return the full list of page keys a user can access.
 */
export function getAccessiblePages(
  role: string,
  pagePermissions: string[] | null | undefined,
): string[] {
  if (role === 'PLATFORM_ADMIN') {
    return PLATFORM_PAGES.map((p) => p.key);
  }
  if (role === 'ADMIN') {
    return [
      ...BUILTIN_PAGES.map((p) => p.key),
      ...SETTINGS_SUBPAGES.map((s) => s.key),
    ];
  }
  if (role === 'EDITOR' && pagePermissions && pagePermissions.length > 0) {
    let pages = [...pagePermissions];
    if (pages.includes('settings')) {
      pages = [...pages, ...SETTINGS_SUBPAGES.map((s) => s.key)];
    }
    return Array.from(new Set(pages));
  }
  return [];
}

// -------------------- JSON Serialization Helpers --------------------

export function parsePagePermissions(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed as string[];
    }
    return null;
  } catch {
    return null;
  }
}

export function serializePagePermissions(pages: string[] | null | undefined): string | null {
  if (!pages || pages.length === 0) return null;
  return JSON.stringify(Array.from(new Set(pages)));
}

// -------------------- Legacy API: hasPermission --------------------
// Kept for backward compat with sidebar nav items that use `requiredRole`.
// ADMIN meets any requirement; EDITOR meets EDITOR but not ADMIN.

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  if (userRole === 'ADMIN') return true;
  if (userRole === 'EDITOR') return requiredRole === 'EDITOR';
  return false;
}

// -------------------- Navigation Filtering --------------------

/**
 * Derive the page key from a hash href like "#content" or "#settings/smtp".
 * Returns "dashboard" for "#", "content" for "#content", etc.
 */
function hrefToPageKey(href: string): string {
  const hash = href.replace(/^#/, '');
  if (!hash) return 'dashboard';
  return hash.split('/')[0];
}

/**
 * Filter navigation items based on the user's role + pagePermissions.
 * - ADMIN: sees all items
 * - EDITOR: sees only items whose page key is in their pagePermissions,
 *           plus settings sub-pages if 'settings' is included.
 */
export function getVisibleNavItems(
  userRole: UserRole,
  allItems: NavItem[],
  pagePermissions: string[] | null | undefined = null,
): NavItem[] {
  // PLATFORM_ADMIN sees everything passed in (the sidebar passes the
  // platform nav array for this role).
  if (userRole === 'PLATFORM_ADMIN') {
    return allItems.map((item) => ({
      ...item,
      children: item.children ? [...item.children] : undefined,
    }));
  }

  // ADMIN sees everything
  if (userRole === 'ADMIN') {
    return allItems.map((item) => ({
      ...item,
      children: item.children ? [...item.children] : undefined,
    }));
  }

  // EDITOR: filter by pagePermissions
  if (userRole === 'EDITOR') {
    const accessible = pagePermissions ?? [];
    return allItems.reduce<NavItem[]>((visible, item) => {
      // Separators always pass through
      if (item.isSeparator) {
        visible.push(item);
        return visible;
      }

      const pageKey = hrefToPageKey(item.href);

      // Direct match in pagePermissions
      if (accessible.includes(pageKey)) {
        // Recursively filter children (only show accessible sub-pages)
        const filteredChildren = item.children
          ? item.children.filter((child) => {
              const childKey = hrefToPageKey(child.href);
              return accessible.includes(childKey);
            })
          : undefined;

        visible.push({
          ...item,
          children: filteredChildren,
        });
        return visible;
      }

      return visible;
    }, []);
  }

  return [];
}
