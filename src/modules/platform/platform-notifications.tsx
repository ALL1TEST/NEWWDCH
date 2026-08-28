'use client';

// ============================================================
// PLATFORM NOTIFICATIONS — derived, unified platform event feed.
// ============================================================
// Visual + implementation mirror the Client Dashboard Notifications
// page (src/modules/notifications/notifications-page.tsx): same
// PageHeader pattern (here PlatformPageHeader to keep the PLATFORM
// badge), same filter pill buttons (All / Unread / Info / Success /
// Warning / Error), same NotificationCard pattern (type-icon avatar,
// title, relative time, unread dot, message with Read More/Less via
// ResizeObserver, type Badge + Read indicator), same Mark All Read +
// Delete All actions with ConfirmDialog, same infinite-scroll
// IntersectionObserver pattern, same empty state (BellOff).
//
// BUT the content is PLATFORM-LEVEL events derived from the SAME
// platform-data.ts singleton the rest of the Platform Admin reads
// from — never the client/site Notification table. Endpoint:
// /api/platform/admin/notifications (GET paginated+filtered,
// POST mark-as-read no-op, DELETE delete-all no-op — derived feed,
// see route header for the production design).
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
  Loader2,
  Trash2,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

type NotificationFilter = 'all' | 'unread' | NotificationType;

const NOTIFICATION_TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ReactNode; color: string; label: string }
> = {
  INFO: {
    icon: <Info className="h-5 w-5" />,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    label: 'Info',
  },
  SUCCESS: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    label: 'Success',
  },
  WARNING: {
    icon: <AlertTriangle className="h-5 w-5" />,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    label: 'Warning',
  },
  ERROR: {
    icon: <XCircle className="h-5 w-5" />,
    color: 'text-red-500 bg-red-500/10 border-red-500/20',
    label: 'Error',
  },
  ACTION_REQUIRED: {
    icon: <Bell className="h-5 w-5" />,
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    label: 'Action Required',
  },
};

const FILTER_TABS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'INFO', label: 'Info' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'ERROR', label: 'Error' },
];

// Platform event types surfaced by this module — derived from the
// centralized platform-data.ts singleton (no separate store).
const EVENT_TYPES: { key: string; label: string }[] = [
  { key: 'new_customer', label: 'New customer registered' },
  { key: 'payment_success', label: 'Successful payment' },
  { key: 'payment_failed', label: 'Failed payment' },
  { key: 'subscription_created', label: 'Subscription created' },
  { key: 'subscription_upgraded', label: 'Subscription upgraded / downgraded' },
  { key: 'subscription_cancelled', label: 'Subscription cancelled' },
  { key: 'trial_ending', label: 'Trial ending soon' },
  { key: 'usage_limit_reached', label: 'Usage limit reached' },
  { key: 'backup_completed', label: 'Backup completed' },
  { key: 'backup_failed', label: 'Backup failed' },
  { key: 'system_error', label: 'System error' },
  { key: 'storage_limit_warning', label: 'Storage limit warning' },
];

const PAGE_SIZE = 25;

// ==================== Notification Message (Read More / Read Less) ====================
// Uses ResizeObserver to detect whether the message text is actually being
// truncated by line-clamp-2. "Read More" only appears when the text
// genuinely overflows the 2-line preview. Each notification expands/collapses
// independently via its own local state. Mirrors the Client Notifications page.

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
        setIsTruncated(true);
        return;
      }
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
          'text-sm text-muted-foreground mt-1',
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

// ==================== Notification Card ====================

interface NotificationCardProps {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
}

