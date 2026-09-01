'use client';

// ============================================================
// ADMIN USER NOTIFICATIONS
// ============================================================
// Visual design/layout copied from the Platform Admin Notifications
// page (src/modules/platform/platform-notifications.tsx): page
// structure (space-y-6), platform header styling, filter+search
// toolbar, single Card list with date grouping, row design (unread
// left accent bar, 8×8 icon avatar, hover actions), icon/color
// palette (sky / emerald / amber / rose / orange), empty/loading
// states and responsive layout.
//
// ADMIN USER LOGIC — intentionally NOT copied from Platform Admin:
//   - Filter tabs stay the Admin User taxonomy:
//     All / Unread / Info / Success / Warning / Error
//     (Platform's System/Customers/Payments/Subscriptions/Security
//     categories are NOT used here.)
//   - Data stays on the Admin User endpoints:
//     GET/POST /api/notifications, PATCH/DELETE /api/notifications/[id],
//     GET /api/notifications/unread-count
//     (completely separate from /api/platform/admin/notifications*).
//   - Comment-notifications toggle and Read More/Read Less message
//     expansion are Admin User behaviors, preserved.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { NotificationType, ApiResponse } from '@/shared/types';

// ==================== Types ====================

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ADMIN USER filter taxonomy — unchanged.
type NotificationFilter = 'all' | 'unread' | NotificationType;

// Type → icon + color config — palette copied from the Platform Admin
// page (emerald / amber / rose / sky / orange; no blue/indigo).
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

// ADMIN USER filter tabs — All / Unread / Info / Success / Warning /
// Error. Exactly as before; Platform Admin categories NOT copied.
const FILTER_TABS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'INFO', label: 'Info' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'ERROR', label: 'Error' },
];

const PAGE_SIZE = 25;

// ==================== Date grouping (Platform Admin design) ====================

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

// ==================== Notification Message (Read More / Read Less) ====================
// Admin User behavior preserved: uses ResizeObserver to detect whether
// the message text is actually truncated by line-clamp-2. "Read More"
// only appears when the text genuinely overflows the 2-line preview.
// Base message styling follows the Platform Admin row design
// (text-xs text-muted-foreground line-clamp-2).

function NotificationMessage({
  message,
  isUnread,
}: {
  message: string;
  isUnread: boolean;
}) {
  const paraRef = useRef<HTMLParagraphElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = paraRef.current;
    if (!el) return;

    const check = () => {
      if (isExpanded) {
        // When expanded, always show "Read Less"
        setIsTruncated(true);
        return;
      }
      // scrollHeight > clientHeight means line-clamp-2 is clipping content
      const isClipped = el.scrollHeight > el.clientHeight + 2;
      setIsTruncated(isClipped);
    };

    const raf = requestAnimationFrame(check);
    const observer = new ResizeObserver(() => requestAnimationFrame(check));
    observer.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [message, isExpanded]);

  return (
    <>
      <p
        ref={paraRef}
        className={cn(
          'text-xs text-muted-foreground mt-0.5',
          !isExpanded && 'line-clamp-2',
          isUnread && 'text-foreground/70',
        )}
      >
        {message}
      </p>
      {isTruncated && (
        <button
          type="button"
          className="text-xs text-primary hover:underline mt-0.5"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
        >
          {isExpanded ? 'Read Less' : 'Read More'}
        </button>
      )}
    </>
  );
}

// ==================== Notification Row (Platform Admin design) ====================

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
        <NotificationMessage
          message={notification.message}
          isUnread={isUnread}
        />
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

