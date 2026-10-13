'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Plus, Play, Pause, Copy, Trash2, Pencil, Loader2, CheckCircle2, XCircle, Clock, Activity, CirclePlay, MoreHorizontal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/patterns';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useT } from '@/lib/i18n';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { useSiteStore } from '@/lib/stores/site-store';
import { useSubscriptionStore } from '@/lib/stores/subscription-store';

interface AutomationRow {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  scheduleConfig?: string;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  createdAt: string;
  latestRunStatus?: string | null;
  latestRunId?: string | null;
}

function getScheduleTimezone(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw).timezone;
  } catch {
    return undefined;
  }
}

export function AutomationListPage({ showRunsOnly = false }: { showRunsOnly?: boolean }) {
  const { t } = useT();
  const currentModule = useNavigationStore((s) => s.currentModule);
  const targetMod = currentModule.startsWith('platform-') ? 'platform-automation' : 'automation';
  const navigate = useNavigationStore((s) => s.navigate);
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<AutomationRow | null>(null);

  const isAllSites = useSiteStore((s) => s.isAllSites());
  const activeSiteDbId = useSiteStore((s) => s.activeSiteDbId);
  const currentPlanId = useSubscriptionStore((s) => s.currentPlanId);

  const { data, isLoading } = useQuery({
    queryKey: ['automations', isAllSites ? 'all' : activeSiteDbId, currentPlanId],
    queryFn: () =>
      getApi<AutomationRow[] | { data: AutomationRow[] }>('/api/automations', {
        pageSize: 100,
        ...(!isAllSites && activeSiteDbId ? { siteId: activeSiteDbId } : {}),
      }),
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: (prev) => prev,
  });

  const automations: AutomationRow[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
    ? (data as any).data
    : [];

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => {
      setTogglingId(id);
      return patchApi<AutomationRow>(`/api/automations/${id}`, { status });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automation', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(
        vars.status === 'PAUSED'
          ? 'Automation paused. Future scheduled executions are suspended.'
          : 'Automation resumed. Scheduled runs are active.'
      );
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update automation status'),
    onSettled: () => setTogglingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/automations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setDeleteTarget(null);
      toast.success(t('automation.deleted'));
    },
  });

  const totalActive = automations.filter((a: AutomationRow) => a.status === 'ACTIVE').length;
  const totalScheduled = automations.filter((a: AutomationRow) => a.triggerType === 'SCHEDULED').length;
  const totalCompleted = automations.reduce((sum: number, a: AutomationRow) => sum + a.successfulRuns, 0);
  const totalFailed = automations.reduce((sum: number, a: AutomationRow) => sum + a.failedRuns, 0);

  const statCards = [
    { label: t('automation.totalAutomations'), value: automations.length, icon: Zap, color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
    { label: t('common.active'), value: totalActive, icon: CheckCircle2, color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' },
    { label: t('automation.scheduled'), value: totalScheduled, icon: Clock, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    { label: t('automation.completedRuns'), value: totalCompleted, icon: Activity, color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' },
    { label: t('automation.failedRuns'), value: totalFailed, icon: XCircle, color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t('title.automation')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('automation.description')}</p>
        </div>
        <Button onClick={() => navigate(targetMod, null, 'create')} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('automation.createAutomation')}
        </Button>
      </div>

      {/* Stat Cards */}
      {!showRunsOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {isLoading && !automations.length ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
            ))
          ) : (
            statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="p-4 relative">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{stat.label}</p>
                  <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                  <div className={cn('absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-lg', stat.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.name')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('automation.trigger')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.status')}</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('automation.lastRun')}</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Article</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && !automations.length ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>)}
                    </tr>
                  ))
                ) : automations.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center">
                    <Zap className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-medium">{t('automation.noAutomations')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('automation.emptyHint')}</p>
                  </td></tr>
                ) : automations.map((a: AutomationRow) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(targetMod, a.id, 'details')}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{a.name}</p>
                      {a.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{a.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('border-transparent', a.triggerType === 'SCHEDULED' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300')}>
                        {a.triggerType === 'SCHEDULED' ? t('automation.scheduled') : t('automation.manual')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('border-transparent', a.status === 'ACTIVE' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : a.status === 'PAUSED' ? 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>
                        {a.status === 'ACTIVE' ? t('common.active') : a.status === 'PAUSED' ? t('automation.paused') : a.status}
                      </Badge>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-xs text-muted-foreground">{a.lastRunAt ? formatRelativeTime(a.lastRunAt, getScheduleTimezone(a.scheduleConfig)) : t('automation.never')}</td>
                    <td className="hidden lg:table-cell px-4 py-3 text-xs text-muted-foreground">{a.status === 'PAUSED' ? 'Automation paused' : a.nextRunAt ? formatRelativeTime(a.nextRunAt, getScheduleTimezone(a.scheduleConfig)) : '—'}</td>                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {a.latestRunStatus === 'RUNNING' && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 mr-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Running</span>
                          </span>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              aria-label="More actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => navigate(targetMod, a.id, 'edit')}
                              className="gap-2 cursor-pointer text-xs"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>Edit Automation</span>
                            </DropdownMenuItem>

                            {a.status === 'ACTIVE' ? (
                              <DropdownMenuItem
                                onClick={() => toggleMutation.mutate({ id: a.id, status: 'PAUSED' })}
                                disabled={togglingId === a.id || toggleMutation.isPending}
                                className="gap-2 cursor-pointer text-xs"
                              >
                                {togglingId === a.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : (
                                  <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <span>Pause Automation</span>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => toggleMutation.mutate({ id: a.id, status: 'ACTIVE' })}
                                disabled={togglingId === a.id || toggleMutation.isPending}
                                className="gap-2 cursor-pointer text-xs"
                              >
                                {togglingId === a.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : (
                                  <Play className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <span>Resume Automation</span>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => navigate(targetMod, a.id, 'details')}
                              className="gap-2 cursor-pointer text-xs"
                            >
                              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>View Run History</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(a)}
                              disabled={deleteMutation.isPending}
                              className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete Automation</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('automation.deleteAutomation')}
        description={deleteTarget ? `${t('automation.deleteConfirm')} "${deleteTarget.name}"${t('automation.deleteConfirmSuffix')}` : undefined}
        confirmLabel={t('common.delete')}
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
