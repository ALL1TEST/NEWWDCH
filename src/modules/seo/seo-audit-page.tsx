'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, CheckCircle2, RotateCcw, ExternalLink, ArrowLeft,
  TrendingUp, TrendingDown, Sparkles, AlertCircle, Wrench, ArrowRightLeft,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable, useDataTable,
} from '@/components/patterns';
import { getApi, postApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { useT } from '@/lib/i18n';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSiteStore } from '@/lib/stores/site-store';
import { buildPublicUrl } from '@/lib/seo/url-utils';
import { getFindingFixCapability } from '@/lib/seo/capability';
import { extractRuleId } from '@/lib/seo/verifier';

// -------------------- Types --------------------

interface SeoIssueRow {
  id: string;
  severity: string;
  resourceType: string;
  resourceId: string | null;
  pageUrl: string;
  requestedUrl?: string;
  finalResolvedUrl?: string;
  redirectChain?: { statusCode: number; url: string; location?: string; toUrl?: string }[];
  problem: string;
  recommendation: string;
  isResolved: boolean;
  createdAt: string;
  ruleId?: string;
  pageType?: string;
  intent?: string;
  evidence?: string;
  expectedValue?: string;
  verificationMethod?: string;
  cleanRecommendation?: string;
}

interface AiFixProposal {
  issueId: string;
  contentId: string;
  contentTitle: string;
  slug?: string;
  pageUrl: string;
  ruleId: string;
  targetField: string;
  fieldLabel: string;
  currentContent: string;
  proposedContent: string;
  fullProposedValue: string;
  actionPlan: string;
}

const SEVERITY_STYLES: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  WARNING: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  INFO: { color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30' },
};

const PAGE_TYPE_COLORS: Record<string, string> = {
  ARTICLE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  BLOG_POST: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  ABOUT: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300',
  CONTACT: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  PRIVACY: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  TERMS: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  LEGAL: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  HOME: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
  PRODUCT: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  CATEGORY: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300',
};

// -------------------- URL Cell Component --------------------

function UrlCell({ url }: { url: string }) {
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const fullUrl = buildPublicUrl(url, activeSite);

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1 max-w-full"
      title={fullUrl}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="truncate block max-w-[210px]">{fullUrl}</span>
      <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
    </a>
  );
}

// -------------------- Main Component --------------------

