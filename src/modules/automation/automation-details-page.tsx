'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Zap,
  FileText,
  Sparkles,
  Send,
  ChevronRight,
  Clock,
  CheckCircle2,
  Activity,
  Play,
  Pause,
  Loader2,
  Pencil,
  RotateCw,
  ExternalLink,
  AlertCircle,
  Check,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApi, patchApi, postApi } from '@/lib/api-client';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { cn, formatRelativeTime, formatDateTime } from '@/lib/utils';
import { calculateNextRun, formatScheduleTimeTo12Hour, formatUpcomingExecution } from '@/lib/automation/scheduler-utils';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { queryKeys } from '@/lib/query-keys';

interface AutomationDetail {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  scheduleConfig: string;
  workflowConfig: string;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  articlesGenerated?: number;
  createdAt: string;
  updatedAt?: string | null;
  dailyStats?: {
    dailyTarget: number;
    completedToday: number;
    failedToday: number;
    remainingToday: number;
    timezone: string;
  };
  runs: RunRow[];
}

interface RunRow {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  generatedArticleId: string | null;
  generatedArticleName: string | null;
  articleStatus?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  errorMessage: string | null;
  failedStep: string | null;
  logsJson: string;
  createdAt: string;
}

function OutlineApprovalDialog({
  run,
  automationId,
  open,
  onOpenChange,
  onSuccess,
}: {
  run: RunRow | null;
  automationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);

  // Extract outline from run.logsJson
  const { outline, topic, primaryKeyword } = React.useMemo(() => {
    if (!run?.logsJson) return { outline: null, topic: '', primaryKeyword: '' };
    try {
      const logs = JSON.parse(run.logsJson);
      const approvalLog = Array.isArray(logs)
        ? logs.find((l: any) => l.step === 'AWAITING_APPROVAL' || l.outline)
        : null;
      return {
        outline: approvalLog?.outline || null,
        topic: approvalLog?.topic || run.generatedArticleName || '',
        primaryKeyword: approvalLog?.primaryKeyword || '',
      };
    } catch {
      return { outline: null, topic: run.generatedArticleName || '', primaryKeyword: '' };
    }
  }, [run]);

  const [title, setTitle] = React.useState('');
  const [sections, setSections] = React.useState<Array<{ heading: string; keyPoints: string[] }>>([]);

  React.useEffect(() => {
    if (outline) {
      setTitle(outline.title || '');
      setSections(outline.sections || []);
    }
  }, [outline]);

  const handleApprove = async () => {
    if (!run || submitting) return;
    setSubmitting(true);
    try {
      await postApi(`/api/automations/${automationId}/approve-outline`, {
        runId: run.id,
        editedOutline: outline ? { ...outline, title, sections } : undefined,
      });
      toast.success('Outline approved! Article generation resumed.');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve outline');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            <span>Review &amp; Approve Article Outline</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            The automation paused because <strong>Require Outline Approval</strong> is enabled. Review or edit the headings below, then approve to generate the full article.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-lg border bg-muted/40 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Topic:</span>
              <span className="font-semibold text-foreground">{topic || '—'}</span>
            </div>
            {primaryKeyword && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Primary Keyword:</span>
                <span className="font-mono text-foreground">{primaryKeyword}</span>
              </div>
            )}
            {outline?.targetWordCount && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Length:</span>
                <span>~{outline.targetWordCount} words</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Proposed Article Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Outline Sections ({sections.length})</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {sections.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 border rounded text-center">
                  No sections generated yet. You can approve to let the AI proceed.
                </p>
              ) : (
                sections.map((sec, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border bg-card space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground px-1 py-0.5 rounded bg-muted">
                        H2
                      </span>
                      <Input
                        value={sec.heading}
                        onChange={(e) => {
                          const updated = [...sections];
                          updated[idx] = { ...updated[idx], heading: e.target.value };
                          setSections(updated);
                        }}
                        className="h-8 text-xs font-medium"
                      />
                    </div>
                    {sec.keyPoints && sec.keyPoints.length > 0 && (
                      <p className="text-[11px] text-muted-foreground pl-8">
                        Key points: {sec.keyPoints.join(' • ')}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApprove}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Approve &amp; Generate Article
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AutomationDetailsPage({ automationId }: { automationId: string }) {
  const { t } = useT();
  const currentModule = useNavigationStore((s) => s.currentModule);
  const targetMod = currentModule.startsWith('platform-') ? 'platform-automation' : 'automation';
  const targetContentMod = currentModule.startsWith('platform-') ? 'platform-content' : 'content';
  const navigate = useNavigationStore((s) => s.navigate);
  const goBack = useNavigationStore((s) => s.goBack);
  const queryClient = useQueryClient();

  const [approvalOpen, setApprovalOpen] = React.useState(false);
  const [selectedApprovalRun, setSelectedApprovalRun] = React.useState<RunRow | null>(null);
  const [expandedErrorRunIds, setExpandedErrorRunIds] = React.useState<Set<string>>(new Set());

  const toggleExpandError = (runId: string) => {
    setExpandedErrorRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const { data: automationRes, isLoading } = useQuery({
    queryKey: ['automation', automationId],
    queryFn: () => getApi<any>(`/api/automations/${automationId}`),
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: !!automationId,
    refetchInterval: (query) => {
      const res = query.state.data as any;
      const data = res?.data ?? res;
      const hasRunning = data?.runs?.some((r: any) => r.status === 'RUNNING' || r.status === 'PENDING');
      return hasRunning ? 2000 : false;
    },
  });

  const automation: AutomationDetail | undefined = (automationRes as any)?.data ?? automationRes;

  const latestRunStatus = automation?.runs?.[0]?.status;
  React.useEffect(() => {
    if (latestRunStatus === 'COMPLETED') {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    }
  }, [latestRunStatus, queryClient]);

  const toggleMutation = useMutation({
    mutationFn: (newStatus: 'ACTIVE' | 'PAUSED') =>
      patchApi(`/api/automations/${automationId}`, { status: newStatus }),
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['automation', automationId] });
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success(
        newStatus === 'PAUSED'
          ? 'Automation paused. Future scheduled executions are suspended.'
          : 'Automation resumed. Scheduled runs are active.'
      );
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update automation status'),
  });

  const retryMutation = useMutation({
    mutationFn: (runId: string) => postApi(`/api/automations/${automationId}/retry`, { runId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation', automationId] });
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Retry run started successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to retry run'),
  });

  if (isLoading || !automation) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const workflow = JSON.parse(automation.workflowConfig || '{}');
  const schedule = JSON.parse(automation.scheduleConfig || '{}');
  const awaitingRun = automation.runs.find((r) => r.status === 'AWAITING_APPROVAL');

  const tz = schedule.timezone || 'Africa/Casablanca';

  // Format Trigger display in user-friendly 12-hour format with AM/PM
  const formattedTriggerTime = formatScheduleTimeTo12Hour(schedule.time || '09:00');
  const freqLabel = schedule.frequency
    ? schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1).toLowerCase()
    : 'Daily';
  const articlesCount = Math.max(1, Number(schedule.articlesPerDay) || 1);
  const articlesText = `(${articlesCount} ${articlesCount === 1 ? 'article' : 'articles'}/day)`;
  const triggerDisplay = automation.triggerType === 'SCHEDULED'
    ? `${freqLabel} at ${formattedTriggerTime} ${articlesText}`
    : t('automation.manual');

  // Calculate Next Article display formatted using automation timezone and relative day labels
  let nextArticleValue = '—';
  if (automation.status === 'PAUSED') {
    nextArticleValue = 'Automation paused';
  } else if (automation.triggerType !== 'SCHEDULED') {
    nextArticleValue = 'Manual';
  } else {
    let nextDate: Date | null = automation.nextRunAt ? new Date(automation.nextRunAt) : null;
    const now = new Date();
    // If nextRunAt is missing or already in the past, calculate the next valid future occurrence
    if (!nextDate || isNaN(nextDate.getTime()) || nextDate <= now) {
      try {
        nextDate = calculateNextRun(automation.scheduleConfig, now);
      } catch {
        nextDate = null;
      }
    }
    if (nextDate && !isNaN(nextDate.getTime())) {
      nextArticleValue = formatUpcomingExecution(nextDate, tz, now);
    }
  }

  const articlesGeneratedCount =
    automation.articlesGenerated ?? automation.runs.filter((r) => !!r.generatedArticleId).length;
  const successfulArticlesCount =
    automation.successfulRuns ?? automation.runs.filter((r) => r.status === 'COMPLETED').length;
  const failedArticlesCount =
    automation.failedRuns ?? automation.runs.filter((r) => r.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => goBack(targetMod)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{automation.name}</h1>
            <Badge variant="outline" className={cn('border-transparent', automation.status === 'ACTIVE' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : automation.status === 'PAUSED' ? 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' : automation.status === 'AWAITING_APPROVAL' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>{automation.status === 'AWAITING_APPROVAL' ? 'Awaiting Approval' : automation.status}</Badge>
          </div>
          {automation.description && <p className="text-sm text-muted-foreground mt-1">{automation.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(targetMod, automation.id, 'edit')}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Edit Automation
          </Button>
          {automation.status === 'ACTIVE' ? (
            <Button
              onClick={() => toggleMutation.mutate('PAUSED')}
              disabled={toggleMutation.isPending}
              className="gap-2"
            >
              {toggleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              {toggleMutation.isPending ? 'Pausing...' : 'Pause'}
            </Button>
          ) : (
            <Button
              onClick={() => toggleMutation.mutate('ACTIVE')}
              disabled={toggleMutation.isPending}
              className="gap-2"
            >
              {toggleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              {toggleMutation.isPending ? 'Resuming...' : 'Resume'}
            </Button>
          )}
        </div>
      </div>

      {/* Awaiting Approval Banner */}
      {awaitingRun && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Article Outline Awaiting Approval</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                The automation run generated an outline for &ldquo;{awaitingRun.generatedArticleName || 'Topic'}&rdquo; and paused writing.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shrink-0"
            onClick={() => {
              setSelectedApprovalRun(awaitingRun);
              setApprovalOpen(true);
            }}
          >
            <FileText className="h-4 w-4" />
            Review &amp; Approve Outline
          </Button>
        </div>
      )}

      {/* Overview & Execution Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-3.5 flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Article</p>
          <p
            className={cn(
              "text-base sm:text-lg font-bold tracking-tight mt-1 tabular-nums truncate",
              automation.status === 'PAUSED' ? "text-amber-600 dark:text-amber-400 font-semibold text-sm sm:text-base" : "text-foreground"
            )}
            title={nextArticleValue}
          >
            {nextArticleValue}
          </p>
        </Card>
        <Card className="p-3.5 flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Articles Generated</p>
          <p className="text-lg font-bold tabular-nums mt-1 text-foreground">{articlesGeneratedCount}</p>
        </Card>
        <Card className="p-3.5 flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Successful Articles</p>
          <p className="text-lg font-bold tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">{successfulArticlesCount}</p>
        </Card>
        <Card className="p-3.5 flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Failed Articles</p>
          <p className="text-lg font-bold tabular-nums mt-1 text-red-600 dark:text-red-400">{failedArticlesCount}</p>
        </Card>
      </div>

      {/* Workflow Visualization */}
      <Card>
        <CardHeader><CardTitle className="text-sm">{t('automation.details.workflow')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-amber-500" /> <span className="font-medium">{t('automation.details.triggerLabel')}</span> {triggerDisplay}</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-sky-500" /> <span className="font-medium">{t('automation.details.generateLabel')}</span> {workflow.contentGeneration?.generationMode === 'AI_TOPIC_DISCOVERY' ? `AI Internet Research: ${workflow.contentGeneration?.niche || 'Niche'}` : workflow.contentGeneration?.topicQueue ? `Manual Queue (${workflow.contentGeneration.topicQueue.length} topics)` : workflow.contentGeneration?.topic || t('automation.details.untitled')}</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-violet-500" /> <span className="font-medium">{t('automation.details.seoMediaLabel')}</span> {[
            workflow.seoProcessing?.generateSeoTitle && t('automation.details.seoTitle'),
            workflow.seoProcessing?.generateMetaDescription && t('automation.details.metaDescription'),
            workflow.media?.generateFeaturedImage && t('automation.details.featuredImage'),
          ].filter(Boolean).join(', ') || t('automation.builder.previewNone')}</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2 text-sm">
            <Send className="h-4 w-4 text-emerald-500" />
            <span className="font-medium">{t('automation.details.actionLabel')}</span>
            {workflow.finalAction?.action === 'PUBLISH'
              ? t('automation.details.actionPublishImmediately')
              : workflow.finalAction?.action === 'SCHEDULE'
              ? `${t('automation.details.actionSchedule') || 'Schedule'}: ${workflow.finalAction?.publishDate || 'Date TBD'}${workflow.finalAction?.publishTime ? ` at ${formatScheduleTimeTo12Hour(workflow.finalAction.publishTime)}` : ''}`
              : workflow.finalAction?.action === 'REVIEW'
              ? t('automation.details.actionSendToReview')
              : t('automation.details.actionSaveAsDraft')}
          </div>
        </CardContent>
      </Card>

      {/* Execution History */}
      <Card>
        <CardHeader className="py-4 px-5 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('automation.details.automationRuns')}</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {automation.runs.length} {automation.runs.length === 1 ? 'run recorded' : 'runs recorded'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {automation.runs.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium">{t('automation.details.noRunsYet')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('automation.details.noRunsHint')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {automation.runs.map((run) => {
                let detectedTopic = run.generatedArticleName || '';
                try {
                  const logs = JSON.parse(run.logsJson || '[]');
                  const topicLog = logs.find((l: any) => l.topic || l.step === 'topic_selection' || l.step === 'init');
                  if (topicLog?.topic) {
                    detectedTopic = topicLog.topic;
                  } else if (topicLog?.message && topicLog.message.includes('"')) {
                    const match = topicLog.message.match(/"([^"]+)"/);
                    if (match) detectedTopic = match[1];
                  }
                } catch {}

                const displayTitle = detectedTopic || run.generatedArticleName || (run.status === 'FAILED' ? 'Failed Execution' : 'Automated Run');

                const isSuccess = run.status === 'COMPLETED';
                const isFailed = run.status === 'FAILED';
                const isRunning = run.status === 'RUNNING';
                const isAwaiting = run.status === 'AWAITING_APPROVAL';
                const isSkipped = run.status === 'SKIPPED';

                const finalResultLabel =
                  run.articleStatus === 'DRAFT' || (isSuccess && run.generatedArticleId && !run.articleStatus)
                    ? 'Saved to Drafts'
                    : run.articleStatus === 'APPROVED'
                    ? 'Scheduled'
                    : run.articleStatus === 'PUBLISHED'
                    ? 'Published'
                    : null;

                const isErrorExpanded = expandedErrorRunIds.has(run.id);

                return (
                  <div key={run.id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Indicator dot, Main Article Title, Badges & Execution Time */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={cn(
                            'h-2.5 w-2.5 rounded-full mt-1.5 shrink-0',
                            isSuccess
                              ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                              : isFailed
                              ? 'bg-red-500 ring-2 ring-red-500/20'
                              : isRunning
                              ? 'bg-blue-500 animate-pulse'
                              : isAwaiting
                              ? 'bg-amber-500'
                              : isSkipped
                              ? 'bg-amber-400'
                              : 'bg-zinc-400'
                          )}
                          title={isSuccess ? 'Success' : isFailed ? 'Failed' : run.status}
                        />

                        <div className="space-y-1.5 min-w-0 flex-1">
                          {/* Article Title as main element */}
                          <p className="text-sm font-semibold text-foreground tracking-tight truncate leading-snug">
                            {displayTitle}
                          </p>

                          {/* Grouped Status & Outcome Badges + Timestamp */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            {/* Primary Status Badge */}
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[11px] font-semibold px-2 py-0.5 border shadow-none',
                                isSuccess
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : isFailed
                                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400'
                                  : isRunning
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400'
                                  : isAwaiting
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                                  : isSkipped
                                  ? 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {isSuccess ? 'Success' : isFailed ? 'Failed' : isRunning ? 'Running' : isAwaiting ? 'Awaiting Approval' : isSkipped ? 'Skipped' : run.status}
                            </Badge>

                            {/* Secondary Outcome Badge (only when valid outcome exists) */}
                            {finalResultLabel && run.generatedArticleId && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[11px] font-medium px-2 py-0.5 border shadow-none',
                                  run.articleStatus === 'PUBLISHED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : run.articleStatus === 'APPROVED'
                                    ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400'
                                    : 'bg-blue-50/70 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                )}
                              >
                                {finalResultLabel}
                              </Badge>
                            )}

                            {/* Execution Date & Time */}
                            <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1 ml-0.5">
                              <Clock className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                              {run.startedAt ? formatDateTime(run.startedAt, schedule.timezone) : formatDateTime(run.createdAt, schedule.timezone)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 sm:self-center pt-1 sm:pt-0">
                        {run.generatedArticleId ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-medium gap-1.5 border-border hover:bg-primary/5 hover:text-primary hover:border-primary/40 transition-colors shadow-none"
                              onClick={() => navigate(targetContentMod, run.generatedArticleId, 'preview')}
                              title="Preview generated article"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview Article
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-medium gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              onClick={() => navigate(targetContentMod, run.generatedArticleId, 'edit')}
                              title="Edit saved article"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit Article
                            </Button>
                          </>
                        ) : null}

                        {isAwaiting && (
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                            onClick={() => {
                              setSelectedApprovalRun(run);
                              setApprovalOpen(true);
                            }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Review Outline
                          </Button>
                        )}

                        {isFailed && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-8 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground transition-colors",
                                isErrorExpanded && "bg-muted text-foreground"
                              )}
                              onClick={() => toggleExpandError(run.id)}
                              title={isErrorExpanded ? "Hide error details" : "View error details"}
                            >
                              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isErrorExpanded && "rotate-180")} />
                              {isErrorExpanded ? "Hide Error" : "Error Details"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:hover:bg-red-950/40 shadow-none font-medium"
                              onClick={() => retryMutation.mutate(run.id)}
                              disabled={retryMutation.isPending}
                              title="Retry this failed run"
                            >
                              <RotateCw className={cn("h-3.5 w-3.5", retryMutation.isPending && "animate-spin")} />
                              Retry
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expandable Error Details for Failed Runs */}
                    {isFailed && isErrorExpanded && (
                      <div className="mt-3 p-3 rounded-lg border border-red-200/80 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20 text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-red-800 dark:text-red-300">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>Execution Error {run.failedStep ? `(Step: ${run.failedStep})` : ''}</span>
                        </div>
                        <p className="text-red-700 dark:text-red-400 pl-5 leading-relaxed font-mono text-[11px] break-words">
                          {run.errorMessage || 'An error occurred during execution. Check logs for details.'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <OutlineApprovalDialog
        run={selectedApprovalRun}
        automationId={automationId}
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['automation', automationId] });
          queryClient.invalidateQueries({ queryKey: ['automations'] });
        }}
      />
    </div>
  );
}
