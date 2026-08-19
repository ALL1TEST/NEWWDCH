'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Globe, FileQuestion, FileX2, Type, Heading, Copy, Unlink,
  FileCode, BarChart3, Shield, ArrowUpRight, Loader2, AlertTriangle,
  Info, ChevronRight, Navigation, CheckCircle2, XCircle, Eye, ClipboardCheck,
  Link2, Code,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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

// ==================== Severity Config ====================

const SEVERITY_CONFIG: Record<
  string,
  { color: string; bg: string; icon: React.ElementType }
> = {
  CRITICAL: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', icon: AlertTriangle },
  WARNING: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: AlertTriangle },
  INFO: { color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30', icon: Info },
};

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

// ==================== Issues Table ====================

function IssuesTable({ issues }: { issues: SeoIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 text-muted-foreground/30"><Shield className="h-12 w-12" strokeWidth={1.5} /></div>
        <p className="text-sm font-medium text-foreground">No SEO issues found</p>
        <p className="text-xs text-muted-foreground mt-1">Your site looks healthy!</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Severity</TableHead>
            <TableHead>Page URL</TableHead>
            <TableHead className="hidden md:table-cell">Problem</TableHead>
            <TableHead className="hidden lg:table-cell">Recommendation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => {
            const sev = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.INFO;
            const SevIcon = sev.icon;
            return (
              <TableRow key={issue.id}>
                <TableCell>
                  <Badge variant="outline" className={cn('border-transparent font-medium gap-1', sev.bg, sev.color)}>
                    <SevIcon className="h-3 w-3" />
                    {issue.severity.charAt(0) + issue.severity.slice(1).toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm truncate block max-w-[200px]" title={issue.pageUrl}>{truncate(issue.pageUrl, 40)}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground truncate block max-w-[240px]" title={issue.problem}>{truncate(issue.problem, 50)}</span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-sm text-muted-foreground truncate block max-w-[280px]" title={issue.recommendation}>{truncate(issue.recommendation, 60)}</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
            {Array.from({ length: 12 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
            {/* Score Ring */}
            <Card className="p-6 flex items-center justify-center">
              <ScoreRing score={stats.overallScore ?? 0} />
            </Card>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              <KpiCard icon={Globe} label="Indexed Pages" value={(stats.indexedPages ?? 0).toLocaleString()} iconColor="text-green-600 dark:text-green-400" iconBg="bg-green-100 dark:bg-green-900/30" onClick={() => navigate('seo', null, 'indexing')} />
              <KpiCard icon={FileQuestion} label="Not Indexed" value={(stats.notIndexed ?? 0).toLocaleString()} iconColor="text-amber-600 dark:text-amber-400" iconBg="bg-amber-100 dark:bg-amber-900/30" onClick={() => navigate('seo', null, 'indexing')} statusHint={hint(stats.notIndexed ?? 0)} />
              <KpiCard icon={FileX2} label="Missing Meta Titles" value={(stats.missingMetaTitles ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" statusHint={hint(stats.missingMetaTitles ?? 0)} />
              <KpiCard icon={Type} label="Missing Meta Desc." value={(stats.missingMetaDescriptions ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" statusHint={hint(stats.missingMetaDescriptions ?? 0)} />
              <KpiCard icon={Heading} label="Missing H1" value={(stats.missingH1 ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" statusHint={hint(stats.missingH1 ?? 0)} />
              <KpiCard icon={Copy} label="Duplicate Titles" value={(stats.duplicateTitles ?? 0).toLocaleString()} iconColor="text-amber-600 dark:text-amber-400" iconBg="bg-amber-100 dark:bg-amber-900/30" statusHint={hint(stats.duplicateTitles ?? 0)} />
              <KpiCard icon={Copy} label="Duplicate Desc." value={(stats.duplicateDescriptions ?? 0).toLocaleString()} iconColor="text-amber-600 dark:text-amber-400" iconBg="bg-amber-100 dark:bg-amber-900/30" statusHint={hint(stats.duplicateDescriptions ?? 0)} />
              <KpiCard icon={Unlink} label="Broken Links" value={(stats.brokenLinksCount ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" onClick={() => navigate('seo', null, 'broken-links')} statusHint={hint(stats.brokenLinksCount ?? 0)} />
              <KpiCard icon={Navigation} label="Redirects" value={(stats.redirectsCount ?? 0).toLocaleString()} iconColor="text-sky-600 dark:text-sky-400" iconBg="bg-sky-100 dark:bg-sky-900/30" onClick={() => navigate('seo', null, 'redirects')} />
              <KpiCard icon={Link2} label="Missing Canonicals" value={(stats.missingCanonicals ?? 0).toLocaleString()} iconColor="text-amber-600 dark:text-amber-400" iconBg="bg-amber-100 dark:bg-amber-900/30" onClick={() => navigate('seo', null, 'canonicals')} statusHint={hint(stats.missingCanonicals ?? 0)} />
              <KpiCard icon={Link2} label="Canonical Issues" value={(stats.canonicalIssues ?? 0).toLocaleString()} iconColor="text-red-600 dark:text-red-400" iconBg="bg-red-100 dark:bg-red-900/30" onClick={() => navigate('seo', null, 'canonicals')} statusHint={hint(stats.canonicalIssues ?? 0)} />
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
              <button onClick={() => navigate('seo', null, 'sitemap')} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', stats?.sitemapStatus === 'GENERATED' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30')}>
                  <FileCode className={cn('h-4 w-4', stats?.sitemapStatus === 'GENERATED' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Sitemap</p>
                  {stats ? <StatusBadge status={stats.sitemapStatus} configured={stats.sitemapStatus === 'GENERATED'} /> : <Skeleton className="h-5 w-16" />}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              <button onClick={() => navigate('seo', null, 'robots')} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', stats?.robotsStatus === 'CONFIGURED' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
                  <Shield className={cn('h-4 w-4', stats?.robotsStatus === 'CONFIGURED' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Robots.txt</p>
                  {stats ? <StatusBadge status={stats.robotsStatus} configured={stats.robotsStatus === 'CONFIGURED'} /> : <Skeleton className="h-5 w-16" />}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              <button onClick={() => navigate('seo', null, 'schema')} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Search Performance</CardTitle>
              {!stats?.searchConsoleConnected && (
                <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('seo', null, 'search-console')}>
                  <BarChart3 className="h-3.5 w-3.5 mr-1.5" />Connect Search Console
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {stats?.searchConsoleConnected ? (
              <p className="text-sm text-muted-foreground text-center py-8">Search Console data loaded. Visit the <button onClick={() => navigate('seo', null, 'search-console')} className="text-primary hover:underline">Search Console page</button> for detailed metrics.</p>
            ) : (
              <div className="text-center py-8">
                <Eye className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Connect Google Search Console to see real performance data</p>
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
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <IssuesTable issues={issues} />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}


