'use client';

// ============================================================
// PLATFORM NOTIFICATIONS — event notification configuration.
// ============================================================
// Surfaces the existing Notification system at the platform level.
// Event-driven notification routing (which events notify whom) is
// managed via the notification event config; per-user preferences
// live in UserNotificationPreference. Reuses /api/notifications.
// Visual language mirrors the Client Dashboard Notifications page
// (same Card / Badge / Skeleton / EmptyState patterns, same spacing).
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  StatusBadge,
} from '@/components/patterns';
import { ErrorState, formatRelative } from '@/modules/platform/shared';
import { cn } from '@/lib/utils';

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

// Mirrors the Client Dashboard Notifications type icon — same shape, same colors.
const TYPE_ICON: Record<string, { icon: React.ReactNode; color: string }> = {
  INFO: { icon: <Info className="h-5 w-5" />, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  SUCCESS: { icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  WARNING: { icon: <AlertTriangle className="h-5 w-5" />, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  ERROR: { icon: <XCircle className="h-5 w-5" />, color: 'text-red-500 bg-red-500/10 border-red-500/20' },
  ACTION_REQUIRED: { icon: <Bell className="h-5 w-5" />, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
};

export function PlatformNotificationsModule() {
  const notificationsQuery = useQuery({
    queryKey: ['platform-notifications'],
    queryFn: () => getApi<{ data: NotificationRow[] } | NotificationRow[]>('/api/notifications?pageSize=20'),
    retry: false,
  });

  const raw = notificationsQuery.data;
  const list: NotificationRow[] = Array.isArray(raw) ? raw : ((raw as { data?: NotificationRow[] })?.data ?? []);

  return (
    <div className="space-y-6">
      {/* ==================== Page Header (Client Dashboard style) ==================== */}
      <PageHeader
        breadcrumbs={false}
        title="Notifications"
        description="Platform event notifications. Configure which events generate alerts and how they are delivered."
      />

      {/* ==================== Notification Events ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notification Events</CardTitle>
          <CardDescription className="text-xs">
            Supported event types. Routing + per-user preferences are stored in the existing Notification tables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EVENT_TYPES.map((e) => (
              <div
                key={e.key}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-full border shrink-0 bg-muted text-muted-foreground">
                  <Bell className="h-4 w-4" />
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
              Per-event channel routing (in-app / email) and recipient selection are integration points ready for a real
              provider — the event types and storage already exist.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ==================== Recent Platform Notifications ==================== */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-base font-semibold">Recent Platform Notifications</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Latest events emitted across the platform.</p>
          </div>
        </div>
        <div className="p-2">
          {notificationsQuery.isLoading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : notificationsQuery.isError ? (
            <ErrorState
              message="Unable to load notifications (the notifications API may be site-scoped)."
              onRetry={() => notificationsQuery.refetch()}
            />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No recent notifications"
              description="When platform events fire they will appear here."
            />
          ) : (
            <div className="divide-y">
              {list.map((n) => {
                const cfg = TYPE_ICON[n.type] ?? TYPE_ICON.INFO;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-2 py-3 transition-colors hover:bg-accent/30',
                      !n.isRead && 'bg-primary/[0.02]',
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center h-10 w-10 rounded-full border shrink-0',
                        cfg.color,
                      )}
                    >
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={cn('text-sm font-medium truncate', !n.isRead && 'font-semibold')}>
                          {n.title}
                        </h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {n.channel && (
                          <Badge variant="outline" className="text-[10px]">
                            {n.channel}
                          </Badge>
                        )}
                        {n.type && <StatusBadge status={n.type} size="sm" />}
                        {!n.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" aria-label="Unread" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