// ==================== Main Notifications Page ====================

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [search, setSearch] = useState('');
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  // Comment Notifications setting (Admin User setting — preserved)
  const { data: commentNotifData } = useQuery({
    queryKey: ['settings', 'discussion', 'comment-notification'],
    queryFn: () => getApi<Record<string, string> | null>('/api/settings?category=DISCUSSION'),
    staleTime: 10_000,
  });
  const commentNotifsOn = commentNotifData?.comment_notification !== 'false';
  const toggleCommentNotifs = useMutation({
    mutationFn: (enabled: boolean) =>
      postApi('/api/settings', {
        settings: [{ key: 'comment_notification', value: String(enabled), type: 'BOOLEAN', category: 'DISCUSSION' }],
      }),
    onMutate: async (enabled) => {
      // Cancel any outgoing refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ['settings', 'discussion', 'comment-notification'] });
      // Optimistically update the cache
      const prevData = queryClient.getQueryData<Record<string, string>>(['settings', 'discussion', 'comment-notification']);
      queryClient.setQueryData<Record<string, string>>(
        ['settings', 'discussion', 'comment-notification'],
        (prev) => ({ ...(prev ?? {}), comment_notification: String(enabled) }),
      );
      return { prevData };
    },
    onSuccess: (_data, variables) => {
      // Use 'variables' (the new value) for the toast, not 'commentNotifsOn' (the old value)
      toast.success(`Comment notifications ${variables ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error, _variables, context) => {
      toast.error(err.message || 'Failed to update setting');
      // Rollback to previous data
      if (context?.prevData) {
        queryClient.setQueryData(['settings', 'discussion', 'comment-notification'], context.prevData);
      }
      queryClient.invalidateQueries({ queryKey: ['settings', 'discussion', 'comment-notification'] });
    },
  });

  // Build query params based on filter — ADMIN USER logic unchanged:
  // Unread → isRead=false; type tabs → type=<INFO|SUCCESS|WARNING|ERROR>.
  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = { pageSize: PAGE_SIZE };
    if (activeFilter === 'unread') {
      params.isRead = false;
    } else if (activeFilter !== 'all') {
      params.type = activeFilter;
    }
    return params;
  }, [activeFilter]);

  // Infinite scroll query — Admin User data source (/api/notifications).
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.notifications.list(queryParams),
    queryFn: ({ pageParam = 1 }) =>
      getApi<ApiResponse<NotificationItem[]>>(
        '/api/notifications',
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

  // Flatten all pages
  const allNotifications = useMemo(
    () => data?.pages.flatMap((p) => p?.data ?? []) ?? [],
    [data],
  );

  const totalPages = data?.pages[0]?.meta?.pagination?.totalPages ?? 0;
  const totalItems = data?.pages[0]?.meta?.pagination?.total ?? 0;

  // Unread count for the header subtitle (Admin User endpoint)
  const { data: unreadCountData } = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => getApi<{ count: number }>('/api/notifications/unread-count'),
    staleTime: 15_000,
  });
  const unreadCount = unreadCountData?.count ?? 0;

  // Mark single as read — POST /api/notifications (existing Admin
  // User endpoint). Optimistic row flip matches the Platform Admin
  // interaction feel; the server call is unchanged.
  const markReadMutation = useMutation({
    mutationFn: (id: string) => postApi('/api/notifications', { notificationIds: [id] }),
    onMutate: (id: string) => {
      queryClient.setQueryData(queryKeys.notifications.list(queryParams), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((p: any) => ({
            ...p,
            data: (p?.data ?? []).map((n: NotificationItem) =>
              n.id === id ? { ...n, isRead: true } : n,
            ),
          })),
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  // Mark single as unread — PATCH /api/notifications/[id] (existing
  // Admin User endpoint; wire-up mirrors the Platform Admin row design).
  const markUnreadMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/notifications/${id}`, { isRead: false }),
    onMutate: (id: string) => {
      queryClient.setQueryData(queryKeys.notifications.list(queryParams), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((p: any) => ({
            ...p,
            data: (p?.data ?? []).map((n: NotificationItem) =>
              n.id === id ? { ...n, isRead: false } : n,
            ),
          })),
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  // Delete single notification — DELETE /api/notifications/[id]
  // (existing Admin User endpoint; wire-up mirrors the Platform Admin
  // row design).
  const deleteSingleMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/notifications/${id}`),
    onMutate: (id: string) => {
      queryClient.setQueryData(queryKeys.notifications.list(queryParams), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((p: any) => ({
            ...p,
            data: (p?.data ?? []).filter((n: NotificationItem) => n.id !== id),
          })),
        };
      });
    },
    onSuccess: () => {
      toast.success('Notification deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  // Mark all as read — Admin User logic unchanged (collects the ids of
  // all loaded unread rows and POSTs them to /api/notifications).
  const markAllReadMutation = useMutation({
    mutationFn: () => {
      const ids = allNotifications
        .filter((n) => !n.isRead)
        .map((n) => n.id);
      return postApi('/api/notifications', { notificationIds: ids });
    },
    onMutate: () => {
      queryClient.setQueryData(queryKeys.notifications.list(queryParams), (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((p: any) => ({
            ...p,
            data: (p?.data ?? []).map((n: NotificationItem) => ({ ...n, isRead: true })),
          })),
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const handleMarkRead = useCallback(
    (id: string) => markReadMutation.mutate(id),
    [markReadMutation],
  );

  const handleMarkUnread = useCallback(
    (id: string) => markUnreadMutation.mutate(id),
    [markUnreadMutation],
  );

  const handleDeleteSingle = useCallback(
    (id: string) => deleteSingleMutation.mutate(id),
    [deleteSingleMutation],
  );

  // Delete ALL notifications — Admin User logic unchanged.
  const deleteAllMutation = useMutation({
    mutationFn: () => deleteApi('/api/notifications'),
    onSuccess: () => {
      toast.success('All notifications deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      setDeleteAllDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete notifications');
    },
  });

  // Apply search (client-side, Platform Admin toolbar behavior).
  const displayNotifications = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allNotifications;
    return allNotifications.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q),
    );
  }, [allNotifications, search]);

  // Group the visible list by date (Platform Admin list design).
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

  // Intersection observer for infinite scroll
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
      ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
      : 'No unread notifications';

  return (
    <div className="space-y-6">
      {/* ==================== Header (Platform Admin styling) ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
        </div>
        {(
          <div className="flex flex-wrap items-center gap-2">
            {/* Comment Notifications toggle (Admin User setting — preserved) */}
            <div className="flex items-center gap-2">
              <Switch
                id="comment-notif-toggle"
                checked={commentNotifsOn}
                onCheckedChange={(v) => toggleCommentNotifs.mutate(v)}
                disabled={toggleCommentNotifs.isPending}
              />
              <Label htmlFor="comment-notif-toggle" className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer hidden sm:inline">
                Comment Notifications
              </Label>
            </div>
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
        )}
      </div>

      {/* ==================== Filter + search toolbar (Platform Admin design) ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Admin User filter tabs — All / Unread / Info / Success / Warning / Error */}
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

      {/* ==================== Notification list (Platform Admin card design) ==================== */}
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
                    ? `No ${activeFilter.toLowerCase()} notifications found`
                    : "You're all caught up!"}
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

      {/* Delete All Confirmation Dialog (Admin User text — unchanged) */}
      <ConfirmDialog
        open={deleteAllDialogOpen}
        onOpenChange={setDeleteAllDialogOpen}
        title="Delete All Notifications"
        description="Are you sure you want to delete ALL notifications? This action cannot be undone and will permanently remove every notification."
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={() => deleteAllMutation.mutate()}
        isLoading={deleteAllMutation.isPending}
      />
    </div>
  );
}
