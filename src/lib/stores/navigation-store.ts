'use client';

import { create } from 'zustand';

// -------------------- Types --------------------

interface NavigationState {
  currentModule: string;
  currentItemId: string | null;
  currentSubPage: string | null;

  navigate: (mod: string, itemId?: string | null, subPage?: string | null) => void;
  readFromHash: () => void;
}

/**
 * Parse a hash string like "#content", "#content/cm2x123", "#content/new"
 * into { mod, itemId, subPage }.
 */
function parseHash(hash: string): {
  mod: string;
  itemId: string | null;
  subPage: string | null;
} {
  // Strip leading #
  const path = hash.replace(/^#\/?/, '') || 'dashboard';
  const segments = path.split('/');

  const mod = segments[0] || 'dashboard';
  const second = segments[1] ?? null;

  // All known sub-page keywords across ALL modules.
  // IMPORTANT: Settings has children named 'seo', 'api', 'media', 'ai', etc.
  // These MUST be recognized as sub-pages so they are NOT treated as item IDs.
  const SUB_PAGE_KEYWORDS = new Set([
    // Content
    'create', 'edit', 'versions', 'translations', 'preview',
    // SEO
    'redirects', 'sitemap', 'robots', 'search-console', 'indexing', 'broken-links',
    'social-preview', 'schema', 'canonicals', 'internal-links', 'audit', 'settings',
    // Email Templates
    'smtp-settings',
    // AI
    'providers', 'prompts', 'models', 'playground', 'jobs', 'usage', 'marketplace',
    // Backups
    'backups', 'schedules', 'restore', 'storage', 'logs',
    // Automation
    'create', 'edit', 'details', 'runs', 'generate',
    // Newsletter
    'subscribers', 'campaigns', 'collections',
    // Media
    'folders',
    // Settings — ALL children must be here
    'settings', 'general', 'localization', 'reading', 'discussion',
    'seo', 'media', 'search', 'email', 'security', 'api', 'ai', 'cache',
    'maintenance', 'multi-site', 'import-export', 'advanced', 'smtp',
    // Audit
    'audit',
  ]);

  // Compound "settings/<tab>" sub-pages (e.g. SEO "settings/robots") — preserve
  // the full compound key so the route is reachable via hash/refresh. Without
  // this, "#seo/settings/robots" collapses to subPage="settings" (Sitemap tab),
  // so the Robots tab would never load on direct-URL navigation.
  if (second && second.toLowerCase() === 'settings' && segments[2]) {
    const SETTINGS_SUBTABS = new Set(['sitemap', 'robots', 'redirects']);
    const subTab = segments[2].toLowerCase();
    if (SETTINGS_SUBTABS.has(subTab)) {
      return { mod, itemId: null, subPage: `settings/${subTab}` };
    }
  }

  if (second && SUB_PAGE_KEYWORDS.has(second.toLowerCase())) {
    return { mod, itemId: null, subPage: second.toLowerCase() };
  }

  // Otherwise second segment is an item ID, third is sub-page
  const itemId = second;
  const subPage = segments[2] ? segments[2].toLowerCase() : null;

  return { mod, itemId, subPage };
}

/**
 * Build a hash string from navigation state.
 */
function buildHash(mod: string, itemId?: string | null, subPage?: string | null): string {
  if (!mod || mod === 'dashboard') return '#';

  if (subPage && !itemId) {
    return `#${mod}/${subPage}`;
  }

  if (itemId && subPage) {
    return `#${mod}/${itemId}/${subPage}`;
  }

  if (itemId) {
    return `#${mod}/${itemId}`;
  }

  return `#${mod}`;
}

// -------------------- Initial State --------------------

const initialState = parseHash(
  typeof window !== 'undefined' ? window.location.hash : '#'
);

// -------------------- Store --------------------

export const useNavigationStore = create<NavigationState>((set) => ({
  currentModule: initialState.mod,
  currentItemId: initialState.itemId,
  currentSubPage: initialState.subPage,

  navigate: (mod, itemId = null, subPage = null) => {
    set({
      currentModule: mod,
      currentItemId: itemId,
      currentSubPage: subPage,
    });

    // Update browser hash without triggering a page reload
    const hash = buildHash(mod, itemId, subPage);
    window.history.replaceState(null, '', hash);
  },

  readFromHash: () => {
    const hash = window.location.hash;
    const parsed = parseHash(hash);
    set({
      currentModule: parsed.mod,
      currentItemId: parsed.itemId,
      currentSubPage: parsed.subPage,
    });
  },
}));

// -------------------- Hash Change Listener --------------------

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    const parsed = parseHash(hash);
    useNavigationStore.setState({
      currentModule: parsed.mod,
      currentItemId: parsed.itemId,
      currentSubPage: parsed.subPage,
    });
  });
}
