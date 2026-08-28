'use client';

// ============================================================
// PLATFORM SYSTEM HEALTH — real infrastructure monitoring.
// ============================================================
// Every status, latency, and metric on this page is sourced from
// /api/platform/admin/system-health which runs REAL checks against
// the database (SELECT 1, Media aggregate, QueueJob groupBy,
// SmtpSetting/AiProvider persisted state), the local filesystem
// (write probe to public/uploads), and the ErrorLog / SystemMetric
// tables. Nothing is mocked, and no service is reported as
// "Operational" unless a real check actually succeeded.
//
// The Overview page's System Health summary reads the SAME checker
// (the overview API route overlays getSystemHealthSummary() onto the
// overview response) so the two views can never disagree about a
// service's status.
// ============================================================

import React, { useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  RefreshCw, Loader2, Server, Database, HardDrive, Briefcase,
  Mail, Sparkles, HeartPulse, AlertTriangle, CheckCircle2,
  XCircle, HelpCircle, Clock, ChevronRight, AlertCircle, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PlatformPageHeader, HealthBadge, ErrorState, EmptyState,
  formatRelative,
} from './shared';
import type {
  HealthSnapshot, ServiceHealthCheck, ServiceStatus,
  ServiceHealthKey, HealthIncident, HealthHistoryRow,
} from '@/lib/platform/system-health';

// -------------------- Module --------------------

export function PlatformSystemHealthModule() {
  const queryKey = ['platform-system-health'];
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<HealthSnapshot>({
    queryKey,
    queryFn: async () => getApi<HealthSnapshot>('/api/platform/admin/system-health'),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const [selectedKey, setSelectedKey] = useState<ServiceHealthKey | null>(null);

  // Refresh checks = explicit POST to the same endpoint (re-runs the
  // live checks and records a fresh history snapshot if the per-minute
  // throttle has elapsed). Loading state, prevents duplicate requests,
  // surfaces success/error via toast, and updates the cached snapshot
  // in place so the UI refreshes without a full reload.
  const refreshMutation = useMutation({
    mutationFn: () => postApi<HealthSnapshot>('/api/platform/admin/system-health'),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(queryKey, snapshot);
      toast.success('Health checks refreshed.');
    },
    onError: () => {
      toast.error('Could not refresh health checks. Please try again.');
    },
  });

  const handleRefresh = () => {
    if (refreshMutation.isPending) return;
    refreshMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="System Health" subtitle="Real-time platform infrastructure monitoring." />
        <PageSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="System Health" subtitle="Real-time platform infrastructure monitoring." />
        <Card>
          <CardContent className="p-6">
            <ErrorState
              message="Could not run health checks. Please retry."
              onRetry={() => refetch()}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedService = selectedKey
    ? data.services.find((s) => s.key === selectedKey) ?? null
    : null;

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="System Health"
        subtitle="Real-time platform infrastructure monitoring."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
            className="h-8"
          >
            {refreshMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Checking…
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Refresh checks
              </>
            )}
          </Button>
        }
      />

      {/* Overall summary */}
      <OverallSummaryCard snapshot={data} />

      {/* Service cards */}
      <section className="space-y-3">
        <SectionHeading
          title="Services"
          description="Click any service to inspect its metrics, recent health checks, and recent errors."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.services.map((svc) => (
            <ServiceCard
              key={svc.key}
              svc={svc}
              onInspect={() => setSelectedKey(svc.key)}
            />
          ))}
        </div>
      </section>

      {/* Recent incidents */}
      <RecentIncidentsCard incidents={data.incidents} />

      {/* Health check history */}
      <HealthHistoryCard history={data.history} />

      {/* Service details sheet */}
      <ServiceDetailsSheet
        service={selectedService}
        onOpenChange={(open) => { if (!open) setSelectedKey(null); }}
      />
    </div>
  );
}

// -------------------- Overall summary card --------------------

