'use client';

import React, { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Loader2, ChevronRight, Info, CheckCircle2,
  AlertTriangle, XCircle, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfirmDialog } from '@/components/patterns';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime } from '@/lib/utils';
import { getNotificationDestination, parseHashRoute } from '@/lib/notifications/links';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { toast } from 'sonner';
import type { NotificationType, ApiResponse } from '@/shared/types';

interface NotificationItem {
  id: string; type: NotificationType; title: string; message: string;
  isRead: boolean; createdAt: string; link?: string | null;
}

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  INFO: <Info className="h-3.5 w-3.5" />,
  SUCCESS: <CheckCircle2 className="h-3.5 w-3.5" />,
  WARNING: <AlertTriangle className="h-3.5 w-3.5" />,
  ERROR: <XCircle className="h-3.5 w-3.5" />,
  ACTION_REQUIRED: <Bell className="h-3.5 w-3.5" />,
};
const TYPE_COLOR: Record<NotificationType, string> = {
  INFO: 'text-blue-500 bg-blue-500/10',
  SUCCESS: 'text-emerald-500 bg-emerald-500/10',
  WARNING: 'text-amber-500 bg-amber-500/10',
  ERROR: 'text-red-500 bg-red-500/10',
  ACTION_REQUIRED: 'text-orange-500 bg-orange-500/10',
};

export function NotificationBell() {
  const queryClient = useQueryClient();
  const navigate = useNavigationStore((s) => s.navigate);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const [open, setOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notifications.list({ pageSize: 5, page: 1 }),
    queryFn: () => getApi<ApiResponse<NotificationItem[]>>('/api/notifications', { pageSize: 5, page: 1 }, { raw: true }),
    staleTime: 5_000,
  });
  const { data: unreadCountData } = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => getApi<{ count: number }>('/api/notifications/unread-count'),
    staleTime: 5_000, refetchInterval: 30_000,
  });

  const allNotifications = data?.data ?? [];
  const unreadCount = unreadCountData?.count ?? 0;
  const notifications = allNotifications.filter((n) => !dismissedIds.has(n.id));
  const dropdownUnreadCount = notifications.filter((n) => !n.isRead).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => postApi('/api/notifications', { notificationIds: [id] }),
    onMutate: (id: string) => {
      queryClient.setQueryData(queryKeys.notifications.list({ pageSize: 5, page: 1 }), (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((n: NotificationItem) => n.id === id ? { ...n, isRead: true } : n) };
      });
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), (old: any) => ({ count: Math.max(0, (old?.count ?? 0) - 1) }));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }); },
  });

  const handleNotificationClick = useCallback((notification: NotificationItem) => {
    if (!notification.isRead) markReadMutation.mutate(notification.id);
    const dest = getNotificationDestination(notification.link, notification.title);
    if (dest) {
      const { mod, itemId, subPage } = parseHashRoute(dest);
      navigate(mod, itemId, subPage);
      closeMobile();
      setOpen(false);
    }
  }, [markReadMutation, navigate, closeMobile]);

  const handleViewAll = useCallback(() => {
    setOpen(false);
    setTimeout(() => {
      navigate('notifications');
      closeMobile();
    }, 50);
  }, [navigate, closeMobile]);

  const handleClearAllConfirm = () => {
    setDismissedIds(new Set(allNotifications.map((n) => n.id)));
    setClearAllDialogOpen(false);
    setOpen(false);
    toast.success('Notifications cleared from dropdown');
  };

  const handleClearAllClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setClearAllDialogOpen(true);
  }, []);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-8 w-8">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {dropdownUnreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">{dropdownUnreadCount} unread</Badge>
              )}
            </div>
            {notifications.length > 0 && (
              <button type="button" onClick={handleClearAllClick}
                className="flex items-center gap-1 text-[10px] font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                <Trash2 className="h-3 w-3" /> Clear All
              </button>
            )}
          </div>
          <DropdownMenuSeparator className="m-0" />
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-xs font-medium">No notifications</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">You're all caught up!</p>
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="flex flex-col">
                {notifications.map((notification) => {
                  const icon = TYPE_ICON[notification.type] ?? TYPE_ICON.INFO;
                  const color = TYPE_COLOR[notification.type] ?? TYPE_COLOR.INFO;
                  return (
                    <button key={notification.id} onClick={() => handleNotificationClick(notification)}
                      className={cn('flex items-start gap-2.5 w-full text-left px-3 py-2.5 transition-colors hover:bg-accent/70 active:bg-accent border-b last:border-0',
                        !notification.isRead && 'bg-primary/[0.04]')}>
                      <div className={cn('flex items-center justify-center h-7 w-7 rounded-full shrink-0', color)}>{icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className={cn('text-xs font-medium truncate', !notification.isRead && 'font-semibold')}>{notification.title}</p>
                          {!notification.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{notification.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{formatRelativeTime(notification.createdAt)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          <div className="relative z-10 border-t bg-muted">
            <button type="button" onClick={handleViewAll}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm font-medium text-primary hover:bg-muted/80 active:bg-accent transition-colors">
              View All <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}
        title="Clear Notifications"
        description="This will dismiss all notifications from this dropdown view. They will still be available on the full Notifications page. Use Delete All on that page to permanently remove them."
        confirmLabel="Clear" variant="destructive"
        onConfirm={handleClearAllConfirm} isLoading={false} />
    </>
  );
}
