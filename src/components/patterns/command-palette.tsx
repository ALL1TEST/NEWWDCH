'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FileText,
  Image,
  Users,
  Tag,
  MessageSquare,
  Mail,
  Search,
  BarChart3,
  Bell,
  Sparkles,
  Settings,
  Shield,
  Database,
  Activity,
  Upload,
  Plus,
  Clock,
  RotateCcw,
  ScrollText,
  Receipt,
  CreditCard,
  Ticket,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useCommandPaletteStore } from '@/lib/stores/command-palette-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getApi } from '@/lib/api-client';
import { formatRelativeTime } from '@/lib/utils';

// -------------------- Types --------------------

interface CommandItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  module: string;
  subPage?: string;
}

interface CommandGroupDef {
  heading: string;
  items: CommandItemDef[];
}

// -------------------- Search result (from API) --------------------

interface CustomerResult {
  id: string; name: string; email: string; planId: string | null;
  status: string | null; link: string; kind: 'customer';
}
interface PaymentResult {
  id: string; invoiceNumber: string | null;
  stripeInvoiceId: string | null; stripePaymentIntentId: string | null;
  stripeChargeId: string | null; customerName: string; customerEmail: string;
  amount: number; currency: string; status: string; link: string; kind: 'payment';
}
interface PlanResult {
  id: string; planId: string; name: string; priceMonthly: number;
  currency: string; isFree: boolean; active: boolean; link: string; kind: 'plan';
}
interface CouponResult {
  id: string; code: string; type: string; value: number; currency: string;
  active: boolean; link: string; kind: 'coupon';
}
interface NotificationResult {
  id: string; title: string; message: string; type: string; isRead: boolean;
  createdAt: string; link: string; kind: 'notification';
}
interface SearchResult {
  customers: CustomerResult[];
  payments: PaymentResult[];
  plans: PlanResult[];
  coupons: CouponResult[];
  notifications: NotificationResult[];
}

// -------------------- Client CMS Navigation Items --------------------

const NAV_ITEMS: CommandItemDef[] = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'G D', module: 'dashboard' },
  { id: 'nav-content', label: 'Content', icon: FileText, shortcut: 'G C', module: 'content' },
  { id: 'nav-media', label: 'Media', icon: Image, shortcut: 'G M', module: 'media' },
  { id: 'nav-users', label: 'Users', icon: Users, shortcut: 'G U', module: 'users' },
  { id: 'nav-categories', label: 'Categories', icon: Tag, module: 'categories' },
  { id: 'nav-tags', label: 'Tags', icon: Tag, module: 'tags' },
  { id: 'nav-comments', label: 'Comments', icon: MessageSquare, module: 'comments' },
  { id: 'nav-newsletters', label: 'Newsletters', icon: Mail, module: 'newsletters' },
  { id: 'nav-seo', label: 'SEO', icon: Search, module: 'seo' },
  { id: 'nav-analytics', label: 'Analytics', icon: BarChart3, module: 'analytics' },
  { id: 'nav-notifications', label: 'Notifications', icon: Bell, module: 'notifications' },
  { id: 'nav-ai', label: 'AI', icon: Sparkles, module: 'ai' },
  { id: 'nav-ai-providers', label: 'AI Providers', icon: Settings, module: 'ai', subPage: 'providers' },
  { id: 'nav-ai-prompts', label: 'Prompt Library', icon: FileText, module: 'ai', subPage: 'prompts' },
  { id: 'nav-ai-playground', label: 'AI Playground', icon: Sparkles, module: 'ai', subPage: 'playground' },
  { id: 'nav-ai-jobs', label: 'AI Jobs', icon: Clock, module: 'ai', subPage: 'jobs' },
  { id: 'nav-backups', label: 'Backups Dashboard', icon: Database, module: 'backups' },
  { id: 'nav-backups-list', label: 'Backups List', icon: Database, module: 'backups', subPage: 'backups' },
  { id: 'nav-backups-schedules', label: 'Backup Schedules', icon: Clock, module: 'backups', subPage: 'schedules' },
  { id: 'nav-backups-restore', label: 'Restore Backup', icon: RotateCcw, module: 'backups', subPage: 'restore' },
  { id: 'nav-backups-storage', label: 'Backup Storage', icon: Database, module: 'backups', subPage: 'storage' },
  { id: 'nav-backups-logs', label: 'Backup Logs', icon: ScrollText, module: 'backups', subPage: 'logs' },
  { id: 'nav-backups-settings', label: 'Backup Settings', icon: Settings, module: 'backups', subPage: 'settings' },
  { id: 'nav-settings', label: 'Settings — General', icon: Settings, module: 'settings', subPage: 'general' },
  { id: 'nav-settings-localization', label: 'Settings — Localization', icon: Settings, module: 'settings', subPage: 'localization' },
  { id: 'nav-settings-reading', label: 'Settings — Reading', icon: Settings, module: 'settings', subPage: 'reading' },
  { id: 'nav-settings-seo', label: 'Settings — SEO', icon: Settings, module: 'settings', subPage: 'seo' },
  { id: 'nav-settings-media', label: 'Settings — Media', icon: Settings, module: 'settings', subPage: 'media' },
  { id: 'nav-settings-email', label: 'Settings — Email (SMTP)', icon: Settings, module: 'settings', subPage: 'email' },
  { id: 'nav-settings-security', label: 'Settings — Security', icon: Settings, module: 'settings', subPage: 'security' },
  { id: 'nav-settings-api', label: 'Settings — API', icon: Settings, module: 'settings', subPage: 'api' },
  { id: 'nav-settings-ai', label: 'Settings — AI', icon: Settings, module: 'settings', subPage: 'ai' },
  { id: 'nav-settings-cache', label: 'Settings — Cache', icon: Settings, module: 'settings', subPage: 'cache' },
  { id: 'nav-settings-performance', label: 'Settings — Performance', icon: Settings, module: 'settings', subPage: 'performance' },
  { id: 'nav-settings-notifications', label: 'Settings — Notifications', icon: Settings, module: 'settings', subPage: 'notifications' },
  { id: 'nav-settings-maintenance', label: 'Settings — Maintenance', icon: Settings, module: 'settings', subPage: 'maintenance' },
  { id: 'nav-settings-advanced', label: 'Settings — Advanced', icon: Settings, module: 'settings', subPage: 'advanced' },
  { id: 'nav-settings-audit', label: 'Settings — Audit Log', icon: Settings, module: 'settings', subPage: 'audit-log' },
  { id: 'nav-settings-import', label: 'Settings — Import/Export', icon: Settings, module: 'settings', subPage: 'import-export' },
  { id: 'nav-security', label: 'Security', icon: Shield, module: 'security' },
  { id: 'nav-jobs', label: 'Jobs', icon: Activity, module: 'jobs' },
];

