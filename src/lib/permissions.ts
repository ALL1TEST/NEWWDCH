// ============================================================// PERMISSION SYSTEM — Enterprise CMS Admin Dashboard// ============================================================

import type { UserRole, Permission, NavItem } from '@/shared/types';
import { ROLE_HIERARCHY, PERMISSIONS as PERM_CONST } from '@/shared/constants';

// -------------------- Role Hierarchy Check --------------------

/**
 * Returns true if `userRole` meets or exceeds `requiredRole` in the hierarchy.
 * SUPER_ADMIN > ADMIN > EDITOR > AUTHOR > CONTRIBUTOR
 */
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
  if (userLevel === -1 || requiredLevel === -1) return false;
  return userLevel <= requiredLevel;
}

// -------------------- Permission Map --------------------

/**
 * Maps each role to the set of permissions it grants.
 * Higher roles inherit all permissions from roles below them.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    ...Object.values(PERM_CONST.content),
    ...Object.values(PERM_CONST.media),
    ...Object.values(PERM_CONST.users),
    ...Object.values(PERM_CONST.categories),
    ...Object.values(PERM_CONST.tags),
    ...Object.values(PERM_CONST.comments),
    ...Object.values(PERM_CONST.newsletters),
    ...Object.values(PERM_CONST.seo),
    ...Object.values(PERM_CONST.analytics),
    ...Object.values(PERM_CONST.notifications),
    ...Object.values(PERM_CONST.ai),
    ...Object.values(PERM_CONST.settings),
    ...Object.values(PERM_CONST.security),
    ...Object.values(PERM_CONST.backups),
    ...Object.values(PERM_CONST.emailTemplates),
  ],
  ADMIN: [
    ...Object.values(PERM_CONST.content),
    ...Object.values(PERM_CONST.media),
    ...Object.values(PERM_CONST.users),
    ...Object.values(PERM_CONST.categories),
    ...Object.values(PERM_CONST.tags),
    ...Object.values(PERM_CONST.comments),
    ...Object.values(PERM_CONST.newsletters),
    ...Object.values(PERM_CONST.seo),
    ...Object.values(PERM_CONST.analytics),
    ...Object.values(PERM_CONST.notifications),
    ...Object.values(PERM_CONST.ai),
    ...Object.values(PERM_CONST.settings),
    ...Object.values(PERM_CONST.security),
    ...Object.values(PERM_CONST.backups),
    ...Object.values(PERM_CONST.emailTemplates),
  ],
  EDITOR: [
    PERM_CONST.content.create,
    PERM_CONST.content.read,
    PERM_CONST.content.update,
    PERM_CONST.content.publish,
    PERM_CONST.content.review,
    PERM_CONST.content.translate,
    ...Object.values(PERM_CONST.media),
    PERM_CONST.categories.create,
    PERM_CONST.categories.read,
    PERM_CONST.categories.update,
    PERM_CONST.tags.create,
    PERM_CONST.tags.read,
    PERM_CONST.tags.update,
    PERM_CONST.comments.read,
    PERM_CONST.comments.update,
    PERM_CONST.comments.moderate,
    PERM_CONST.seo.read,
    PERM_CONST.seo.update,
    PERM_CONST.analytics.read,
    PERM_CONST.notifications.read,
    PERM_CONST.notifications.update,
    PERM_CONST.ai.read,
    PERM_CONST.ai.use,
  ],
  AUTHOR: [
    PERM_CONST.content.create,
    PERM_CONST.content.read,
    PERM_CONST.content.update,
    ...Object.values(PERM_CONST.media),
    PERM_CONST.categories.read,
    PERM_CONST.tags.read,
    PERM_CONST.comments.read,
    PERM_CONST.analytics.read,
    PERM_CONST.notifications.read,
    PERM_CONST.ai.read,
    PERM_CONST.ai.use,
  ],
  CONTRIBUTOR: [
    PERM_CONST.content.create,
    PERM_CONST.content.read,
    PERM_CONST.media.read,
    PERM_CONST.categories.read,
    PERM_CONST.tags.read,
    PERM_CONST.comments.read,
    PERM_CONST.notifications.read,
  ],
};

// Build a flat set for O(1) lookups
const PERMISSION_SETS: Record<UserRole, Set<string>> = Object.fromEntries(
  Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => [role, new Set(perms)]),
) as Record<UserRole, Set<string>>;

// -------------------- can() --------------------

/**
 * Check whether a user with the given role has a specific permission.
 */
export function can(userRole: UserRole, permission: Permission): boolean {
  return PERMISSION_SETS[userRole]?.has(permission) ?? false;
}

/**
 * Check whether a user with the given role has ANY of the listed permissions.
 */
export function canAny(userRole: UserRole, permissions: Permission[]): boolean {
  const set = PERMISSION_SETS[userRole];
  if (!set) return false;
  return permissions.some((p) => set.has(p));
}

/**
 * Check whether a user with the given role has ALL of the listed permissions.
 */
export function canAll(userRole: UserRole, permissions: Permission[]): boolean {
  const set = PERMISSION_SETS[userRole];
  if (!set) return false;
  return permissions.every((p) => set.has(p));
}

// -------------------- Navigation Filtering --------------------

/**
 * Filter navigation items based on the user's role.
 * Removes items the user has no access to, including nested children.
 */
export function getVisibleNavItems(userRole: UserRole, allItems: NavItem[]): NavItem[] {
  return allItems.reduce<NavItem[]>((visible, item) => {
    // Skip separators if there's nothing before them
    if (item.isSeparator) {
      if (visible.length > 0) {
        visible.push(item);
      }
      return visible;
    }

    // Check role requirement
    if (item.requiredRole && !hasPermission(userRole, item.requiredRole)) {
      return visible;
    }

    // Check permission requirement
    if (item.requiredPermission && !can(userRole, item.requiredPermission)) {
      return visible;
    }

    // Recursively filter children
    const filteredChildren = item.children
      ? getVisibleNavItems(userRole, item.children)
      : undefined;

    // If this item had children but all were filtered out, skip the parent
    if (item.children && item.children.length > 0 && filteredChildren && filteredChildren.length === 0) {
      return visible;
    }

    visible.push({
      ...item,
      children: filteredChildren,
    });

    return visible;
  }, []);
}
