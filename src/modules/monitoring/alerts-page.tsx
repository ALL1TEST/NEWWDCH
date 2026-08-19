'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Eye,
  Trash2,
  Loader2,
  Plus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ConfirmDialog,
  PageHeader,
  EmptyState,
} from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime, labelize } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaginatedResponse, AlertStatus, MonitorSeverity, AlertChannel } from '@/shared/types';

// -------------------- Types --------------------

interface AlertRow {
  id: string;
  title: string;
  severity: MonitorSeverity;
  status: AlertStatus;
  metricValue?: number;
  threshold?: number;
  createdAt: string;
  rule?: { id: string; name: string } | null;
}

interface AlertRuleRow {
  id: string;
  name: string;
  metricType: string;
  condition: string;
  threshold: number;
  severity: MonitorSeverity;
  isActive: boolean;
  channels: AlertChannel[];
}

// -------------------- Constants --------------------

const STATUS_COLORS: Record<string, string> = {
  TRIGGERED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  SNOOZED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ALERT_CHANNELS: { value: AlertChannel; label: string }[] = [
  { value: 'IN_APP', label: 'In-App' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WEBHOOK', label: 'Webhook' },
  { value: 'SLACK', label: 'Slack' },
  { value: 'DISCORD', label: 'Discord' },
  { value: 'TELEGRAM', label: 'Telegram' },
];

const CONDITIONS = [
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less or equal' },
  { value: 'eq', label: 'Equal to' },
  { value: 'neq', label: 'Not equal to' },
];

const SEVERITIES: { value: MonitorSeverity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

// -------------------- Alerts Page --------------------

export function AlertsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<AlertRow | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<AlertRuleRow | null>(null);

  // Rule form
  const [ruleForm, setRuleForm] = useState({
    name: '',
    metricType: 'cpu',
    condition: 'gt',
    threshold: 90,
    severity: 'HIGH' as MonitorSeverity,
    channels: ['IN_APP'] as AlertChannel[],
  });

  // Alerts query
  const alertParams: Record<string, string | number | undefined> = {
    page,
    pageSize: 25,
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
  };

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: queryKeys.monitoring.alerts.list(alertParams),
    queryFn: () => getApi<PaginatedResponse<AlertRow>>('/api/monitoring/alerts', alertParams),
    staleTime: 5_000,
  });

  const alerts = alertsData?.data ?? [];
  const alertPagination = alertsData?.pagination;

  // Alert rules query
  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: queryKeys.monitoring.alertRules.list(),
    queryFn: () => getApi<AlertRuleRow[]>('/api/monitoring/alert-rules'),
    staleTime: 10_000,
  });

  const rules = rulesData ?? [];

  // Count stats from first page or compute
  const alertCounts = React.useMemo(() => {
    // We just show the counts as derived from the alerts we have
    // In a real scenario, the API would provide counts
    return {
      total: alertPagination?.total ?? 0,
      triggered: alerts.filter((a) => a.status === 'TRIGGERED').length,
      acknowledged: alerts.filter((a) => a.status === 'ACKNOWLEDGED').length,
      resolved: alerts.filter((a) => a.status === 'RESOLVED').length,
    };
  }, [alerts, alertPagination]);

  // Mutations
  const ackMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/monitoring/alerts/${id}`, { action: 'acknowledge' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.alerts.all }); toast.success('Alert acknowledged'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to acknowledge'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/monitoring/alerts/${id}`, { action: 'resolve' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.alerts.all }); toast.success('Alert resolved'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to resolve'),
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/monitoring/alerts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.alerts.all }); setDeleteTarget(null); toast.success('Alert deleted'); },
    onError: (err: Error) => { setDeleteTarget(null); toast.error(err.message || 'Failed to delete'); },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/monitoring/alert-rules/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.alertRules.all }); setDeleteRuleTarget(null); toast.success('Rule deleted'); },
    onError: (err: Error) => { setDeleteRuleTarget(null); toast.error(err.message || 'Failed to delete rule'); },
  });

  const createRuleMutation = useMutation({
    mutationFn: () => postApi('/api/monitoring/alert-rules', ruleForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.alertRules.all });
      setRuleDialogOpen(false);
      setRuleForm({ name: '', metricType: 'cpu', condition: 'gt', threshold: 90, severity: 'HIGH', channels: ['IN_APP'] });
      toast.success('Alert rule created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create rule'),
  });

  const toggleChannel = (ch: AlertChannel) => {
    setRuleForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch) ? prev.channels.filter((c) => c !== ch) : [...prev.channels, ch],
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Alerts" description="Monitor and manage system alerts and alert rules" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total</p><p className="text-2xl font-bold tabular-nums">{alertCounts.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Triggered</p><p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{alertCounts.triggered}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Acknowledged</p><p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{alertCounts.acknowledged}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Resolved</p><p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{alertCounts.resolved}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="TRIGGERED">Triggered</SelectItem>
            <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="SNOOZED">Snoozed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter || 'all'} onValueChange={(v) => { setSeverityFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts Table */}
      <Card>
        <CardContent className="p-4">
          {alertsLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : alerts.length === 0 ? (
            <EmptyState icon={Bell} title="No alerts" description="No alerts match your filters." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Title</th>
                    <th className="pb-2 pr-4 font-medium">Severity</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Value / Threshold</th>
                    <th className="pb-2 pr-4 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {alerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-accent/50">
                      <td className="py-2.5 pr-4 font-medium truncate max-w-[200px]">{alert.title}</td>
                      <td className="py-2.5 pr-4">
                        <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.MEDIUM)}>
                          {labelize(alert.severity)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', STATUS_COLORS[alert.status] ?? STATUS_COLORS.TRIGGERED)}>
                          {labelize(alert.status)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-xs text-muted-foreground">
                        {alert.metricValue != null && alert.threshold != null
                          ? `${alert.metricValue} / ${alert.threshold}`
                          : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{formatRelativeTime(alert.createdAt)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          {alert.status === 'TRIGGERED' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Acknowledge" onClick={() => ackMutation.mutate(alert.id)} disabled={ackMutation.isPending}>
                              {ackMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {(alert.status === 'TRIGGERED' || alert.status === 'ACKNOWLEDGED' || alert.status === 'SNOOZED') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Resolve" onClick={() => resolveMutation.mutate(alert.id)} disabled={resolveMutation.isPending}>
                              {resolveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Delete" onClick={() => setDeleteTarget(alert)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Pagination */}
      {alertPagination && alertPagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {alertPagination.page} of {alertPagination.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= alertPagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Alert Rules Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Alert Rules</h2>
          <Button size="sm" onClick={() => setRuleDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Rule</Button>
        </div>

        <Card>
          <CardContent className="p-4">
            {rulesLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : rules.length === 0 ? (
              <EmptyState icon={BellRing} title="No alert rules" description="Create rules to automatically trigger alerts." />
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Name</th>
                      <th className="pb-2 pr-4 font-medium">Metric</th>
                      <th className="pb-2 pr-4 font-medium">Condition</th>
                      <th className="pb-2 pr-4 font-medium">Threshold</th>
                      <th className="pb-2 pr-4 font-medium">Severity</th>
                      <th className="pb-2 pr-4 font-medium">Active</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-accent/50">
                        <td className="py-2.5 pr-4 font-medium">{rule.name}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground text-xs">{rule.metricType}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground text-xs">{rule.condition}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{rule.threshold}</td>
                        <td className="py-2.5 pr-4">
                          <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', SEVERITY_COLORS[rule.severity] ?? SEVERITY_COLORS.MEDIUM)}>
                            {labelize(rule.severity)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <Switch checked={rule.isActive} disabled />
                        </td>
                        <td className="py-2.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteRuleTarget(rule)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Alert Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete Alert"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.title}"?` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { if (deleteTarget) deleteAlertMutation.mutate(deleteTarget.id); }}
        isLoading={deleteAlertMutation.isPending}
      />

      {/* Delete Rule Dialog */}
      <ConfirmDialog
        open={!!deleteRuleTarget}
        onOpenChange={(v) => !v && setDeleteRuleTarget(null)}
        title="Delete Rule"
        description={deleteRuleTarget ? `Are you sure you want to delete rule "${deleteRuleTarget.name}"?` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { if (deleteRuleTarget) deleteRuleMutation.mutate(deleteRuleTarget.id); }}
        isLoading={deleteRuleMutation.isPending}
      />

      {/* Create Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={(v) => !v && setRuleDialogOpen(false)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create Alert Rule</DialogTitle>
            <DialogDescription>Define a condition that triggers an alert.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Name</Label>
              <Input id="rule-name" value={ruleForm.name} onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., High CPU Usage" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Metric Type</Label>
                <Select value={ruleForm.metricType} onValueChange={(v) => setRuleForm((p) => ({ ...p, metricType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpu">CPU</SelectItem>
                    <SelectItem value="ram">RAM</SelectItem>
                    <SelectItem value="disk">Disk</SelectItem>
                    <SelectItem value="network">Network</SelectItem>
                    <SelectItem value="queue_length">Queue Length</SelectItem>
                    <SelectItem value="error_rate">Error Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={ruleForm.severity} onValueChange={(v) => setRuleForm((p) => ({ ...p, severity: v as MonitorSeverity }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={ruleForm.condition} onValueChange={(v) => setRuleForm((p) => ({ ...p, condition: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-threshold">Threshold</Label>
                <Input id="rule-threshold" type="number" value={ruleForm.threshold} onChange={(e) => setRuleForm((p) => ({ ...p, threshold: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-2">
                {ALERT_CHANNELS.map((ch) => (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => toggleChannel(ch.value)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-md border transition-colors',
                      ruleForm.channels.includes(ch.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:bg-accent'
                    )}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createRuleMutation.mutate()} disabled={createRuleMutation.isPending || !ruleForm.name.trim()}>
              {createRuleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
