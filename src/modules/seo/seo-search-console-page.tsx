'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  MousePointerClick,
  Eye,
  TrendingUp,
  Target,
  Link2,
  Loader2,
  RefreshCw,
  Plug,
  Unplug,
  Search,
  Globe,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ExternalLink,
  ArrowLeft,
  UserCheck,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useChartTheme } from '@/lib/chart-theme';
import { useT } from '@/lib/i18n';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSiteStore } from '@/lib/stores/site-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';

// ==================== Types ====================

interface SearchConsoleConnection {
  id: string;
  siteUrl: string;
  status: string;
  accountEmail?: string | null;
  statusMessage?: string | null;
  connectedAt?: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface SearchConsoleSummary {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
}

interface PendingVerification {
  manualRequired: boolean;
  token?: string;
  metaTag?: string;
  targetPropertyUrl?: string;
  accountEmail?: string;
  error?: string;
}

interface SearchConsoleData {
  connected: boolean;
  targetSiteUrl?: string;
  pendingVerification?: PendingVerification | null;
  connection: SearchConsoleConnection | null;
  summary: SearchConsoleSummary;
}

interface DailyStat {
  date: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position?: number;
}

interface QueryItem {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PageItem {
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  /** Resolved CMS content item id (when the pageUrl maps to an article). */
  contentId?: string | null;
}

interface PaginatedList<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ==================== Helpers ====================

function formatNumber(n: number | null | undefined): string {
  const num = n ?? 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(n: number | null | undefined): string {
  return `${((n ?? 0) * 100).toFixed(2)}%`;
}

function formatPosition(n: number | null | undefined): string {
  return (n ?? 0).toFixed(1);
}

function formatDate(dateStr: string | null, t: (key: string) => string): string {
  if (!dateStr) return t('seo.never') || 'Never';
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return t('seo.unknown') || 'Unknown';
  }
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ==================== Connection Badge & Progress ====================

function ConnectionBadge({ status }: { status: string }) {
  switch (status) {
    case 'CONNECTED':
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-medium gap-1.5 px-2.5 py-0.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Connected
        </Badge>
      );
    case 'MANUAL_VERIFICATION_REQUIRED':
      return (
        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-medium gap-1.5 px-2.5 py-0.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Verification Required
        </Badge>
      );
    case 'VERIFICATION_FAILED':
      return (
        <Badge variant="destructive" className="font-medium gap-1.5 px-2.5 py-0.5">
          <XCircle className="h-3.5 w-3.5" />
          Verification Failed
        </Badge>
      );
    case 'PROPERTY_NOT_ACCESSIBLE':
      return (
        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-medium gap-1.5 px-2.5 py-0.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Property Not Accessible
        </Badge>
      );
    case 'EXPIRED':
      return (
        <Badge variant="destructive" className="font-medium gap-1.5 px-2.5 py-0.5">
          <XCircle className="h-3.5 w-3.5" />
          Expired
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="font-medium gap-1.5 px-2.5 py-0.5">
          <XCircle className="h-3.5 w-3.5" />
          Disconnected
        </Badge>
      );
  }
}

const VERIFICATION_STEPS = [
  { id: 'connect_account', label: 'Connecting Google account...' },
  { id: 'check_access', label: 'Checking Search Console access...' },
  { id: 'verify_site', label: 'Verifying website...' },
  { id: 'publish_tag', label: 'Publishing verification...' },
  { id: 'confirm_live', label: 'Confirming live verification...' },
  { id: 'connect_property', label: 'Connecting Search Console property...' },
  { id: 'connected', label: 'Connected successfully.' },
];

function VerificationProgressCard({
  activeStepIndex,
  isFinished,
}: {
  activeStepIndex: number;
  isFinished?: boolean;
}) {
  return (
    <Card className="border-primary/20 bg-primary/[0.02] shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            {isFinished ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {isFinished ? 'Search Console Connected' : 'Connecting Search Console...'}
            </h4>
            <p className="text-xs text-muted-foreground">
              {isFinished
                ? 'Your website has been verified and Search Console connected successfully.'
                : 'Verifying website and establishing secure Search Console connection.'}
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pl-2 border-l-2 border-muted ml-3 pt-1 pb-1">
          {VERIFICATION_STEPS.map((step, idx) => {
            const isDone = isFinished || idx < activeStepIndex;
            const isCurrent = !isFinished && idx === activeStepIndex;
            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-2.5 text-xs transition-colors duration-200 -ml-[9px]',
                  isDone
                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                    : isCurrent
                      ? 'text-primary font-semibold'
                      : 'text-muted-foreground/50',
                )}
              >
                <div
                  className={cn(
                    'h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold',
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted border border-muted-foreground/30',
                  )}
                >
                  {isDone ? '✓' : isCurrent ? '●' : ''}
                </div>
                <span>{step.label}</span>
                {isCurrent && <Loader2 className="h-3 w-3 animate-spin text-primary ml-1" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== KPI Card ====================

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor?: string;
  iconBg?: string;
  loading?: boolean;
}

function KpiCard({ icon: Icon, label, value, iconColor, iconBg, loading }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconBg ?? 'bg-muted',
          )}
        >
          <Icon className={cn('h-5 w-5', iconColor ?? 'text-muted-foreground')} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-5 w-16 mt-1" />
          ) : (
            <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">{value}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ==================== Performance Chart (recharts) ====================

interface PerformanceChartProps {
  stats: DailyStat[];
  isLoading: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DailyStat }>;
}) {
  const { t } = useT();
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  let dateLabel = point.date;
  try {
    dateLabel = new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    /* keep raw date */
  }
  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs min-w-[170px]">
      <div className="font-medium mb-1.5">{dateLabel}</div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary" /> {t('seo.clicks')}
        </span>
        <span className="font-medium tabular-nums">{point.clicks.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between gap-3 mt-0.5">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary/30" /> {t('seo.impressions')}
        </span>
        <span className="font-medium tabular-nums">{point.impressions.toLocaleString()}</span>
      </div>
      {point.ctr != null && (
        <div className="flex items-center justify-between gap-3 mt-0.5 text-muted-foreground">
          <span>{t('seo.ctr')}</span>
          <span className="tabular-nums">{(point.ctr * 100).toFixed(2)}%</span>
        </div>
      )}
      {point.position != null && (
        <div className="flex items-center justify-between gap-3 mt-0.5 text-muted-foreground">
          <span>{t('seo.avgPosition')}</span>
          <span className="tabular-nums">{point.position.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

function PerformanceChart({ stats, isLoading, onSync, isSyncing }: PerformanceChartProps) {
  const { t } = useT();
  const chart = useChartTheme();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-muted-foreground">
          {t('seo.scNoData')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('seo.scNoDataHint')}
        </p>
        {onSync && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
            )}
            {t('seo.syncNow')}
          </Button>
        )}
      </div>
    );
  }

  const data = [...stats]
    .map((s) => ({
      date: s.date,
      clicks: s.clicks,
      impressions: s.impressions,
      ctr: s.ctr,
      position: s.position,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const axisTick = chart.axisTick(10);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          {t('seo.clicks')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary/30" />
          {t('seo.impressions')}
        </span>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="scImpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chart.primary} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chart.primary} stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="scClkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chart.primary} stopOpacity={0.9} />
                <stop offset="100%" stopColor={chart.primary} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={chart.grid}
              strokeOpacity={0.6}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => formatShortDate(value)}
              minTickGap={20}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: chart.border }}
            />
            <YAxis
              yAxisId="impressions"
              tickFormatter={(n: number) => formatNumber(n)}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={46}
            />
            <YAxis
              yAxisId="clicks"
              orientation="right"
              tickFormatter={(n: number) => formatNumber(n)}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <RechartsTooltip
              content={<ChartTooltip />}
              cursor={{ stroke: chart.border, strokeDasharray: '3 3' }}
            />
            <Area
              yAxisId="impressions"
              type="monotone"
              dataKey="impressions"
              name="Impressions"
              stroke={chart.primary}
              strokeOpacity={0.55}
              strokeWidth={1.5}
              fill="url(#scImpGrad)"
              fillOpacity={1}
              isAnimationActive={false}
            />
            <Area
              yAxisId="clicks"
              type="monotone"
              dataKey="clicks"
              name="Clicks"
              stroke={chart.primary}
              strokeWidth={2}
              fill="url(#scClkGrad)"
              fillOpacity={1}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==================== Queries Table ====================

function QueriesTable({ queries, isLoading }: { queries: QueryItem[]; isLoading: boolean }) {
  const { t } = useT();
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (queries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">{t('seo.noQueryData')}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('seo.syncToSeeQueries')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('seo.query')}</TableHead>
            <TableHead className="text-right">{t('seo.clicks')}</TableHead>
            <TableHead className="text-right hidden sm:table-cell">{t('seo.impressions')}</TableHead>
            <TableHead className="text-right hidden md:table-cell">{t('seo.ctr')}</TableHead>
            <TableHead className="text-right hidden lg:table-cell">{t('seo.position')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queries.map((item, i) => (
            <TableRow key={`${item.query}-${i}`}>
              <TableCell className="font-medium max-w-[240px] truncate" title={item.query}>
                {item.query}
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums hidden sm:table-cell">
                {item.impressions.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden md:table-cell">
                {formatPercent(item.ctr)}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden lg:table-cell">
                {formatPosition(item.position)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ==================== Pages Table ====================

function PagesTable({ pages, isLoading }: { pages: PageItem[]; isLoading: boolean }) {
  const { t } = useT();
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Link2 className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">{t('seo.noPageData')}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('seo.syncToSeePages')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('seo.pageUrl')}</TableHead>
            <TableHead className="text-right">{t('seo.clicks')}</TableHead>
            <TableHead className="text-right hidden sm:table-cell">{t('seo.impressions')}</TableHead>
            <TableHead className="text-right hidden md:table-cell">{t('seo.ctr')}</TableHead>
            <TableHead className="text-right hidden lg:table-cell">{t('seo.position')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((item, i) => (
            <TableRow key={`${item.pageUrl}-${i}`}>
              <TableCell className="max-w-[280px]">
                {(() => {
                  const isAbsolute = /^https?:\/\//i.test(item.pageUrl);
                  const href = item.contentId
                    ? `#content/${item.contentId}`
                    : item.pageUrl;
                  const external = !item.contentId && isAbsolute;
                  return (
                    <a
                      href={href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noopener noreferrer' : undefined}
                      className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline underline-offset-2 decoration-primary/40"
                      title={item.pageUrl}
                    >
                      <span className="truncate max-w-[240px]">{item.pageUrl}</span>
                      {external ? (
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 shrink-0 opacity-50" />
                      )}
                    </a>
                  );
                })()}
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums hidden sm:table-cell">
                {item.impressions.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden md:table-cell">
                {formatPercent(item.ctr)}
              </TableCell>
              <TableCell className="text-right tabular-nums hidden lg:table-cell">
                {formatPosition(item.position)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ==================== Loading Skeleton ====================

function SearchConsoleSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-6 w-28" />
        </div>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-48 w-full" />
      </Card>
    </div>
  );
}

// ==================== Main Page ====================

export function SeoSearchConsolePage() {
  return <SeoSearchConsolePageInner />;
}

function SeoSearchConsolePageInner() {
  const { t } = useT();
  const navigate = useNavigationStore((s) => s.navigate);
  const goBack = useNavigationStore((s) => s.goBack);
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('success') === 'connected';
  });
  const [progressStep, setProgressStep] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return new URLSearchParams(window.location.search).get('success') === 'connected' ? 6 : 0;
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Performance Chart date range. Preset ('7' | '14' | '28' | '90' | '180') or 'custom'.
  const [rangePreset, setRangePreset] = useState('14');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

  const handleRangeChange = (v: string) => {
    setRangePreset(v);
    if (v === 'custom' && !customFrom && !customTo) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 13);
      setCustomFrom(toIsoDate(start));
      setCustomTo(toIsoDate(end));
    }
  };

  // Main status query
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.seoSearchConsole.all,
    queryFn: () => getApi<SearchConsoleData>('/api/seo/search-console'),
    staleTime: 30_000,
  });

  // Verify mutation for manual fallback or retrying live public verification
  const verifyMutation = useMutation({
    mutationFn: () => postApi<{ data: any }>('/api/seo/search-console/verify'),
    onMutate: () => {
      setShowProgress(true);
      setProgressStep(4); // "Confirming live verification..."
    },
    onSuccess: (res: any) => {
      setProgressStep(6); // "Connected successfully."
      toast.success(res?.data?.message || 'Google Search Console verified and connected successfully!');
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleQueries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsolePages.all });
      setTimeout(() => setShowProgress(false), 3500);
    },
    onError: (err: any) => {
      setShowProgress(false);
      toast.error(err?.message || 'Verification could not be confirmed on live website.');
    },
  });

  // Query params for stats endpoint
  const statsParams = useMemo<Record<string, string | number | undefined>>(
    () => (rangePreset === 'custom' ? { from: customFrom, to: customTo } : { days: Number(rangePreset) }),
    [rangePreset, customFrom, customTo],
  );

  // Handle OAuth callback parameters on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const success = sp.get('success');
    const err = sp.get('error');
    const msg = sp.get('message');
    const account = sp.get('account');
    const property = sp.get('property');

    if (success === 'connected') {
      toast.success(
        `Google Search Console connected! ${property ? `(${property})` : ''} ${account ? `• ${account}` : ''}`,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleQueries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsolePages.all });
      window.history.replaceState(null, '', window.location.pathname);
      const timer = setTimeout(() => setShowProgress(false), 4500);
      return () => clearTimeout(timer);
    } else if (err === 'manual_verification_required') {
      toast.info(msg || "Automatic verification isn't available for this site yet. Please add the meta tag to verify.");
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      window.history.replaceState(null, '', window.location.pathname);
    } else if (err === 'verification_failed') {
      toast.error(msg || 'Website verification could not be completed.');
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      window.history.replaceState(null, '', window.location.pathname);
    } else if (err === 'property_not_accessible') {
      toast.error(
        msg ||
          'Google account connected, but this account does not have access to the configured Search Console property.',
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      window.history.replaceState(null, '', window.location.pathname);
    } else if (err) {
      toast.error(msg || 'Google Search Console connection is temporarily unavailable. Please try again later.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [queryClient]);

  const connection = data?.connection;
  const isConnected = data?.connected === true && connection?.status === 'CONNECTED';
  const isPropertyNotAccessible = connection?.status === 'PROPERTY_NOT_ACCESSIBLE';
  const pendingVerification = data?.pendingVerification;
  const isManualVerificationRequired =
    connection?.status === 'MANUAL_VERIFICATION_REQUIRED' ||
    (pendingVerification?.manualRequired === true && !isConnected);
  const isVerificationFailed =
    connection?.status === 'VERIFICATION_FAILED' ||
    (!!pendingVerification && !pendingVerification.manualRequired && !isConnected);

  // Automatic target site URL from CMS site configuration
  const targetSiteUrl =
    data?.targetSiteUrl ||
    (activeSite?.domain
      ? activeSite.domain.startsWith('http')
        ? activeSite.domain
        : `https://${activeSite.domain}/`
      : 'https://verdantt.vercel.app/');

  // Stats query
  const statsEnabled = isConnected && (rangePreset !== 'custom' || (!!customFrom && !!customTo));
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.seoSearchConsoleStats.list(statsParams),
    queryFn: () => getApi<DailyStat[]>('/api/seo/search-console/stats', statsParams),
    staleTime: 60_000,
    enabled: statsEnabled,
  });

  // KPI summary derived from daily stats
  const rangeSummary = useMemo(() => {
    const stats = statsData ?? [];
    const totalClicks = stats.reduce((s, x) => s + x.clicks, 0);
    const totalImpressions = stats.reduce((s, x) => s + x.impressions, 0);
    const averageCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const averagePosition =
      stats.length > 0
        ? stats.reduce((s, x) => s + (x.position ?? 0), 0) / stats.length
        : 0;
    return {
      totalClicks,
      totalImpressions,
      averageCtr: Math.round(averageCtr * 100) / 100,
      averagePosition: Math.round(averagePosition * 100) / 100,
    };
  }, [statsData]);

  // Queries query
  const { data: queriesData, isLoading: queriesLoading } = useQuery({
    queryKey: queryKeys.seoSearchConsoleQueries.list({ page: 1, pageSize: 10 }),
    queryFn: () => getApi<PaginatedList<QueryItem>>('/api/seo/search-console/queries', { page: 1, pageSize: 10 }),
    staleTime: 60_000,
    enabled: isConnected,
  });

  // Pages query
  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: queryKeys.seoSearchConsolePages.list({ page: 1, pageSize: 10 }),
    queryFn: () => getApi<PaginatedList<PageItem>>('/api/seo/search-console/pages', { page: 1, pageSize: 10 }),
    staleTime: 60_000,
    enabled: isConnected,
  });

  // Initiate server-side Google OAuth flow
  const handleConnect = (isSwitch = false) => {
    setIsConnecting(true);
    setShowProgress(true);
    setProgressStep(0);
    const params = new URLSearchParams();
    if (activeSite?.id) params.set('siteId', activeSite.id);
    if (isSwitch) {
      params.set('switch', 'true');
      params.set('prompt', 'select_account');
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/integrations/google/search-console/connect${qs}`;
  };

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => deleteApi('/api/seo/search-console'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleQueries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsolePages.all });
      toast.success(t('seo.scDisconnected'));
    },
    onError: () => {
      toast.error(t('seo.scDisconnectFailed'));
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => patchApi('/api/seo/search-console?action=sync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsole.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleStats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsoleQueries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSearchConsolePages.all });
      toast.success(t('seo.scSynced'));
    },
    onError: (err: any) => {
      toast.error(err?.message || t('seo.scSyncFailed'));
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => goBack('seo')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t('seo.searchConsole')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('seo.scDescription')}</p>
        </div>
      </div>

      {/* Network / Load Error state */}
      {error && (
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              {t('seo.scLoadFailed')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Verification Progress Stepper */}
      {showProgress && (
        <VerificationProgressCard activeStepIndex={progressStep} isFinished={progressStep >= 6} />
      )}

      {isLoading ? (
        <SearchConsoleSkeleton />
      ) : isManualVerificationRequired ? (
        /* ==================== STATE: MANUAL VERIFICATION FALLBACK ==================== */
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  Automatic verification isn't available for this site yet.
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  Add the Google verification meta tag to your website's &lt;head&gt; section to confirm ownership.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  1. Meta Tag (Place inside &lt;head&gt;)
                </label>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-xs bg-muted/80 dark:bg-muted/40 p-2.5 rounded-md border flex-1 break-all select-all">
                    {pendingVerification?.metaTag ||
                      `<meta name="google-site-verification" content="${pendingVerification?.token || ''}" />`}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() =>
                      handleCopy(
                        pendingVerification?.metaTag ||
                          `<meta name="google-site-verification" content="${pendingVerification?.token || ''}" />`,
                        'meta_tag',
                      )
                    }
                  >
                    {copiedKey === 'meta_tag' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedKey === 'meta_tag' ? 'Copied' : 'Copy Tag'}
                  </Button>
                </div>
              </div>

              {pendingVerification?.token && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    2. Verification Token
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-xs bg-muted/80 dark:bg-muted/40 p-2.5 rounded-md border flex-1 break-all select-all">
                      {pendingVerification.token}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() => handleCopy(pendingVerification.token!, 'token')}
                    >
                      {copiedKey === 'token' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedKey === 'token' ? 'Copied' : 'Copy Token'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-lg bg-background/80 border text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Exact verification location:</p>
                <p>
                  Deploy your website at <span className="font-mono text-primary">{targetSiteUrl}</span> with the meta tag inside the <span className="font-mono">&lt;head&gt;</span> section.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                  className="gap-2 font-medium"
                >
                  {verifyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {verifyMutation.isPending ? 'Confirming Live Website...' : 'Verify'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Unplug className="h-3.5 w-3.5 mr-1.5" />
                  Cancel Connection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isVerificationFailed ? (
        /* ==================== STATE: VERIFICATION FAILED ==================== */
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 shadow-sm">
          <CardContent className="p-6 sm:p-8 space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                <XCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  Website verification failed
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed max-w-2xl">
                  {pendingVerification?.error ||
                    connection?.statusMessage ||
                    'We checked the live public website, but the verification meta tag was not found in the rendered <head>.'}
                </p>
                <p className="text-xs text-muted-foreground pt-1">
                  Target Property: <span className="font-mono text-foreground">{targetSiteUrl}</span>
                </p>
              </div>
            </div>

            {pendingVerification?.metaTag && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-foreground">
                  Verification Meta Tag:
                </label>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-xs bg-muted/80 dark:bg-muted/40 p-2.5 rounded-md border flex-1 break-all select-all">
                    {pendingVerification.metaTag}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => handleCopy(pendingVerification.metaTag!, 'failed_meta')}
                  >
                    {copiedKey === 'failed_meta' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy Tag
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
                className="gap-2 font-medium"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {verifyMutation.isPending ? 'Verifying Live Website...' : 'Retry Verification'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConnect(true)}
                disabled={isConnecting}
                className="gap-1.5 text-xs font-medium"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Reconnect Google Account
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isPropertyNotAccessible ? (
        /* ==================== STATE: PROPERTY NOT ACCESSIBLE ==================== */
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                      ⚠ Google account does not have access to this property.
                    </h3>
                  </div>
                  <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed max-w-2xl">
                    Google account connected, but this account does not have access to the configured Search Console property.
                  </p>

                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    {connection?.accountEmail && (
                      <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                        <span className="font-medium">Google Account:</span>
                        <span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">
                          {connection.accountEmail}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                      <span className="font-medium">Property:</span>
                      <a
                        href={targetSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                      >
                        {targetSiteUrl}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
                <Button
                  onClick={() => handleConnect(true)}
                  disabled={isConnecting}
                  className="bg-primary text-primary-foreground font-medium text-xs gap-1.5"
                >
                  {isConnecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                  {isConnecting ? 'Connecting to Google...' : 'Switch Google Account'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Unplug className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isConnected ? (
        /* ==================== STATE: CONNECTED ==================== */
        <>
          {/* Connection Overview Card */}
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Plug className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-semibold text-sm">Status:</span>
                    <ConnectionBadge status="CONNECTED" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1 text-xs">
                    {connection?.accountEmail && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="font-medium text-foreground">Google Account:</span>
                        <span className="font-mono text-foreground/90">{connection.accountEmail}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="font-medium text-foreground">Property:</span>
                      <a
                        href={connection?.siteUrl || targetSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                      >
                        {connection?.siteUrl || targetSiteUrl}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </div>
                    {connection?.lastSyncAt && (
                      <div className="flex items-center gap-1.5 text-muted-foreground sm:col-span-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Last Synced: {formatDate(connection.lastSyncAt, t)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unplug className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          </Card>

          {/* KPI Stats Cards */}
          <section>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={MousePointerClick}
                label={t('seo.totalClicks')}
                value={formatNumber(rangeSummary.totalClicks)}
                iconColor="text-green-600 dark:text-green-400"
                iconBg="bg-green-100 dark:bg-green-900/30"
                loading={statsLoading && !statsData}
              />
              <KpiCard
                icon={Eye}
                label={t('seo.totalImpressions')}
                value={formatNumber(rangeSummary.totalImpressions)}
                iconColor="text-emerald-600 dark:text-emerald-400"
                iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                loading={statsLoading && !statsData}
              />
              <KpiCard
                icon={TrendingUp}
                label={t('seo.averageCtr')}
                value={formatPercent(rangeSummary.averageCtr)}
                iconColor="text-amber-600 dark:text-amber-400"
                iconBg="bg-amber-100 dark:bg-amber-900/30"
                loading={statsLoading && !statsData}
              />
              <KpiCard
                icon={Target}
                label={t('seo.averagePosition')}
                value={formatPosition(rangeSummary.averagePosition)}
                iconColor="text-sky-600 dark:text-sky-400"
                iconBg="bg-sky-100 dark:bg-sky-900/30"
                loading={statsLoading && !statsData}
              />
            </div>
          </section>

          {/* Performance Chart */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base font-semibold">{t('seo.performanceChart')}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:inline">{t('seo.range')}</span>
                  <Select value={rangePreset} onValueChange={handleRangeChange}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue placeholder={t('seo.selectRange')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">{t('seo.last7Days')}</SelectItem>
                      <SelectItem value="14">{t('seo.last14Days')}</SelectItem>
                      <SelectItem value="28">{t('seo.last28Days')}</SelectItem>
                      <SelectItem value="90">{t('seo.last3Months')}</SelectItem>
                      <SelectItem value="180">{t('seo.last6Months')}</SelectItem>
                      <SelectItem value="custom">{t('seo.customRange')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {rangePreset === 'custom' && (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="h-8 w-[150px] text-xs"
                        aria-label={t('seo.customRangeStart')}
                      />
                      <span className="text-xs text-muted-foreground">→</span>
                      <Input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="h-8 w-[150px] text-xs"
                        aria-label={t('seo.customRangeEnd')}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <PerformanceChart
                stats={statsData ?? []}
                isLoading={statsLoading}
                onSync={() => syncMutation.mutate()}
                isSyncing={syncMutation.isPending}
              />
            </CardContent>
          </Card>

          {/* Top Search Queries */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{t('seo.topSearchQueries')}</CardTitle>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {t('seo.top')} {queriesData?.data?.length ?? 10}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <QueriesTable
                queries={queriesData?.data ?? []}
                isLoading={queriesLoading}
              />
            </CardContent>
          </Card>

          {/* Top Pages */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{t('seo.topPages')}</CardTitle>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {t('seo.top')} {pagesData?.data?.length ?? 10}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <PagesTable
                pages={pagesData?.data ?? []}
                isLoading={pagesLoading}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        /* ==================== STATE: DISCONNECTED (TRUE SAAS 1-CLICK) ==================== */
        <Card className="border-dashed">
          <CardContent className="p-10 sm:p-16 flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5 shadow-sm">
              <Search className="h-8 w-8" strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Connect Search Console</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
              Connect your Google Search Console account with one click to view search performance, clicks, impressions, and top search queries for your website.
            </p>
            <Button
              size="lg"
              className="mt-6 gap-2 font-medium shadow-sm"
              onClick={() => handleConnect(false)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4" />
                  Connect Search Console
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-4 font-mono">
              Configured Property: {targetSiteUrl}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
