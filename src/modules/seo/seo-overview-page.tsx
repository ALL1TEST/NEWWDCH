'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Globe, FileQuestion, FileX2, Type, Heading, Copy, Unlink,
  FileCode, BarChart3, Shield, ArrowUpRight, AlertTriangle,
  Info, ChevronRight, Navigation, CheckCircle2, XCircle, Eye, ClipboardCheck,
  Link2, Code, RefreshCw, MousePointerClick, TrendingUp, Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, truncate } from '@/lib/utils';
import { useNavigationStore } from '@/lib/stores/navigation-store';

// ==================== Types ====================

interface SeoStats {
  indexedPages: number;
  notIndexed: number;
  missingMetaTitles: number;
  missingMetaDescriptions: number;
  missingH1: number;
  duplicateTitles: number;
  duplicateDescriptions: number;
  brokenLinksCount: number;
  redirectsCount: number;
  missingCanonicals: number;
  canonicalIssues: number;
  sitemapStatus: string;
  sitemapAutoGenerate: boolean;
  sitemapLastGenerated: string | null;
  robotsStatus: string;
  schemaStatus: string;
  overallScore: number;
  searchConsoleConnected: boolean;
}

interface SeoIssue {
  id: string;
  severity: string;
  pageUrl: string;
  problem: string;
  recommendation: string;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SeoOverviewData {
  stats: SeoStats;
  recentIssues: SeoIssue[];
}

interface SearchConsoleSummary {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
}

interface SearchConsoleStatusData {
  connected: boolean;
  connection: { lastSyncAt: string | null } | null;
  summary?: SearchConsoleSummary | null;
  stats?: unknown[];
}

// ==================== Severity Config ====================

const SEVERITY_CONFIG: Record<
  string,
  { color: string; bg: string; icon: React.ElementType }
> = {
  CRITICAL: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', icon: AlertTriangle },
  WARNING: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: AlertTriangle },
  INFO: { color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30', icon: Info },
};

// ==================== Formatters ====================

function formatCompactNumber(n: number | null | undefined): string {
  const num = n ?? 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCtr(n: number | null | undefined): string {
  return `${((n ?? 0) * 100).toFixed(2)}%`;
}

function formatPosition(n: number | null | undefined): string {
  return (n ?? 0).toFixed(1);
}

// ==================== Health Score Ring ====================

function ScoreRing({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;
  const color = clampedScore >= 80 ? 'text-green-500' : clampedScore >= 50 ? 'text-amber-500' : 'text-red-500';
  const bgColor = clampedScore >= 80 ? 'bg-green-100 dark:bg-green-900/20' : clampedScore >= 50 ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-red-100 dark:bg-red-900/20';
  const label = clampedScore >= 80 ? 'Healthy' : clampedScore >= 50 ? 'Needs Work' : 'Critical';
  const labelColor = clampedScore >= 80 ? 'text-green-600 dark:text-green-400' : clampedScore >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="flex flex-col items-center">
      <div className={cn('relative flex items-center justify-center w-36 h-36 rounded-full', bgColor)}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-border/40" />
          <circle
            cx="60" cy="60" r={radius} fill="none" strokeWidth="6" strokeLinecap="round"
            className={color} strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={cn('text-3xl font-bold tabular-nums', color)}>{clampedScore}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <p className="text-sm font-semibold mt-3">SEO Health</p>
      <span className={cn('text-xs font-medium mt-0.5', labelColor)}>{label}</span>
    </div>
  );
}

// ==================== KPI Card ====================

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  onClick?: () => void;
  statusHint?: 'healthy' | 'warning' | 'critical';
}

function KpiCard({ icon: Icon, label, value, iconColor, iconBg, onClick, statusHint }: KpiCardProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      className={cn('p-4 rounded-lg border text-left transition-colors',
        onClick && 'hover:bg-muted/50 cursor-pointer',
        statusHint === 'critical' && 'border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10',
        statusHint === 'warning' && 'border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10',
        !statusHint && 'bg-card',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconBg ?? 'bg-muted')}>
          <Icon className={cn('h-5 w-5', iconColor ?? 'text-muted-foreground')} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">{value}</p>
        </div>
        {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>
    </Wrapper>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

// ==================== Status Badge ====================

function StatusBadge({ status, configured }: { status: string; configured?: boolean }) {
  if (configured) {
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent font-medium"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
  }
  return <Badge variant="outline" className="font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-transparent"><XCircle className="h-3 w-3 mr-1" />Missing</Badge>;
}

// ==================== Recent Issues Summary (compact) ====================

interface NavigateFn {
  (mod: string, itemId?: string | null, subPage?: string | null): void;
}

function RecentIssuesSummary({ issues, navigate }: { issues: SeoIssue[]; navigate: NavigateFn }) {
  // Unresolved counts by severity
  const unresolved = issues.filter((i) => !i.isResolved);
  const criticalCount = unresolved.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = unresolved.filter((i) => i.severity === 'WARNING').length;
  const infoCount = unresolved.filter((i) => i.severity === 'INFO').length;

  // Only the 3-5 most recent issues
  const recent = issues.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Severity summary */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          {criticalCount} Critical
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          {warningCount} Warnings
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-medium">
          <Info className="h-3.5 w-3.5" />
          {infoCount} Info
        </span>
      </div>

      {recent.length > 0 ? (
        <ul className="space-y-2">
          {recent.map((issue) => {
            const sev = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.INFO;
            const SevIcon = sev.icon;
            return (
              <li
                key={issue.id}
                className="flex items-start gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <Badge
                  variant="outline"
                  className={cn('border-transparent font-medium gap-1 shrink-0', sev.bg, sev.color)}
                >
                  <SevIcon className="h-3 w-3" />
                  {issue.severity.charAt(0) + issue.severity.slice(1).toLowerCase()}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-mono text-xs text-muted-foreground truncate"
                    title={issue.pageUrl}
                  >
                    {truncate(issue.pageUrl, 60)}
                  </p>
                  <p
                    className="text-sm text-foreground truncate mt-0.5"
                    title={issue.problem}
                  >
                    {issue.problem}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 text-muted-foreground/30">
            <Shield className="h-10 w-10" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-foreground">No SEO issues found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Run an audit to detect potential SEO issues.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 text-xs"
            onClick={() => navigate('seo', null, 'audit')}
          >
            <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
            Run SEO Audit
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}

      {recent.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => navigate('seo', null, 'audit')}
          >
            View All Issues
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ==================== Search Performance ====================

function SearchPerformanceKpi({
  icon: Icon,
  label,
  value,
  iconColor,
  iconBg,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded', iconBg)}>
          <Icon className={cn('h-3.5 w-3.5', iconColor)} />
        </span>
        {label}
      </div>
      <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}

// ==================== Main Page ====================

export function SeoOverviewPage() {
  const navigate = useNavigationStore((s) => s.navigate);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.seoOverview.all,
    queryFn: () => getApi<SeoOverviewData>('/api/seo/overview'),
    staleTime: 30_000,
  });

  const stats = data?.stats ?? null;
  const issues = Array.isArray(data?.recentIssues) ? data.recentIssues : [];

  // Search Console status + summary (only fetched when connected)
  const { data: scData, isLoading: scLoading } = useQuery({
    queryKey: queryKeys.seoSearchConsole.all,
    queryFn: () => getApi<SearchConsoleStatusData>('/api/seo/search-console'),
    enabled: !!stats?.searchConsoleConnected,
    staleTime: 30_000,
  });

  const hint = (count: number) => count === 0 ? 'healthy' as const : count <= 5 ? 'warning' as const : 'critical' as const;

  return (
    <div className="space-y-6">
      <PageHeader title="SEO Overview" description="Monitor your site's search engine optimization health and performance" />

      {error && (
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">Failed to load SEO overview. Please try again later.</p>
          </CardContent>
        </Card>
      )}

      {/* Score + Quick Stats */}
      <section>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 11 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
            {/* Score Ring */}
            <Card className="p-6 flex items-center justify-center">
              <ScoreRing score={stats.overallScore ?? 0} />
            </Card>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              <KpiCard icon={Globe} label="Indexed Pages" value={(stats.indexedPages ?? 0).toLocaleString()} iconColor="text-green-600 dark:text-green-400" iconBg="bg-green-100 dark:bg-green-900/30" onClick={() => navigate('seo', null, 'audit')} />
              <KpiCard icon={FileQuestion} label="Not Indexed" value={(stats.notIndexed ?? 0).toLocaleString()} iconColor="text-amber-600 dark:text-amber-400" iconBg="bg-amber-100 dark:bg-amber-900/30" onClick={() => navigate('seo', null, 'audit')} statusHint={hint(stats.notIndexed ?? 0)} />
              <KpiCard icon={FileX2} label="Missing Meta Titles" value={(stats.missingMetaTitles ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" onClick={() => navigate('seo', null, 'audit')} statusHint={hint(stats.missingMetaTitles ?? 0)} />
              <KpiCard icon={Type} label="Missing Meta Desc." value={(stats.missingMetaDescriptions ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" onClick={() => navigate('seo', null, 'audit')} statusHint={hint(stats.missingMetaDescriptions ?? 0)} />
              <KpiCard icon={Heading} label="Missing H1" value={(stats.missingH1 ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" onClick={() => navigate('seo', null, 'audit')} statusHint={hint(stats.missingH1 ?? 0)} />
              <KpiCard icon={Copy} label="Duplicate Titles" value={(stats.duplicateTitles ?? 0).toLocaleString()} iconColor="text-amber-600 dark:text-amber-400" iconBg="bg-amber-100 dark:bg-amber-900/30" onClick={() => navigate('seo', null, 'audit')} statusHint={hint(stats.duplicateTitles ?? 0)} />
              <KpiCard icon={Copy} label="Duplicate Desc." value={(stats.duplicateDescriptions ?? 0).toLocaleString()} iconColor="text-amber-600 dark:text-amber-400" iconBg="bg-amber-100 dark:bg-amber-900/30" onClick={() => navigate('seo', null, 'audit')} statusHint={hint(stats.duplicateDescriptions ?? 0)} />
              <KpiCard icon={Unlink} label="Broken Links" value={(stats.brokenLinksCount ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" onClick={() => navigate('seo', null, 'audit')} statusHint={hint(stats.brokenLinksCount ?? 0)} />
              <KpiCard icon={Navigation} label="Redirects" value={(stats.redirectsCount ?? 0).toLocaleString()} iconColor="text-sky-600 dark:text-sky-400" iconBg="bg-sky-100 dark:bg-sky-900/30" onClick={() => navigate('seo', null, 'settings')} />
              <KpiCard icon={Link2} label="Missing Canonicals" value={(stats.missingCanonicals ?? 0).toLocaleString()} iconColor="text-amber-600 dark:text-amber-400" iconBg="bg-amber-100 dark:bg-amber-900/30" onClick={() => navigate('seo', null, 'audit')} statusHint={hint(stats.missingCanonicals ?? 0)} />
              <KpiCard icon={Link2} label="Canonical Issues" value={(stats.canonicalIssues ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" onClick={() => navigate('seo', null, 'audit')} statusHint={hint(stats.canonicalIssues ?? 0)} />
            </div>
          </div>
        ) : null}
      </section>

      {/* Technical SEO Health */}
      <section>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Technical SEO Health</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button onClick={() => navigate('seo', null, 'settings')} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', stats?.sitemapStatus === 'GENERATED' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30')}>
                  <FileCode className={cn('h-4 w-4', stats?.sitemapStatus === 'GENERATED' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Sitemap</p>
                  {stats ? <StatusBadge status={stats.sitemapStatus} configured={stats.sitemapStatus === 'GENERATED'} /> : <Skeleton className="h-5 w-16" />}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              <button onClick={() => navigate('seo', null, 'settings')} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', stats?.robotsStatus === 'CONFIGURED' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                  <Shield className={cn('h-4 w-4', stats?.robotsStatus === 'CONFIGURED' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Robots.txt</p>
                  {stats ? <StatusBadge status={stats.robotsStatus} configured={stats.robotsStatus === 'CONFIGURED'} /> : <Skeleton className="h-5 w-16" />}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              <button onClick={() => navigate('seo', null, 'audit')} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', stats?.schemaStatus === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-100 dark:bg-zinc-800/50')}>
                  <Code className={cn('h-4 w-4', stats?.schemaStatus === 'ACTIVE' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Schema.org</p>
                  {stats ? <StatusBadge status={stats.schemaStatus} configured={stats.schemaStatus === 'ACTIVE'} /> : <Skeleton className="h-5 w-16" />}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              <button onClick={() => navigate('seo', null, 'search-console')} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', stats?.searchConsoleConnected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-100 dark:bg-zinc-800/50')}>
                  <BarChart3 className={cn('h-4 w-4', stats?.searchConsoleConnected ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Search Console</p>
                  {stats ? (
                    stats.searchConsoleConnected
                      ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent font-medium"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>
                      : <Badge variant="outline" className="font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-transparent">Not Connected</Badge>
                  ) : <Skeleton className="h-5 w-20" />}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Search Performance */}
      <section>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Search Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || (stats?.searchConsoleConnected && scLoading) ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : !stats?.searchConsoleConnected ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 text-muted-foreground/30">
                  <Eye className="h-10 w-10" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Connect Google Search Console to view search performance.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => navigate('seo', null, 'search-console')}
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                  Connect Search Console
                </Button>
              </div>
            ) : !scData?.summary ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 text-muted-foreground/30">
                  <RefreshCw className="h-10 w-10" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  No search performance data available yet. Sync to fetch data from Google Search Console.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => navigate('seo', null, 'search-console')}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Sync Now
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SearchPerformanceKpi
                    icon={MousePointerClick}
                    label="Clicks"
                    value={formatCompactNumber(scData.summary.totalClicks)}
                    iconColor="text-green-600 dark:text-green-400"
                    iconBg="bg-green-100 dark:bg-green-900/30"
                  />
                  <SearchPerformanceKpi
                    icon={Eye}
                    label="Impressions"
                    value={formatCompactNumber(scData.summary.totalImpressions)}
                    iconColor="text-sky-600 dark:text-sky-400"
                    iconBg="bg-sky-100 dark:bg-sky-900/30"
                  />
                  <SearchPerformanceKpi
                    icon={Target}
                    label="CTR"
                    value={formatCtr(scData.summary.averageCtr)}
                    iconColor="text-amber-600 dark:text-amber-400"
                    iconBg="bg-amber-100 dark:bg-amber-900/30"
                  />
                  <SearchPerformanceKpi
                    icon={TrendingUp}
                    label="Position"
                    value={formatPosition(scData.summary.averagePosition)}
                    iconColor="text-violet-600 dark:text-violet-400"
                    iconBg="bg-violet-100 dark:bg-violet-900/30"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => navigate('seo', null, 'search-console')}
                  >
                    View Search Console
                    <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent SEO Issues */}
      <section>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent SEO Issues</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate('seo', null, 'audit')}>
                <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                Run SEO Audit
                <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-7 w-20" />
                </div>
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <RecentIssuesSummary issues={issues} navigate={navigate} />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
