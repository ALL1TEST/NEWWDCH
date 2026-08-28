'use client';

// ============================================================
// PLATFORM NOTIFICATIONS — event notification configuration.
// ============================================================
// Surfaces the existing Notification system at the platform level.
// Event-driven notification routing (which events notify whom) is
// managed via the notification event config; per-user preferences
// live in UserNotificationPreference. Reuses /api/notifications.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Info } from 'lucide-react';
import { PlatformPageHeader, ErrorState, EmptyState, formatRelative } from '@/modules/platform/shared';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  isRead: boolean;
  createdAt: string;
}

const EVENT_TYPES = [
  { key: 'new_customer', label: 'New customer registered' },
  { key: 'payment_success', label: 'Successful payment' },
  { key: 'payment_failed', label: 'Failed payment' },
  { key: 'subscription_cancelled', label: 'Subscription cancelled' },
  { key: 'subscription_upgraded', label: 'Subscription upgraded / downgraded' },
  { key: 'trial_ending', label: 'Trial ending soon' },
  { key: 'usage_limit_reached', label: 'Usage limit reached' },
  { key: 'backup_failed', label: 'Backup failed' },
  { key: 'backup_completed', label: 'Backup completed' },
  { key: 'system_error', label: 'System errors' },
];

export function PlatformNotificationsModule() {
  const notificationsQuery = useQuery({
    queryKey: ['platform-notifications'],
    queryFn: () => getApi<{ data: NotificationRow[] } | NotificationRow[]>('/api/notifications?pageSize=20'),
    retry: false,
  });

  const raw = notificationsQuery.data;
  const list: NotificationRow[] = Array.isArray(raw) ? raw : ((raw as { data?: NotificationRow[] })?.data ?? []);

  return (
    <div className="space-y-4">
      <PlatformPageHeader
        title="Notifications"
        subtitle="Platform event notifications. Configure which events generate alerts and how they are delivered."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notification Events</CardTitle>
          <CardDescription className="text-xs">Supported event types. Routing + per-user preferences are stored in the existing Notification tables.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EVENT_TYPES.map((e) => (
              <div key={e.key} className="flex items-center gap-2 rounded-md border p-2">
                <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.label}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{e.key}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2.5 mt-3">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">Per-event channel routing (in-app / email) and recipient selection are integration points ready for a real provider — the event types and storage already exist.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Platform Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {notificationsQuery.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : notificationsQuery.isError ? (
            <ErrorState message="Unable to load notifications (the notifications API may be site-scoped)." onRetry={() => notificationsQuery.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState message="No recent notifications." icon={<Bell className="h-5 w-5 opacity-50" />} />
          ) : (
            <div className="divide-y">
              {list.map((n) => (
                <div key={n.id} className="flex items-start justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      <Badge variant="outline" className="text-[10px]">{n.channel}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.message}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatRelative(n.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