function NotificationCard({ notification, onMarkRead }: NotificationCardProps) {
  const config = NOTIFICATION_TYPE_CONFIG[notification.type] ?? NOTIFICATION_TYPE_CONFIG.INFO;

  const handleClick = useCallback(() => {
    if (!notification.isRead) {
      onMarkRead(notification.id);
    }
  }, [notification.id, notification.isRead, onMarkRead]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50 group',
        !notification.isRead && 'border-primary/30 bg-primary/[0.02]',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div
          className={cn(
            'flex items-center justify-center h-10 w-10 rounded-full border shrink-0',
            config.color,
          )}
        >
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                'text-sm font-medium truncate',
                !notification.isRead && 'font-semibold',
              )}
            >
              {notification.title}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(notification.createdAt)}
              </span>
              {/* Unread indicator */}
              {!notification.isRead && (
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" aria-label="Unread" />
              )}
            </div>
          </div>
          <NotificationMessage
            message={notification.message}
            isUnread={!notification.isRead}
          />
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-[10px]">
              {config.label}
            </Badge>
            {notification.isRead && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CheckCheck className="h-3 w-3" />
                Read
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ==================== Main Platform Notifications Page ====================

export function PlatformNotificationsModule() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  // The platform event feed is DERIVED fresh on every request (see the
  // /api/platform/admin/notifications route header), so every event
  // comes back with isRead=false. To make the Mark All Read / single-
  // click "mark read" UX feel real, we keep a local override Set of
  // ids the user has marked read on the client. The Set is purely a
  // display override; the API's POST/DELETE are no-ops (also documented
  // in the route header). This avoids polluting the singleton store.
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  const markReadLocally = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Build query params based on filter
  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = { pageSize: PAGE_SIZE };
    if (activeFilter === 'unread') {
      params.isRead = false;
    } else if (activeFilter !== 'all') {
      params.type = activeFilter;
    }
    return params;
  }, [activeFilter]);

  // Infinite scroll query
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

  // Flatten all pages and apply local read override
  const allNotifications = useMemo(() => {
    const list = data?.pages.flatMap((p) => p?.data ?? []) ?? [];
    return list.map((n) => (readIds.has(n.id) ? { ...n, isRead: true } : n));
  }, [data, readIds]);

  // For the 'unread' filter, also hide items marked read on the client
  // (the API side filters isRead=false but the derived feed always
  // returns isRead=false — the local override is what hides them).
  const displayNotifications = useMemo(() => {
    if (activeFilter === 'unread') return allNotifications.filter((n) => !n.isRead);
    return allNotifications;
  }, [allNotifications, activeFilter]);

  const totalPages = data?.pages[0]?.meta?.pagination?.totalPages ?? 0;
  const totalItems = data?.pages[0]?.meta?.pagination?.total ?? 0;

  // Unread count for the subtitle badge — derived from server total
  // minus the locally-marked-read ids (clamped). Since the derived
  // feed always reports isRead=false, server total == total events.
  const unreadCount = Math.max(0, totalItems - readIds.size);

  // Mark single as read — POST is a no-op on the server; we just
  // optimistically update the local override set.
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

  // Delete ALL notifications — DELETE is a no-op on the server
  // (derived feed, nothing to delete). We clear the local override
  // set so the unread dot reappears on the next refetch (which
  // returns the same derived events).
  const deleteAllMutation = useMutation({
    mutationFn: () => deleteApi('/api/platform/admin/notifications'),
    onSuccess: () => {
      setReadIds(new Set());
      toast.success('Platform notifications cleared (derived feed — events will reappear on refresh)');
      queryClient.invalidateQueries({ queryKey: ['platform-notifications'] });
      setDeleteAllDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to clear notifications');
    },
  });

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
      ? `Platform-level events: customers, payments, subscriptions, and system alerts. · ${unreadCount} unread`
      : 'Platform-level events: customers, payments, subscriptions, and system alerts.';

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
              className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/40"
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

      {/* Filter tabs — custom pill buttons (matches Client Notifications page) */}
      <div className="flex flex-wrap gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
              activeFilter === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="space-y-2">
        {isLoading && displayNotifications.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold">No Platform Notifications</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {activeFilter !== 'all'
                ? `No ${activeFilter.toLowerCase()} platform notifications found`
                : 'No platform events yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
              />
            ))}
            <div ref={observerRef} className="flex items-center justify-center py-4">
              {isFetchingNextPage && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
              {!hasNextPage && displayNotifications.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {totalItems} notification{totalItems !== 1 ? 's' : ''} total
                  {totalPages > 1 ? ` · ${totalPages} pages` : ''}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================== Event Types Card ==================== */}
      {/* Surfaces the platform event categories surfaced by this module.
          Visual style mirrors the Client Notifications page Card pattern. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Event Types</CardTitle>
          <CardDescription className="text-xs">
            Platform-level event categories surfaced in this feed. All events are derived from the
            centralized platform dataset — there is no separate Notification store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {EVENT_TYPES.map((e) => (
              <div
                key={e.key}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-full border shrink-0 bg-muted text-muted-foreground">
                  <Database className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.label}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{e.key}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2.5 mt-4 rounded-lg border bg-muted/30 p-3">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Read-state and delete are no-ops on the derived feed — events are recomputed on every
              request from the live platform dataset (customers, payments, subscriptions, audit log,
              alerts). See the <code className="font-mono">/api/platform/admin/notifications</code>{' '}
              route header for the production persistence design.
            </p>
          </div>
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
