'use client';

// ============================================================
// PLATFORM SHARED UI — Reusable building blocks for every
// Platform Admin page. Keeps visual language consistent with the
// existing Client Dashboard (same Card/Badge/Button components,
// same spacing, same chart style) while communicating that this is
// a PLATFORM / ADMIN area.
// ============================================================

import React from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { ArrowLeft, Search, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// -------------------- Page Header --------------------

export function PlatformPageHeader({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
      <div className="flex items-start gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// -------------------- KPI Card --------------------

export function PlatformKpi({
  label, value, sublabel, icon, color = 'default', trend,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  color?: 'emerald' | 'amber' | 'violet' | 'rose' | 'sky' | 'default';
  trend?: 'up' | 'down' | 'neutral';
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
    default: 'bg-muted text-muted-foreground',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
          </div>
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', colorMap[color])}>
            {icon}
          </div>
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend === 'up' && <span className="text-xs font-medium text-emerald-500">Trending up</span>}
            {trend === 'down' && <span className="text-xs font-medium text-rose-500">Needs attention</span>}
            {trend === 'neutral' && <span className="text-xs font-medium text-muted-foreground">Stable</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Badges --------------------

export function PlanBadge({ planId }: { planId: 'beta' | 'pro' | 'max' }) {
  const map: Record<string, string> = {
    beta: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    pro: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    max: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  };
  const name = planId === 'beta' ? 'Beta' : planId === 'pro' ? 'Pro' : 'Max';
  return <Badge variant="outline" className={cn('text-[10px] font-semibold capitalize', map[planId])}>{name}</Badge>;
}

export function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0' },
    trial: { label: 'Trial', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border-0' },
    past_due: { label: 'Past Due', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-0' },
    cancelled: { label: 'Cancelled', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-0' },
    expired: { label: 'Expired', cls: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-0' },
  };
  const s = map[status] ?? { label: status, cls: '' };
  return <Badge className={cn('text-[10px] font-semibold capitalize', s.cls)}>{s.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string }> = {
    paid: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0' },
    pending: { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border-0' },
    failed: { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-0' },
    refunded: { cls: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-0' },
  };
  const s = map[status] ?? { cls: '' };
  return <Badge className={cn('text-[10px] font-semibold capitalize', s.cls)}>{status}</Badge>;
}

export function CustomerStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string }> = {
    ACTIVE: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0' },
    SUSPENDED: { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-0' },
    DEACTIVATED: { cls: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-0' },
  };
  const s = map[status] ?? { cls: '' };
  return <Badge className={cn('text-[10px] font-semibold', s.cls)}>{status}</Badge>;
}

// -------------------- Health badge --------------------

export function HealthBadge({ status }: { status: 'operational' | 'degraded' | 'down' | 'unknown' }) {
  const map = {
    operational: { dot: 'bg-emerald-500', label: 'Operational', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0' },
    degraded: { dot: 'bg-amber-500', label: 'Degraded', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-0' },
    down: { dot: 'bg-rose-500', label: 'Down', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-0' },
    unknown: { dot: 'bg-zinc-400', label: 'Unknown', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400 border-0' },
  };
  const s = map[status];
  return (
    <Badge className={cn('text-[10px] font-semibold', s.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full mr-1', s.dot)} />
      {s.label}
    </Badge>
  );
}

// -------------------- Filters --------------------

export function SearchInput({
  value, onChange, placeholder = 'Search…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-8 w-full sm:w-64"
      />
    </div>
  );
}

export function FilterSelect<T extends string>({
  value, onChange, options, allLabel = 'All',
}: {
  value: T | 'all';
  onChange: (v: T | 'all') => void;
  options: { value: T; label: string }[];
  allLabel?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T | 'all')}>
      <SelectTrigger className="h-9 w-full sm:w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// -------------------- Loading / Error / Empty --------------------

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-4" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} className="h-6" />)}
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mb-3">
        <AlertCircle className="h-6 w-6 text-rose-500" />
      </div>
      <p className="text-sm font-medium mb-1">Unable to load data</p>
      <p className="text-xs text-muted-foreground max-w-sm mb-3">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      )}
    </div>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
        {icon ?? <AlertCircle className="h-5 w-5 opacity-50" />}
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// -------------------- Data hook --------------------

export function usePlatformApi<T>(path: string, queryKey: string[]) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      // api-client unwraps the ApiResponse envelope automatically.
      return await getApi<T>(path);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// -------------------- Formatters --------------------

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatCurrency(amount: number, currency = 'CHF'): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// -------------------- Loading overlay (for mutations) --------------------

export function MutationLoader({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label ?? 'Working…'}
    </span>
  );
}