function OverallSummaryCard({ snapshot }: { snapshot: HealthSnapshot }) {
  const overallConfig = OVERALL_CONFIG[snapshot.overall];
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
                overallConfig.cls,
              )}
            >
              <HeartPulse className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-lg font-bold tracking-tight">{overallConfig.label}</p>
                <Badge className={cn('text-[10px] font-semibold border-0', overallConfig.badgeCls)}>
                  {snapshot.overall === 'operational'
                    ? 'Operational'
                    : snapshot.overall === 'degraded'
                      ? 'Degraded'
                      : 'Major outage'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {snapshot.healthyCount} of {snapshot.totalCount} services healthy
                <span className="mx-1.5">·</span>
                Last checked {formatRelative(snapshot.lastCheckedAt)}
              </p>
            </div>
          </div>

          {/* Per-service legend strip */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {snapshot.services.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <StatusDot status={s.status} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const OVERALL_CONFIG: Record<
  HealthSnapshot['overall'],
  { label: string; cls: string; badgeCls: string }
> = {
  operational: {
    label: 'All systems operational',
    cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  },
  degraded: {
    label: 'Platform degraded',
    cls: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  },
  major_outage: {
    label: 'Major outage',
    cls: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
    badgeCls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
  },
};

// -------------------- Service card --------------------

const SERVICE_ICON: Record<ServiceHealthKey, React.ReactNode> = {
  api: <Server className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  storage: <HardDrive className="h-4 w-4" />,
  jobs: <Briefcase className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  ai: <Sparkles className="h-4 w-4" />,
};

const STATUS_BORDER: Record<ServiceStatus, string> = {
  operational: 'border-l-emerald-500',
  degraded: 'border-l-amber-500',
  down: 'border-l-rose-500',
  unknown: 'border-l-zinc-400',
};

function ServiceCard({ svc, onInspect }: { svc: ServiceHealthCheck; onInspect: () => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onInspect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInspect(); } }}
      className={cn(
        'border-l-4 cursor-pointer transition-shadow hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        STATUS_BORDER[svc.status],
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-muted-foreground">{SERVICE_ICON[svc.key]}</span>
            <p className="text-sm font-semibold truncate">{svc.label}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        <HealthBadge status={svc.status} />

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {svc.latencyMs !== null ? `${svc.latencyMs}ms · ` : ''}
            Checked {formatRelative(svc.lastCheckedAt)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{svc.message}</p>

        {/* Compact key metrics — show the first 2 only to keep cards scannable */}
        {svc.metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 border-t border-border/60">
            {svc.metrics.slice(0, 4).map((m) => (
              <div key={m.label} className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 truncate">{m.label}</p>
                <p className="text-xs font-medium truncate" title={m.hint ?? m.value}>{m.value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Service details sheet --------------------

function ServiceDetailsSheet({
  service, onOpenChange,
}: {
  service: ServiceHealthCheck | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={service !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {service && (
          <>
            <SheetHeader className="pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{SERVICE_ICON[service.key]}</span>
                <SheetTitle className="text-base">{service.label}</SheetTitle>
              </div>
              <SheetDescription className="sr-only">Service diagnostic details</SheetDescription>
              <div className="flex items-center gap-2 mt-2">
                <HealthBadge status={service.status} />
                <span className="text-xs text-muted-foreground">
                  Last checked {formatRelative(service.lastCheckedAt)}
                </span>
              </div>
            </SheetHeader>

            <div className="px-4 py-4 space-y-5">
              {/* Status message */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">Health message</p>
                <p className="text-sm leading-relaxed">{service.message}</p>
              </div>

              {/* Last error */}
              {service.lastError && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-0.5">Last error</p>
                      <p className="text-xs font-mono break-all leading-relaxed">{service.lastError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Metrics */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-2">Metrics</p>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {service.metrics.map((m) => (
                    <div key={m.label} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        {m.hint && <p className="text-[10px] text-muted-foreground/70 truncate">{m.hint}</p>}
                      </div>
                      <p className="text-xs font-medium text-right" title={m.value}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category + diagnostics summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Category</p>
                  <p className="text-xs font-medium capitalize mt-0.5">{service.category}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Response time</p>
                  <p className="text-xs font-medium mt-0.5">
                    {service.latencyMs !== null ? `${service.latencyMs}ms` : 'Not measured'}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Tip: open the relevant settings page (SMTP Settings, AI Providers,
                Background Jobs) to re-run provider-level health checks.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// -------------------- Recent incidents --------------------

function RecentIncidentsCard({ incidents }: { incidents: HealthIncident[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Incidents</CardTitle>
        <CardDescription className="text-xs mt-0.5">
          Unresolved or recently resolved errors from the platform ErrorLog (last 7 days).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {incidents.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            message="No recent incidents — the platform has been stable."
          />
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <IncidentRow key={inc.id} inc={inc} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IncidentRow({ inc }: { inc: HealthIncident }) {
  const sevMap = {
    info: { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border-0', icon: <AlertCircle className="h-3.5 w-3.5" /> },
    warning: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-0', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    critical: { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-0', icon: <XCircle className="h-3.5 w-3.5" /> },
  };
  const s = sevMap[inc.severity];

  const statusMap = {
    investigating: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-0', label: 'Investigating' },
    degraded: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-0', label: 'Degraded' },
    resolved: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0', label: 'Resolved' },
  };
  const st = statusMap[inc.status];

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 shrink-0">
        <Badge className={cn('text-[10px] font-semibold capitalize', s.cls)}>
          {s.icon}
          <span className="ml-1">{inc.severity}</span>
        </Badge>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{inc.serviceName}</p>
          <Badge variant="outline" className={cn('text-[10px] font-semibold', st.cls)}>{st.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed break-words">{inc.description}</p>
        <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px] text-muted-foreground/80">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Started {formatRelative(inc.startedAt)}
          </span>
          {inc.resolvedAt && (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Resolved {formatRelative(inc.resolvedAt)}
            </span>
          )}
          {inc.durationSec !== null && (
            <span className="inline-flex items-center gap-1">
              Duration {formatDurationLocal(inc.durationSec)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------- Health check history --------------------

function HealthHistoryCard({ history }: { history: HealthHistoryRow[] }) {
  const columns: { key: keyof Omit<HealthHistoryRow, 'timestamp'>; label: string }[] = [
    { key: 'api', label: 'API' },
    { key: 'database', label: 'Database' },
    { key: 'storage', label: 'Storage' },
    { key: 'jobs', label: 'Jobs' },
    { key: 'email', label: 'Email' },
    { key: 'ai', label: 'AI' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Health Check History</CardTitle>
        <CardDescription className="text-xs mt-0.5">
          Recorded snapshots from past health checks (one row per check run).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-5 w-5 opacity-60" />}
            message={'No health-check history yet. Click "Refresh checks" — each run records a snapshot so history builds up over time.'}
          />
        ) : (
          <ScrollArea className="max-h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs w-32">Time</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c.key} className="h-8 text-xs text-center">{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.timestamp}>
                    <TableCell className="text-xs text-muted-foreground py-2">
                      {formatRelative(row.timestamp)}
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.key} className="text-center py-2">
                        <StatusGlyph status={row[c.key]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Small primitives --------------------

function StatusDot({ status }: { status: ServiceStatus }) {
  const cls = {
    operational: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    down: 'bg-rose-500',
    unknown: 'bg-zinc-400',
  }[status];
  return <span className={cn('h-1.5 w-1.5 rounded-full', cls)} aria-hidden />;
}

function StatusGlyph({ status }: { status: ServiceStatus }) {
  const map = {
    operational: { icon: <CheckCircle2 className="h-3.5 w-3.5 mx-auto text-emerald-500" />, label: 'OK' },
    degraded: { icon: <AlertTriangle className="h-3.5 w-3.5 mx-auto text-amber-500" />, label: 'Degraded' },
    down: { icon: <XCircle className="h-3.5 w-3.5 mx-auto text-rose-500" />, label: 'Down' },
    unknown: { icon: <HelpCircle className="h-3.5 w-3.5 mx-auto text-zinc-400" />, label: 'Unknown' },
  }[status];
  return (
    <span className="inline-flex" title={map.label} aria-label={map.label}>
      {map.icon}
    </span>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// Format a duration in seconds into a human-readable string (e.g.
// "45s", "3m 12s", "2h 5m"). Inlined here so the client bundle does
// not pull the server-only system-health module.
function formatDurationLocal(sec: number | null): string {
  if (sec === null || sec < 0) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

// -------------------- Loading skeleton --------------------

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* overall */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </CardContent>
      </Card>
      {/* services */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-40" />
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-border/60">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* incidents */}
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-4 w-32" /></CardHeader>
        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
      {/* history */}
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-4 w-36" /></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    </div>
  );
}
