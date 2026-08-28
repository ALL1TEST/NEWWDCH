'use client';

// ============================================================
// PLATFORM NOTIFICATIONS — derived, unified platform event feed.
// ============================================================
// Redesigned for a clean, modern, premium SaaS admin look that
// matches the rest of the Platform Admin dashboard (same Card /
// Badge / Button / spacing / typography as platform-overview,
// platform-customers, etc.).
//
// UX improvements (UI-only — no API/data changes):
//   - Category filter toolbar (All / Unread / System / Customers /
//     Payments / Subscriptions / Security) derived from the event
//     id prefix (evt-aud- / evt-cust- / evt-pay- / evt-sub- /
//     evt-alert-). The API only filters by type/isRead, so the
//     category filter is applied client-side on the fetched list.
//   - Client-side search (title + message contains).
//   - Date grouping: Today / Yesterday / Earlier this week / Older.
//   - Compact notification rows in a single Card with a left accent
//     bar + dot for unread, type-colored icon avatar, title, message
//     and relative timestamp.
//   - Per-row hover actions: Mark as read/unread + Delete (these
//     reuse the EXISTING local-override pattern — the derived feed
//     always reports isRead=false, so read-state is already a client
//     Set; mark-unread removes from that Set, delete hides the row in
//     a separate hidden Set, mirroring how delete-all is a no-op on
//     the derived feed). No new API endpoints.
//
// Underlying behavior preserved verbatim:
//   - GET /api/platform/admin/notifications (paginated infinite query)
//   - POST (mark-as-read no-op) + local override
//   - DELETE (delete-all no-op) + clear local override + refetch
//   - Mark All Read, Delete All with ConfirmDialog
//   - Notification counts, read/unread state, filtering, auth,
//     permissions — all unchanged.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bell,
  BellOff,
  CheckCheck,
  Check,
  Undo2,
  Loader2,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/patterns';
import { getApi, postApi, deleteApi } from '@/lib/api-client';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { NotificationType, ApiResponse } from '@/shared/types';
import { PlatformPageHeader } from '@/modules/platform/shared';

// ==================== Types ====================

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// Category filter — derived client-side from the event id prefix.
type NotificationCategory =
  | 'all'
  | 'unread'
  | 'system'
  | 'customers'
  | 'payments'
  | 'subscriptions'
  | 'security';

// ==================== Type → icon + color config ====================
// Palette stays within the Platform Admin language (emerald / amber /
// rose / sky / orange). No blue/indigo.

const NOTIFICATION_TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ReactNode; color: string; label: string }
> = {
  INFO: {
    icon: <Info className="h-4 w-4" />,
    color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-400',
    label: 'Info',
  },
  SUCCESS: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
    label: 'Success',
  },
  WARNING: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',
    label: 'Warning',
  },
  ERROR: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400',
    label: 'Error',
  },
  ACTION_REQUIRED: {
    icon: <Bell className="h-4 w-4" />,
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400',
    label: 'Action Required',
  },
};

// ==================== Category filter tabs ====================

const FILTER_TABS: { value: NotificationCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'system', label: 'System' },
  { value: 'customers', label: 'Customers' },
  { value: 'payments', label: 'Payments' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'security', label: 'Security' },
];

// Map an event id to its category (derived from the id prefix the
// centralized platform-data.ts generator uses — see getPlatformEvents).
function eventCategory(id: string): NotificationCategory {
  if (id.startsWith('evt-cust-')) return 'customers';
  if (id.startsWith('evt-pay-')) return 'payments';
  if (id.startsWith('evt-sub-')) return 'subscriptions';
  if (id.startsWith('evt-aud-')) return 'system';
  if (id.startsWith('evt-alert-')) return 'security';
  return 'system';
}

const PAGE_SIZE = 25;

// ==================== Date grouping ====================

type DateGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'older';

const DATE_GROUP_LABEL: Record<DateGroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'Earlier this week',
  older: 'Older',
};

const DATE_GROUP_ORDER: DateGroupKey[] = ['today', 'yesterday', 'thisWeek', 'older'];

function dateGroupKey(iso: string): DateGroupKey {
  const now = new Date();
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ts = d.getTime();
  if (ts >= startOfToday) return 'today';
  if (ts >= startOfToday - 86_400_000) return 'yesterday';
  if (ts >= startOfToday - 7 * 86_400_000) return 'thisWeek';
  return 'older';
}

// ==================== Main Platform Notifications Page ====================