const ACTION_ITEMS: CommandItemDef[] = [
  { id: 'act-create-content', label: 'Create Content', icon: Plus, shortcut: 'N', module: 'content', subPage: 'create' },
  { id: 'act-upload-media', label: 'Upload Media', icon: Upload, module: 'media' },
  { id: 'act-create-user', label: 'Create User', icon: Plus, module: 'users', subPage: 'create' },
  { id: 'act-create-category', label: 'Create Category', icon: Plus, module: 'categories', subPage: 'create' },
  { id: 'act-create-tag', label: 'Create Tag', icon: Plus, module: 'tags', subPage: 'create' },
];

// -------------------- Platform Admin Navigation Items --------------------
// Shown ONLY when the signed-in user is PLATFORM_ADMIN or OWNER.
// These mirror the platform-admin sidebar (PLATFORM_NAV_ITEMS in
// sidebar.tsx) so the command palette navigates to the same pages
// the sidebar exposes. Each module corresponds to a key in
// platformModuleRegistry.

const PLATFORM_NAV_ITEMS: CommandItemDef[] = [
  { id: 'plat-overview', label: 'Overview', icon: LayoutDashboard, module: 'platform-overview' },
  { id: 'plat-customers', label: 'Customers', icon: Users, module: 'platform-customers' },
  { id: 'plat-payments', label: 'Payments', icon: Receipt, module: 'platform-payments' },
  { id: 'plat-plans', label: 'Plans & Pricing', icon: Tag, module: 'platform-plans' },
  { id: 'plat-coupons', label: 'Coupons', icon: Ticket, module: 'platform-coupons' },
  { id: 'plat-stripe-settings', label: 'Stripe Settings', icon: CreditCard, module: 'platform-stripe-settings' },
  { id: 'plat-notifications', label: 'Notifications', icon: Bell, module: 'platform-notifications' },
  { id: 'plat-email-templates', label: 'Email Templates', icon: Mail, module: 'platform-email-templates' },
  { id: 'plat-smtp', label: 'SMTP Settings', icon: Settings, module: 'platform-smtp' },
  { id: 'plat-backups', label: 'Backups', icon: Database, module: 'platform-backups' },
];

