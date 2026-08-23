'use client';

import React, { useCallback, useMemo, useState } from 'react';
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
  Loader2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PageHeader, ConfirmDialog } from '@/components/patterns';
import { getApi, postApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const PAGE_SIZE = 25;

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
          <p
            className={cn(
              'text-sm text-muted-foreground mt-1 line-clamp-2',
              !notification.isRead && 'text-foreground/70',
            )}
          >
            {notification.message}
          </p>
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

// ==================== Main Notifications Page ====================

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  // Comment Notifications setting (moved from Discussion settings)
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
    onMutate: (enabled) => {
      queryClient.setQueryData<Record<string, string>>(['settings', 'discussion', 'comment-notification'], (prev) => ({ ...(prev ?? {}), comment_notification: String(enabled) }));
    },
    onSuccess: () => {
      toast.success(`Comment notifications ${commentNotifsOn ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update setting');
      queryClient.invalidateQueries({ queryKey: ['settings', 'discussion', 'comment-notification'] });
    },
  });

  // Build query params based on filter
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { pageSize: PAGE_SIZE };
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
    staleTime: 10_000,
  });

  // Flatten all pages
  const allNotifications = useMemo(
    () => data?.pages.flatMap((p) => p?.data ?? []) ?? [],
    [data],
  );

  const totalPages = data?.pages[0]?.meta?.pagination?.totalPages ?? 0;
  const totalItems = data?.pages[0]?.meta?.pagination?.total ?? 0;

  // Unread count for badge
  const { data: unreadCountData } = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => getApi<{ count: number }>('/api/notifications/unread-count'),
    staleTime: 15_000,
  });
  const unreadCount = unreadCountData?.count ?? 0;

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => postApi('/api/notifications', { notificationIds: [id] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => {
      const ids = allNotifications
        .filter((n) => !n.isRead)
        .map((n) => n.id);
      return postApi('/api/notifications', { notificationIds: ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const handleMarkRead = useCallback(
    (id: string) => markReadMutation.mutate(id),
    [markReadMutation],
  );

  // Delete ALL notifications
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
            : 'No unread notifications'
        }
        action={
          <div className="flex items-center gap-3">
            {/* Comment Notifications toggle (moved from Discussion settings) */}
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

      {/* Filter tabs */}
      <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as NotificationFilter)}>
        <TabsList className="flex-wrap h-auto gap-1">
          {FILTER_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-3">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Notification list */}
      <div className="space-y-2">
        {isLoading && allNotifications.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold">No Notifications</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {activeFilter !== 'all'
                ? `No ${activeFilter.toLowerCase()} notifications found`
                : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {allNotifications.map((notification) => (
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
              {!hasNextPage && allNotifications.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {totalItems} notification{totalItems !== 1 ? 's' : ''} total
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete All Confirmation Dialog */}
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