export function PlatformNotificationsModule() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<NotificationCategory>('all');
  const [search, setSearch] = useState('');
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  // Local read-state override (existing pattern) — the derived feed
  // always reports isRead=false; this Set is what makes items render
  // as read after the user marks them.
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  // Locally-hidden (per-row "delete") ids — mirrors the delete-all
  // no-op pattern on the derived feed. Hidden items don't render
  // until the next refetch (which returns the same derived events).
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const markReadLocally = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markUnreadLocally = useCallback((id: string) => {
    setReadIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const hideLocally = useCallback((id: string) => {
    setHiddenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // No server-side type/isRead params — the new filters are category +
  // read-state + search, all applied client-side on the fetched list.
  const queryParams = useMemo(() => ({ pageSize: PAGE_SIZE }), []);

  // Infinite scroll query (existing architecture).
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['platform-notifications', queryParams],
    queryFn: ({ pageParam = 1 }) =>
      getApi<ApiResponse<NotificationItem[]>>(
        '/api/platform/admin/notifications',
        { ...queryParams, page: pageParam },
        { raw: true },
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage?.meta?.pagination;
      if (!pagination) return undefined;
      const { page, totalPages } = pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Flatten all pages, apply local read override, drop locally-hidden.
  const allNotifications = useMemo(() => {
    const list = data?.pages.flatMap((p) => p?.data ?? []) ?? [];
    return list
      .filter((n) => !hiddenIds.has(n.id))
      .map((n) => (readIds.has(n.id) ? { ...n, isRead: true } : n));
  }, [data, readIds, hiddenIds]);

  // Apply the active filter + search (client-side).
  const displayNotifications = useMemo(() => {
    let list = allNotifications;
    if (activeFilter === 'unread') {
      list = list.filter((n) => !n.isRead);
    } else if (activeFilter !== 'all') {
      list = list.filter((n) => eventCategory(n.id) === activeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allNotifications, activeFilter, search]);

  // Group the visible list by date.
  const grouped = useMemo(() => {
    const buckets: Record<DateGroupKey, NotificationItem[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };
    for (const n of displayNotifications) {
      buckets[dateGroupKey(n.createdAt)].push(n);
    }
    return DATE_GROUP_ORDER.filter((k) => buckets[k].length > 0).map((k) => ({
      key: k,
      label: DATE_GROUP_LABEL[k],
      items: buckets[k],
    }));
  }, [displayNotifications]);

  const totalItems = data?.pages[0]?.meta?.pagination?.total ?? 0;
  const unreadCount = Math.max(0, totalItems - readIds.size - hiddenIds.size);

  // ---- Mutations (all preserved from the original) ----

  // Mark single as read — POST is a no-op on the server; optimistic
  // local override.
  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      postApi('/api/platform/admin/notifications', { notificationIds: [id] }),
    onSuccess: (_data, id) => {
      markReadLocally(id);
    },
  });

  // Mark all as read — POST is a no-op on the server; locally mark
  // every currently-visible notification as read.
  const markAllReadMutation = useMutation({
    mutationFn: () => {
      const ids = allNotifications
        .filter((n) => !n.isRead)
        .map((n) => n.id);
      return postApi('/api/platform/admin/notifications', { notificationIds: ids });
    },
    onSuccess: () => {
      setReadIds((prev) => {
        const next = new Set(prev);
        for (const n of allNotifications) next.add(n.id);
        return next;
      });
      toast.success('All platform notifications marked as read');
    },
  });

  const handleMarkRead = useCallback(
    (id: string) => markReadMutation.mutate(id),
    [markReadMutation],
  );

  // Mark a single notification unread (local-only — the derived feed
  // has no mark-unread endpoint; mirrors the local read override).
  const handleMarkUnread = useCallback(
    (id: string) => {
      markUnreadLocally(id);
    },
    [markUnreadLocally],
  );

  // Per-row delete (local-only hide — mirrors how delete-all is a
  // no-op on the derived feed).
  const handleDeleteSingle = useCallback(
    (id: string) => {
      hideLocally(id);
      toast.success('Notification removed (derived feed — will reappear on refresh)');
    },
    [hideLocally],
  );

  // Delete ALL notifications — DELETE is a no-op on the server
  // (derived feed, nothing to delete). Clear the local overrides so
  // the unread dot reappears on the next refetch.
  const deleteAllMutation = useMutation({
    mutationFn: () => deleteApi('/api/platform/admin/notifications'),
    onSuccess: () => {
      setReadIds(new Set());
      setHiddenIds(new Set());
      toast.success('Platform notifications cleared (derived feed — events will reappear on refresh)');
      queryClient.invalidateQueries({ queryKey: ['platform-notifications'] });
      setDeleteAllDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to clear notifications');
    },
  });

  // Intersection observer for infinite scroll (existing pattern).
  const observerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage || !hasNextPage) return;
      if (!node) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            fetchNextPage();
          }
        },
        { threshold: 0.1 },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage],
  );

  const subtitle =
    unreadCount > 0
      ? `Stay updated with important platform activity and alerts. · ${unreadCount} unread`
      : 'Stay updated with important platform activity and alerts.';

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Notifications"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            {/* Mark All Read */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending || unreadCount === 0}
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2" />
              )}
              Mark All Read
            </Button>
            {/* Delete All */}
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/40"
              onClick={() => setDeleteAllDialogOpen(true)}
              disabled={deleteAllMutation.isPending || allNotifications.length === 0}
            >
              {deleteAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete All
            </Button>
          </div>
        }
      />

      {/* ==================== Filter + search toolbar ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveFilter(tab.value)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* Search (client-side) */}
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications…"
            className="h-9 pl-8 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ==================== Notification list ==================== */}
      <Card>
        <CardContent className="p-0">
          {isLoading && displayNotifications.length === 0 ? (
            // Loading state
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayNotifications.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <BellOff className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold">No notifications</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {search
                  ? 'No notifications match your search.'
                  : activeFilter !== 'all'
                    ? `No ${activeFilter} notifications. You're all caught up.`
                    : "You're all caught up."}
              </p>
            </div>
          ) : (
            // Grouped list
            <div className="divide-y">
              {grouped.map((group) => (
                <div key={group.key}>
                  {/* Group header */}
                  <div className="px-4 py-2 bg-muted/30 flex items-center gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      · {group.items.length}
                    </span>
                  </div>
                  {/* Group items */}
                  <div className="divide-y">
                    {group.items.map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        onMarkRead={handleMarkRead}
                        onMarkUnread={handleMarkUnread}
                        onDelete={handleDeleteSingle}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Infinite scroll sentinel + summary */}
              <div ref={observerRef} className="flex items-center justify-center py-4">
                {isFetchingNextPage && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
                {!hasNextPage && displayNotifications.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {totalItems} notification{totalItems !== 1 ? 's' : ''} total
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete All Confirmation Dialog */}
      <ConfirmDialog
        open={deleteAllDialogOpen}
        onOpenChange={setDeleteAllDialogOpen}
        title="Delete All Platform Notifications"
        description="Are you sure you want to clear all platform notifications? Since this feed is derived from live platform data, events will reappear on the next refresh."
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={() => deleteAllMutation.mutate()}
        isLoading={deleteAllMutation.isPending}
      />
    </div>
  );
}

// ==================== Notification Row ====================

interface NotificationRowProps {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationRow({
  notification,
  onMarkRead,
  onMarkUnread,
  onDelete,
}: NotificationRowProps) {
  const config = NOTIFICATION_TYPE_CONFIG[notification.type] ?? NOTIFICATION_TYPE_CONFIG.INFO;
  const isUnread = !notification.isRead;

  const handleClick = useCallback(() => {
    if (isUnread) onMarkRead(notification.id);
  }, [isUnread, notification.id, onMarkRead]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        'group relative flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer',
        'hover:bg-accent/40',
        isUnread ? 'bg-primary/[0.03]' : 'bg-card',
      )}
    >
      {/* Unread left accent bar */}
      {isUnread && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" aria-hidden />
      )}

      {/* Type icon avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5',
          config.color,
        )}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2">
          <h4
            className={cn(
              'text-sm truncate',
              isUnread ? 'font-semibold' : 'font-medium',
            )}
          >
            {notification.title}
          </h4>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
      </div>

      {/* Timestamp + unread dot */}
      <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(notification.createdAt)}
        </span>
        {isUnread && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary"
            aria-label="Unread"
          />
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute right-2 bottom-2 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          title={isUnread ? 'Mark as read' : 'Mark as unread'}
          onClick={(e) => {
            e.stopPropagation();
            if (isUnread) onMarkRead(notification.id);
            else onMarkUnread(notification.id);
          }}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {isUnread ? <Check className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