// -------------------- Recent Items (in-memory) --------------------

let recentItems: CommandItemDef[] = [];
const MAX_RECENT = 5;

function addRecent(item: CommandItemDef) {
  recentItems = [item, ...recentItems.filter((r) => r.id !== item.id)].slice(0, MAX_RECENT);
}

// -------------------- Component --------------------

// Render a rich, domain-specific sublabel for a search result row. The
// label (primary text) is rendered by the CommandItem itself; this helper
// renders the SECONDARY line — the contextual details that make the result
// actionable: a customer's email + plan, a payment's amount + customer, a
// plan's price, a coupon's discount, a notification's preview + age.
//
// Each branch returns a compact, muted-foreground line so the palette stays
// scannable; status/active badges get a colored pill so they pop without
// overwhelming the row.
function renderSearchRowSub(
  row: CustomerResult | PaymentResult | PlanResult | CouponResult | NotificationResult,
): React.ReactNode {
  const badge = (text: string, cls: string) => (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {text}
    </span>
  );
  const muted = (text: string, extra = '') => (
    <span className={`text-[11px] text-muted-foreground truncate ${extra}`}>{text}</span>
  );

  switch (row.kind) {
    case 'customer': {
      const c = row as CustomerResult;
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {muted(c.email)}
          {c.planId && badge(c.planId, 'bg-primary/10 text-primary')}
          {c.status && badge(c.status, c.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}
        </div>
      );
    }
    case 'payment': {
      const p = row as PaymentResult;
      const amountStr = `${p.currency} ${(p.amount ?? 0).toFixed(2)}`;
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {muted(`${p.customerName} · ${amountStr}`)}
          {badge(p.status, p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : p.status === 'refunded' ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}
        </div>
      );
    }
    case 'plan': {
      const p = row as PlanResult;
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {muted(`${p.planId} · ${p.isFree ? 'Free' : `${p.currency} ${p.priceMonthly.toFixed(2)}/mo`}`)}
          {!p.active && badge('inactive', 'bg-muted text-muted-foreground')}
        </div>
      );
    }
    case 'coupon': {
      const c = row as CouponResult;
      const valStr = c.type === 'percent' ? `${c.value}% off` : `${c.currency} ${c.value.toFixed(2)} off`;
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {muted(valStr)}
          {c.active ? badge('active', 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400') : badge('inactive', 'bg-muted text-muted-foreground')}
        </div>
      );
    }
    case 'notification': {
      const n = row as NotificationResult;
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {muted(n.message, 'max-w-[280px]')}
          {badge(n.type, 'bg-primary/10 text-primary')}
          {!n.isRead && badge('unread', 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}
          {muted(formatRelativeTime(n.createdAt))}
        </div>
      );
    }
    default:
      return null;
  }
}