export function SeoAuditPage() {
  const { t } = useT();
  const navigate = useNavigationStore((s) => s.navigate);
  const goBack = useNavigationStore((s) => s.goBack);
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedIssue, setSelectedIssue] = useState<SeoIssueRow | null>(null);
  const [aiFixPreviewOpen, setAiFixPreviewOpen] = useState(false);
  const [aiProposal, setAiProposal] = useState<AiFixProposal | null>(null);

  const table = useDataTable({ initialSortField: 'createdAt', initialSortOrder: 'desc', initialPageSize: DEFAULT_PAGE_SIZE });

  const resetAllFilters = useCallback(() => {
    queryClient.cancelQueries({ queryKey: queryKeys.seoIssues.all });
    queryClient.removeQueries({ queryKey: queryKeys.seoIssues.all });
    table.setSearchValue('');
    setSeverityFilter('all');
    table.setCurrentPage(1);
  }, [queryClient, table]);

  // Main table only displays active (unresolved) findings
  const queryParams = useMemo(() => ({
    page: table.currentPage,
    pageSize: table.pageSize,
    sort: table.sortField,
    order: table.sortOrder,
    search: table.searchValue || undefined,
    severity: severityFilter !== 'all' ? severityFilter : undefined,
    isResolved: 'false',
  }), [table.currentPage, table.pageSize, table.sortField, table.sortOrder, table.searchValue, severityFilter]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.seoIssues.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<SeoIssueRow>>('/api/seo/issues', queryParams),
    staleTime: 10_000,
  });

  const issues = data?.data ?? [];
  const totalItems = data?.pagination?.total ?? 0;

  // Active Issue Counters: strictly count unresolved findings
  const { data: criticalData } = useQuery({
    queryKey: ['seo-issues', 'count', 'CRITICAL', 'false'],
    queryFn: () => getApi<PaginatedResponse<SeoIssueRow>>('/api/seo/issues', { pageSize: 1, isResolved: 'false', severity: 'CRITICAL' }),
    staleTime: 10_000,
  });
  const { data: warningData } = useQuery({
    queryKey: ['seo-issues', 'count', 'WARNING', 'false'],
    queryFn: () => getApi<PaginatedResponse<SeoIssueRow>>('/api/seo/issues', { pageSize: 1, isResolved: 'false', severity: 'WARNING' }),
    staleTime: 10_000,
  });
  const { data: infoData } = useQuery({
    queryKey: ['seo-issues', 'count', 'INFO', 'false'],
    queryFn: () => getApi<PaginatedResponse<SeoIssueRow>>('/api/seo/issues', { pageSize: 1, isResolved: 'false', severity: 'INFO' }),
    staleTime: 10_000,
  });

  const { data: snapshotData, refetch: refetchSnapshots } = useQuery({
    queryKey: ['seo-snapshots'],
    queryFn: () => getApi<{ success: boolean; latestSnapshot?: any; drift?: any }>('/api/seo/snapshots'),
    staleTime: 30_000,
  });

  const auditMutation = useMutation({
    mutationFn: () => postApi<{ success: boolean; data?: any; summary?: any }>('/api/seo/audit'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all });
      queryClient.invalidateQueries({ queryKey: ['seo-issues'] });
      queryClient.invalidateQueries({ queryKey: ['seo-overview'] });
      queryClient.invalidateQueries({ queryKey: ['seo-snapshots'] });
      refetchSnapshots();
      const summary = res?.data?.summary || res?.summary;
      toast.success(
        summary
          ? `Audit complete! Audited ${summary.auditedPagesCount || summary.totalPagesAudited} items on ${summary.connectedSite?.url || 'connected site'}. Score: ${summary.overallScore || summary.averageHealthScore}/100.`
          : t('seo.auditCompleted')
      );
    },
    onError: (err: any) => toast.error(err?.message || t('seo.auditFailed')),
  });

  const [verifyingIssueId, setVerifyingIssueId] = useState<string | null>(null);

  // Verified Resolve Action: re-runs exact SEO rule against live state before resolving
  const verifyResolveMutation = useMutation({
    mutationFn: (id: string) => postApi<{ data: { isResolved: boolean; message: string; currentEvidence?: string; canAutoVerify?: boolean } }>(
      `/api/seo/issues/${id}/verify-resolve`
    ),
    onMutate: (id) => {
      setVerifyingIssueId(id);
    },
    onSuccess: (res: any, id: string) => {
      setVerifyingIssueId(null);
      const result = res?.data ?? res;
      if (result?.isResolved) {
        toast.success(result.message || 'Finding verified and resolved.');
        queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all });
        queryClient.invalidateQueries({ queryKey: ['seo-issues'] });
        queryClient.invalidateQueries({ queryKey: ['seo-overview'] });
        queryClient.invalidateQueries({ queryKey: ['seo-snapshots'] });
        if (selectedIssue?.id === id) {
          setSelectedIssue(null);
        }
      } else {
        const evidenceText = result?.currentEvidence ? ` (${result.currentEvidence})` : '';
        toast.error((result?.message || 'Finding is still unresolved. The SEO check detected the issue again.') + evidenceText);
      }
    },
    onError: (err: any) => {
      setVerifyingIssueId(null);
      toast.error(err?.message || 'Verification failed. Finding remains unresolved.');
    },
  });

  // Technical SEO Auto-Fix Mutation
  const [autoFixingIssueId, setAutoFixingIssueId] = useState<string | null>(null);
  const [autoFixStep, setAutoFixStep] = useState<'applying' | 'verifying' | null>(null);

  const autoFixMutation = useMutation({
    mutationFn: async ({ findingId, ruleId }: { findingId: string; ruleId?: string }) => {
      setAutoFixingIssueId(findingId);
      setAutoFixStep('applying');
      await new Promise((r) => setTimeout(r, 400));
      setAutoFixStep('verifying');
      return postApi<{ data: any }>('/api/seo/auto-fix', { findingId, ruleId });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all });
      queryClient.invalidateQueries({ queryKey: ['seo-issues'] });
      queryClient.invalidateQueries({ queryKey: ['seo-overview'] });
      queryClient.invalidateQueries({ queryKey: ['seo-snapshots'] });

      const data = res?.data ?? res;
      if (data?.isResolved) {
        toast.success(data.message || 'Technical SEO fix applied and verified successfully.');
        setSelectedIssue(null);
      } else {
        toast.warning(data?.message || 'Fix was applied, but the issue is still detected on the public page.', {
          description: data?.explanation,
          duration: 8000,
        });
        if (selectedIssue && data?.explanation) {
          setSelectedIssue({
            ...selectedIssue,
            cleanRecommendation: `${selectedIssue.cleanRecommendation || selectedIssue.recommendation.split('\n\n[RULE_ID]')[0]}\n\n[NOTICE]: ${data.explanation}`,
          });
        }
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to execute technical auto-fix.');
    },
    onSettled: () => {
      setAutoFixingIssueId(null);
      setAutoFixStep(null);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => patchApi(`/api/seo/issues/${id}`, { isResolved: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all });
      queryClient.invalidateQueries({ queryKey: ['seo-issues'] });
      queryClient.invalidateQueries({ queryKey: ['seo-overview'] });
      toast.success(t('seo.issueReopened'));
      setSelectedIssue(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to reopen finding'),
  });

  // AI Proposal Generation: Previews actual changes without applying
  const proposeAiFixMutation = useMutation({
    mutationFn: (issueId: string) => postApi<AiFixProposal>('/api/seo/ai-assist/propose', { issueId }),
    onSuccess: (res: any) => {
      const proposal: AiFixProposal = res?.data ?? res;
      if (proposal && (proposal.issueId || proposal.targetField)) {
        setAiProposal(proposal);
        setSelectedIssue(null); // Dismiss view dialog so AI proposal preview modal displays cleanly without overlay trap
        setAiFixPreviewOpen(true);
        toast.info('AI proposal ready for review.');
      } else {
        toast.error('Failed to parse AI proposal response.');
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to generate AI proposal');
    },
  });

  // AI Fix Apply: Mutates CMS record and re-audits to verify resolution
  const applyAiFixMutation = useMutation({
    mutationFn: (payload: { issueId: string; targetField: string; proposedValue: string }) =>
      postApi<{ isResolved: boolean; message: string }>('/api/seo/ai-assist/apply', payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoIssues.all });
      queryClient.invalidateQueries({ queryKey: ['seo-issues'] });
      queryClient.invalidateQueries({ queryKey: ['seo-overview'] });
      queryClient.invalidateQueries({ queryKey: ['seo-snapshots'] });
      const data = res?.data ?? res;
      const msg = data?.message || 'Changes applied successfully.';
      if (data?.isResolved) {
        toast.success(msg);
      } else {
        toast.warning(msg);
      }
      setAiFixPreviewOpen(false);
      setSelectedIssue(null);
      setAiProposal(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to apply changes');
    },
  });

  // -------------------------------------------------------------------------
  // Main SEO Audit Table Columns (Severity, URL, Page Type, Problem, Actions)
  // -------------------------------------------------------------------------
  const columns = useMemo<ColumnDef<SeoIssueRow>[]>(
    () => [
      {
        id: 'severity',
        header: t('seo.severity', 'Severity'),
        accessorKey: 'severity',
        size: 95,
        cell: ({ row }) => {
          const s = SEVERITY_STYLES[row.original.severity];
          return s
            ? <Badge variant="outline" className={cn('border-transparent font-medium text-[11px]', s.bg, s.color)}>{row.original.severity}</Badge>
            : row.original.severity;
        },
      },
      {
        id: 'pageUrl',
        header: t('seo.url', 'URL'),
        accessorKey: 'pageUrl',
        size: 210,
        cell: ({ row }) => <UrlCell url={row.original.pageUrl} />,
      },
      {
        id: 'pageType',
        header: 'Page Type',
        accessorKey: 'pageType',
        size: 110,
        cell: ({ row }) => {
          const type = row.original.pageType || 'ARTICLE';
          return (
            <Badge variant="outline" className={cn('border-transparent text-[11px] font-semibold tracking-wide', PAGE_TYPE_COLORS[type] || 'bg-muted text-muted-foreground')}>
              {type}
            </Badge>
          );
        },
      },
      {
        id: 'problem',
        header: t('seo.problem', 'Problem'),
        accessorKey: 'problem',
        size: 380,
        cell: ({ row }) => (
          <span
            className="text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors block leading-snug"
            onClick={() => setSelectedIssue(row.original)}
            title={row.original.problem}
          >
            {row.original.problem}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <div className="text-right pr-3 font-medium">{t('common.actions', 'Actions')}</div>,
        size: 160,
        cell: ({ row }) => {
          const isResolved = row.original.isResolved;
          const isVerifying = verifyingIssueId === row.original.id;

          return (
            <div className="flex items-center justify-end gap-1.5 pr-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-medium cursor-pointer"
                onClick={() => setSelectedIssue(row.original)}
              >
                View
              </Button>
              {isResolved ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reopenMutation.mutate(row.original.id)}
                  disabled={reopenMutation.isPending || isVerifying}
                  className="h-8 px-2.5 text-xs font-medium text-muted-foreground gap-1"
                >
                  {reopenMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  {t('seo.reopen', 'Reopen')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => verifyResolveMutation.mutate(row.original.id)}
                  disabled={isVerifying}
                  className="h-8 px-2.5 text-xs font-medium text-foreground border-border hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 gap-1"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Resolve
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [verifyResolveMutation, reopenMutation, verifyingIssueId, t],
  );

  const severityCounts = useMemo(() => {
    return {
      CRITICAL: criticalData?.pagination?.total ?? 0,
      WARNING: warningData?.pagination?.total ?? 0,
      INFO: infoData?.pagination?.total ?? 0,
    };
  }, [criticalData, warningData, infoData]);

  const filterContent = (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center rounded-lg border border-border p-0.5">
        {['all', 'CRITICAL', 'WARNING', 'INFO'].map((f) => (
          <button
            key={f}
            onClick={() => { setSeverityFilter(f); table.setCurrentPage(1); }}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              severityFilter === f
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f === 'all' ? t('seo.all', 'All') : f === 'CRITICAL' ? t('seo.critical', 'Critical') : f === 'WARNING' ? t('seo.warnings', 'Warnings') : t('seo.info', 'Info')}
          </button>
        ))}
      </div>

      {(severityFilter !== 'all' || table.searchValue) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetAllFilters}
          className="text-xs h-8 text-muted-foreground hover:text-foreground"
        >
          {t('seo.resetFilters', 'Reset Filters')}
        </Button>
      )}
    </div>
  );

  const activeConnectedUrl = buildPublicUrl('', activeSite);
  const selectedIssueCapability = selectedIssue ? getFindingFixCapability(selectedIssue) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goBack('seo')}
              className="text-muted-foreground hover:text-foreground -ml-2 h-8 px-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('seo.backToOverview', 'Back to Overview')}
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            {t('seo.auditTitle', 'SEO Audit')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-world page-type & intent-aware crawling connected to{' '}
            <a href={activeConnectedUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-primary underline">
              {activeConnectedUrl}
            </a>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => auditMutation.mutate()}
            disabled={auditMutation.isPending}
            className="gap-2"
          >
            {auditMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Crawling & Auditing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Run SEO Audit
              </>
            )}
          </Button>
        </div>
      </div>

      {snapshotData?.latestSnapshot && (
        <Card className="p-4 bg-muted/20 border-border">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Audit Drift & Health</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold tracking-tight tabular-nums">
                  {snapshotData.latestSnapshot.overallScore ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">/ 100 Health Score</span>
                {snapshotData.drift && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'ml-2 border-transparent font-medium gap-1',
                      snapshotData.drift.scoreDiff > 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : snapshotData.drift.scoreDiff < 0
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {snapshotData.drift.scoreDiff > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : snapshotData.drift.scoreDiff < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : null}
                    {snapshotData.drift.scoreDiff > 0 ? `+${snapshotData.drift.scoreDiff}` : snapshotData.drift.scoreDiff} pts
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Audited {snapshotData.latestSnapshot.auditedPagesCount ?? 0} pages</p>
              <p className="mt-0.5">
                {snapshotData.latestSnapshot.createdAt
                  ? new Date(snapshotData.latestSnapshot.createdAt).toLocaleString()
                  : 'Recent'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Active Unresolved Issue Counters */}
      <div className="grid grid-cols-3 gap-3">
        <Card
          className={cn('p-3 cursor-pointer transition-colors hover:bg-muted/50', severityFilter === 'CRITICAL' && 'ring-2 ring-red-300 dark:ring-red-700')}
          onClick={() => { setSeverityFilter(severityFilter === 'CRITICAL' ? 'all' : 'CRITICAL'); table.setCurrentPage(1); }}
        >
          <p className="text-xs text-red-600 dark:text-red-400">{t('seo.critical', 'Critical')}</p>
          <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{severityCounts.CRITICAL}</p>
        </Card>
        <Card
          className={cn('p-3 cursor-pointer transition-colors hover:bg-muted/50', severityFilter === 'WARNING' && 'ring-2 ring-amber-300 dark:ring-amber-700')}
          onClick={() => { setSeverityFilter(severityFilter === 'WARNING' ? 'all' : 'WARNING'); table.setCurrentPage(1); }}
        >
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('seo.warnings', 'Warnings')}</p>
          <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{severityCounts.WARNING}</p>
        </Card>
        <Card
          className={cn('p-3 cursor-pointer transition-colors hover:bg-muted/50', severityFilter === 'INFO' && 'ring-2 ring-sky-300 dark:ring-sky-700')}
          onClick={() => { setSeverityFilter(severityFilter === 'INFO' ? 'all' : 'INFO'); table.setCurrentPage(1); }}
        >
          <p className="text-xs text-sky-600 dark:text-sky-400">{t('seo.info', 'Info')}</p>
          <p className="text-lg font-bold tabular-nums text-sky-600 dark:text-sky-400">{severityCounts.INFO}</p>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={issues}
        isLoading={isLoading}
        totalItems={totalItems}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        searchPlaceholder={t('seo.searchIssues', 'Search issues...')}
        searchValue={table.searchValue}
        searchClassName="flex-1"
        onSearch={(v) => { table.setSearchValue(v); table.setCurrentPage(1); }}
        getRowId={(row) => row.id}
        emptyMessage={t('seo.auditEmpty', 'No active SEO issues found.')}
        filterContent={filterContent}
      />

      {/* ============================================================ */}
      {/* Simplified, User-Facing Finding View Modal                   */}
      {/* ============================================================ */}
      <Dialog open={!!selectedIssue} onOpenChange={(open) => !open && setSelectedIssue(null)}>
        {selectedIssue && (
          <DialogContent className="sm:max-w-lg max-w-lg w-full bg-white dark:bg-zinc-950 border border-border shadow-xl p-6 rounded-2xl">
            <DialogHeader className="space-y-2.5 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    'border-transparent text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider',
                    SEVERITY_STYLES[selectedIssue.severity]?.bg,
                    SEVERITY_STYLES[selectedIssue.severity]?.color
                  )}
                >
                  {selectedIssue.severity}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'border-transparent text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase',
                    PAGE_TYPE_COLORS[selectedIssue.pageType || 'ARTICLE'] || 'bg-muted text-muted-foreground'
                  )}
                >
                  {selectedIssue.pageType || 'ARTICLE'}
                </Badge>
              </div>

              <div className="space-y-1">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground leading-snug">
                  {selectedIssue.problem}
                </DialogTitle>
                <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                  <a
                    href={buildPublicUrl(selectedIssue.finalResolvedUrl || selectedIssue.pageUrl, activeSite)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-muted-foreground hover:text-foreground inline-flex items-center gap-1 break-all transition-colors"
                  >
                    {buildPublicUrl(selectedIssue.finalResolvedUrl || selectedIssue.pageUrl, activeSite)}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {/* Evidence Section */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  EVIDENCE
                </h4>
                <div className="p-3.5 bg-slate-50/70 dark:bg-zinc-900/50 rounded-xl text-xs text-foreground font-mono leading-relaxed border border-border/80">
                  {selectedIssue.evidence || 'Detected during site crawl.'}
                </div>
              </div>

              {/* Technical Crawl & HTTP Redirect Chain (if redirect occurred) */}
              {selectedIssue.redirectChain && selectedIssue.redirectChain.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" />
                    TECHNICAL CRAWL & REDIRECT METADATA
                  </h4>
                  <div className="p-3 bg-slate-50/70 dark:bg-zinc-900/50 rounded-xl border border-border/80 text-xs font-mono space-y-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-sans font-medium">Requested URL:</span>
                      <p className="text-foreground break-all text-[11px]">
                        {selectedIssue.requestedUrl || selectedIssue.pageUrl}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {selectedIssue.redirectChain.map((hop, idx) => (
                        <React.Fragment key={idx}>
                          <div className="inline-flex items-center gap-1 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded text-[11px]">
                            <span className="font-bold text-sky-700 dark:text-sky-300">HTTP {hop.statusCode}</span>
                            <span className="text-foreground max-w-[140px] truncate">{hop.url.replace(/^https?:\/\/[^/]+/, '') || hop.url}</span>
                          </div>
                          <span className="text-muted-foreground text-xs">→</span>
                        </React.Fragment>
                      ))}
                      <div className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded text-[11px]">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">FINAL</span>
                        <span className="text-emerald-900 dark:text-emerald-200 font-semibold max-w-[140px] truncate">
                          {(selectedIssue.finalResolvedUrl || selectedIssue.pageUrl).replace(/^https?:\/\/[^/]+/, '')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendation Section */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  RECOMMENDATION & HOW TO FIX
                </h4>
                <div className="p-3.5 bg-slate-50/70 dark:bg-zinc-900/50 rounded-xl border border-border/80 text-xs leading-relaxed text-foreground font-sans">
                  {selectedIssue.cleanRecommendation || selectedIssue.recommendation.split('\n\n[RULE_ID]')[0]}
                </div>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-4 border-t border-border/60">
              {/* Left action: Fix Automatically / Fix with AI / Manual Action / Informational */}
              <div>
                {selectedIssueCapability?.capability === 'AUTO_FIXABLE' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 text-xs font-semibold gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary shadow-xs transition-colors"
                    disabled={autoFixingIssueId !== null || verifyingIssueId !== null}
                    onClick={() => {
                      const ruleId = selectedIssue.ruleId || extractRuleId(selectedIssue.recommendation || '', selectedIssue.problem);
                      autoFixMutation.mutate({ findingId: selectedIssue.id, ruleId });
                    }}
                  >
                    {autoFixingIssueId === selectedIssue.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        {autoFixStep === 'applying' ? 'Applying technical SEO fix...' : 'Verifying the updated page...'}
                      </>
                    ) : (
                      <>
                        <Wrench className="h-4 w-4" />
                        Fix Automatically
                      </>
                    )}
                  </Button>
                ) : selectedIssueCapability?.isAiFixable ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 text-xs font-semibold gap-2 border-border hover:bg-muted text-foreground shadow-xs transition-colors"
                    disabled={proposeAiFixMutation.isPending || autoFixingIssueId !== null || verifyingIssueId !== null}
                    onClick={() => proposeAiFixMutation.mutate(selectedIssue.id)}
                  >
                    {proposeAiFixMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-primary" />
                    )}
                    Fix with AI
                  </Button>
                ) : selectedIssueCapability?.requiresManualAction ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                    <AlertCircle className="h-4 w-4" />
                    Manual action required
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground font-medium">
                    {selectedIssueCapability?.label}
                  </div>
                )}
              </div>

              {/* Right actions: Close and Resolve */}
              <div className="flex items-center gap-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-4 text-xs font-medium hover:bg-muted"
                  onClick={() => setSelectedIssue(null)}
                >
                  Close
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 px-4 text-xs font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                  disabled={verifyingIssueId !== null || autoFixingIssueId !== null}
                  onClick={() => verifyResolveMutation.mutate(selectedIssue.id)}
                >
                  {verifyingIssueId === selectedIssue.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Resolve
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ============================================================ */}
      {/* AI Fix Proposal & Diff Preview Dialog (Before/After)         */}
      {/* ============================================================ */}
      <Dialog open={aiFixPreviewOpen} onOpenChange={(open) => {
        if (!open) {
          setAiFixPreviewOpen(false);
          setAiProposal(null);
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-w-3xl w-full bg-white dark:bg-zinc-950 border border-border/80 shadow-2xl p-6 sm:p-8 rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-1.5 text-primary text-xs font-semibold mb-1">
              <Sparkles className="h-4 w-4" />
              AI Fix Proposal
            </div>
            <DialogTitle className="text-base font-bold leading-snug">
              {aiProposal?.actionPlan || 'Proposed Content Optimization'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review proposed changes before applying them. No CMS content will be modified until you confirm.
            </DialogDescription>
          </DialogHeader>

          {aiProposal && (
            <div className="space-y-3 py-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground px-1">
                <span>Target Field: <strong className="text-foreground">{aiProposal.fieldLabel}</strong></span>
                <span>Article: <strong className="text-foreground">{aiProposal.contentTitle}</strong></span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                      Current Content
                    </span>
                  </div>
                  <div className="font-mono text-xs whitespace-pre-wrap break-words bg-background p-2.5 rounded border border-border/80 text-muted-foreground min-h-[90px] max-h-[220px] overflow-y-auto">
                    {aiProposal.currentContent}
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 p-3 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider text-[10px]">
                      Proposed Content
                    </span>
                    <Badge variant="outline" className="border-emerald-300 dark:border-emerald-800 text-[10px] text-emerald-700 dark:text-emerald-400">
                      AI Generated
                    </Badge>
                  </div>
                  <div className="font-mono text-xs whitespace-pre-wrap break-words bg-background p-2.5 rounded border border-emerald-300/60 dark:border-emerald-800/80 text-foreground font-medium min-h-[90px] max-h-[220px] overflow-y-auto">
                    {aiProposal.proposedContent}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs font-medium"
              onClick={() => {
                setAiFixPreviewOpen(false);
                setAiProposal(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={applyAiFixMutation.isPending || !aiProposal}
              onClick={() => {
                if (!aiProposal) return;
                applyAiFixMutation.mutate({
                  issueId: aiProposal.issueId,
                  targetField: aiProposal.targetField,
                  proposedValue: aiProposal.fullProposedValue,
                });
              }}
            >
              {applyAiFixMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Applying Changes...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Apply Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