export function CommandPalette() {
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const close = useCommandPaletteStore((s) => s.close);
  const navigate = useNavigationStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const isPlatformStaff = user?.role === 'PLATFORM_ADMIN' || user?.role === 'OWNER';

  // Global keyboard listener for Cmd/Ctrl+K and Escape.
  // Escape MUST close the palette: without it the z-50 backdrop stays up
  // and blocks every interaction on the page until an outside click.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const { isOpen } = useCommandPaletteStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useCommandPaletteStore.getState().toggle();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        useCommandPaletteStore.getState().close();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Wrap close() so the search query resets whenever the palette is
  // dismissed. Doing this in the close handler (instead of a useEffect)
  // avoids the "setState in effect" anti-pattern that triggers cascading
  // renders — the reset is now tied to the user's dismiss action, not to
  // an isOpen prop change.
  const handleClose = useCallback(() => {
    setQuery('');
    close();
  }, [close, setQuery]);

  // ---- Real backend search (debounced) ----
  // Only fires when the user is a platform admin AND the query is at
  // least 2 characters. The query is debounced by 250ms so the API
  // isn't called on every keystroke. The endpoint is auth-guarded
  // (requirePlatformAdmin) and returns empty results when q is too
  // short — the palette then renders the static navigation instead.
  const debouncedQuery = useDebouncedValue(query, 250);
  const shouldSearch = isPlatformStaff && debouncedQuery.length >= 2;

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['platform-admin', 'search', debouncedQuery],
    queryFn: () => getApi<SearchResult>('/api/platform/admin/search', { q: debouncedQuery, limit: 5 }),
    enabled: shouldSearch,
    staleTime: 10_000, // cache results for 10s — typing the same query again won't re-fetch.
  });

  const handleSelect = useCallback(
    (item: CommandItemDef) => {
      navigate(item.module, null, item.subPage);
      addRecent(item);
      handleClose();
    },
    [navigate, handleClose],
  );

  // Navigate to a search result via its `link` (a hash like
  // #platform-customer-detail/<id>). The link is parsed into a
  // module + itemId + subPage triple — exactly what navigate() takes.
  // For customer results, itemId is the user id so the customer-detail
  // page renders. For payments/plans/coupons/notifications, the link
  // is just a module hash (e.g. #platform-payments) so itemId is null
  // and the page renders its own list view (which has its own client-
  // side search if the admin wants to filter further).
  const handleSelectSearchResult = useCallback(
    (link: string) => {
      const path = link.replace(/^#\/?/, '').trim() || 'dashboard';
      const segments = path.split('/');
      const mod = segments[0] || 'dashboard';
      const itemId = segments[1] ?? null;
      const subPage = segments[2] ?? null;
      navigate(mod, itemId ?? undefined, subPage ?? undefined);
      handleClose();
    },
    [navigate, handleClose],
  );

  // -------------------- Build groups --------------------
  // The groups array carries CommandItemDef items for STATIC navigation,
  // but search-result items carry their own `link` (a hash route) that
  // the click handler uses to navigate. We attach the link to the
  // CommandItemDef via a hidden `searchLink` field on the def — this
  // avoids a separate CommandItem type and keeps the rendering loop
  // single-source-of-truth.
  const groups: (CommandGroupDef & {
    searchLinks?: Record<string, string>;
    searchRows?: Record<string, CustomerResult | PaymentResult | PlanResult | CouponResult | NotificationResult>;
  })[] = useMemo(() => {
    const result: (CommandGroupDef & {
      searchLinks?: Record<string, string>;
      searchRows?: Record<string, CustomerResult | PaymentResult | PlanResult | CouponResult | NotificationResult>;
    })[] = [];

    // Search results (only when there's an actual query and the
    // backend returned matches). When shouldSearch is true but the
    // backend returned no matches, the CommandEmpty placeholder
    // handles the empty state — these groups aren't rendered.
    if (shouldSearch && searchResults) {
      const s = searchResults;
      const searchLinks: Record<string, string> = {};
      const searchRows: Record<string, CustomerResult | PaymentResult | PlanResult | CouponResult | NotificationResult> = {};
      const items: CommandItemDef[] = [];
      // Customers — label = name; the renderer pulls email + plan +
      // status from the attached `searchRows[id]` raw result.
      for (const c of s.customers) {
        const id = `search-customer-${c.id}`;
        searchLinks[id] = c.link;
        searchRows[id] = c;
        items.push({ id, label: c.name, icon: Users, module: 'platform-customer-detail' });
      }
      // Payments — label = the most specific identifier available.
      for (const p of s.payments) {
        const id = `search-payment-${p.id}`;
        searchLinks[id] = p.link;
        searchRows[id] = p;
        items.push({
          id,
          label: p.invoiceNumber ?? p.stripeInvoiceId ?? p.stripePaymentIntentId ?? p.stripeChargeId ?? p.id,
          icon: Receipt,
          module: 'platform-payments',
        });
      }
      // Plans
      for (const p of s.plans) {
        const id = `search-plan-${p.id}`;
        searchLinks[id] = p.link;
        searchRows[id] = p;
        items.push({ id, label: p.name, icon: Tag, module: 'platform-plans' });
      }
      // Coupons
      for (const c of s.coupons) {
        const id = `search-coupon-${c.id}`;
        searchLinks[id] = c.link;
        searchRows[id] = c;
        items.push({ id, label: c.code, icon: Ticket, module: 'platform-coupons' });
      }
      // Notifications
      for (const n of s.notifications) {
        const id = `search-notification-${n.id}`;
        searchLinks[id] = n.link;
        searchRows[id] = n;
        items.push({ id, label: n.title, icon: Bell, module: 'platform-notifications' });
      }
      // Split into per-domain groups (preserves the per-domain
      // headings the previous version had).
      if (s.customers.length > 0) {
        result.push({
          heading: 'Customers',
          items: items.filter((i) => i.id.startsWith('search-customer-')),
          searchLinks,
          searchRows,
        });
      }
      if (s.payments.length > 0) {
        result.push({
          heading: 'Payments',
          items: items.filter((i) => i.id.startsWith('search-payment-')),
          searchLinks,
          searchRows,
        });
      }
      if (s.plans.length > 0) {
        result.push({
          heading: 'Plans',
          items: items.filter((i) => i.id.startsWith('search-plan-')),
          searchLinks,
          searchRows,
        });
      }
      if (s.coupons.length > 0) {
        result.push({
          heading: 'Coupons',
          items: items.filter((i) => i.id.startsWith('search-coupon-')),
          searchLinks,
          searchRows,
        });
      }
      if (s.notifications.length > 0) {
        result.push({
          heading: 'Notifications',
          items: items.filter((i) => i.id.startsWith('search-notification-')),
          searchLinks,
          searchRows,
        });
      }
      return result;
    }

    // No active search → show navigation. Platform staff see ONLY the
    // Platform Admin nav cluster (Overview, Customers, Payments, Plans &
    // Pricing, Coupons, Stripe Settings, Notifications, Email Templates,
    // SMTP Settings, Backups) — the client CMS items (Content, Media,
    // AI, AI Providers, Prompt Library, AI Jobs, etc.) are NOT relevant
    // for a platform admin's role and are filtered out. Client roles
    // (admin/editor/author) keep the full CMS nav + actions.
    if (recentItems.length > 0) {
      result.push({ heading: 'Recent', items: recentItems });
    }

    if (isPlatformStaff) {
      result.push({ heading: 'Platform Admin', items: PLATFORM_NAV_ITEMS });
    } else {
      result.push({ heading: 'Navigation', items: NAV_ITEMS });
      result.push({ heading: 'Actions', items: ACTION_ITEMS });
    }

    return result;
  }, [shouldSearch, searchResults, isPlatformStaff]);

  // When the user is searching, override Command's default filter
  // (we already have backend results — don't client-side filter them
  // out). When NOT searching, let Command filter the static nav
  // items by the typed query (legacy behavior).
  const shouldFilter = !shouldSearch;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cmd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={handleClose}
          />
          {/* Palette */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] pointer-events-none">
            <motion.div
              key="cmd-palette"
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-auto w-full max-w-[640px] max-h-[480px] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
            >
              <Command className="rounded-lg" shouldFilter={shouldFilter}>
                {/*
                  Search input row. CommandInput already renders its own
                  leading Search icon + a `border-b px-3` wrapper — so we
                  do NOT add a second <Search> here (that produced the
                  duplicate-icon bug). The only extra element layered on
                  top is the debounced-search spinner, positioned
                  absolutely at the right edge of the relative wrapper.
                  Placeholder is the simple "Search..." for both roles
                  (platform staff + client) per the requested change.
                */}
                <div className="relative">
                  <CommandInput
                    ref={inputRef}
                    placeholder="Search..."
                    className="h-12 text-sm"
                    autoFocus
                    value={query}
                    onValueChange={setQuery}
                  />
                  {isSearching && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  )}
                </div>
                <CommandList className="max-h-[380px]">
                  <CommandEmpty>
                    {shouldSearch
                      ? (isSearching ? 'Searching…' : 'No matching customers, payments, plans, coupons or notifications.')
                      : 'No results found.'}
                  </CommandEmpty>
                  {groups.map((group, groupIdx) => (
                    <React.Fragment key={group.heading}>
                      {groupIdx > 0 && <CommandSeparator />}
                      <CommandGroup heading={group.heading}>
                        {group.items.map((item) => {
                          // Search-result items: navigate via the API-provided
                          // link hash. Static nav items: navigate via the
                          // module/subPage fields.
                          const searchLink = group.searchLinks?.[item.id];
                          const searchRow = group.searchRows?.[item.id];
                          return (
                            <CommandItem
                              key={item.id}
                              value={`${item.label} ${item.module}${item.subPage ? ' ' + item.subPage : ''}`}
                              onSelect={() => {
                                if (searchLink) {
                                  handleSelectSearchResult(searchLink);
                                } else {
                                  handleSelect(item);
                                }
                              }}
                              className="cursor-pointer items-start"
                            >
                              <item.icon className="h-4 w-4 mt-0.5" />
                              {/* Search rows render label + a rich
                                  domain-specific sublabel (email, amount,
                                  plan, status badges, etc.); static nav
                                  rows render just the label. */}
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="truncate font-medium">{item.label}</span>
                                {searchRow && renderSearchRowSub(searchRow)}
                              </div>
                              {item.shortcut && !searchRow && (
                                <CommandShortcut>{item.shortcut}</CommandShortcut>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </React.Fragment>
                  ))}
                </CommandList>
              </Command>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// -------------------- Hook: debounced value --------------------

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
