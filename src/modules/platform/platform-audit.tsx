'use client';

// ============================================================
// PLATFORM ACTIVITY / AUDIT LOG — admin action history.
// Entries derive from /api/platform/admin/audit-log?limit=50,
// which reads the centralized platform audit log. Severity
// filtering is done client-side (no server filtering needed).
// Visual language mirrors platform-overview.tsx.
// ============================================================

import React from 'react';
import { useMemo, useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Info, AlertTriangle, AlertCircle, History, ListFilter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PlatformPageHeader, FilterSelect, TableSkeleton, ErrorState,
  EmptyState, usePlatformApi, formatRelative,
} from './shared';
import type { AuditEntry } from '@/lib/platform/platform-data';

type SeverityFilter = 'info' | 'warning' | 'critical';

export function PlatformAuditModule() {
  const { data, isLoading, isError, refetch } = usePlatformApi<AuditEntry[]>(
    '/api/platform/admin/audit-log?limit=50',
    ['platform-audit'],
  );
  const [filter, setFilter] = useState<SeverityFilter | 'all'>('all');

  // Client-side severity filtering via useMemo (per spec).
  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data;
    return data.filter((e) => e.severity === filter);
  }, [data, filter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="Activity / Audit Log" subtitle="Admin action history." />
        <Card>
          <CardContent className="p-4">
            <TableSkeleton rows={8} cols={4} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader title="Activity / Audit Log" subtitle="Admin action history." />
        <Card>
          <CardContent className="p-6">
            <ErrorState message="Could not load audit log. Please retry." onRetry={() => refetch()} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Activity / Audit Log"
        subtitle="Admin action history."
        actions={
          <Badge variant="outline" className="text-xs">
            <History className="h-3 w-3 mr-1" />
            {data.length} {data.length === 1 ? 'entry' : 'entries'}
          </Badge>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Latest {Math.min(data.length, 50)} admin actions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" />
                Filter by severity
              </span>
              <FilterSelect<SeverityFilter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'info', label: 'Info' },
                  { value: 'warning', label: 'Warning' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              message={filter === 'all' ? 'No activity recorded yet.' : 'No entries match this severity.'}
              icon={<History className="h-5 w-5 opacity-50" />}
            />
          ) : (
            <div className="max-h-[600px] overflow-y-auto -mr-2 pr-2 divide-y divide-border">
              {filtered.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Sub-components --------------------

const SEVERITY_META: Record<
  AuditEntry['severity'],
  { icon: React.ReactNode; cls: string }
> = {
  info: {
    icon: <Info className="h-4 w-4 text-sky-500" />,
    cls: 'bg-sky-50 dark:bg-sky-950/30',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    cls: 'bg-amber-50 dark:bg-amber-950/30',
  },
  critical: {
    icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
    cls: 'bg-rose-50 dark:bg-rose-950/30',
  },
};

function AuditRow({ entry }: { entry: AuditEntry }) {
  const meta = SEVERITY_META[entry.severity];
  return (
    <div className={cn('flex items-start gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-accent/40 transition-colors', meta.cls)}>
      <div className="shrink-0 mt-0.5">{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium truncate">{entry.action}</p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelative(entry.timestamp)}
          </span>
        </div>
        {entry.target && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">{entry.target}</p>
        )}
        {entry.detail && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{entry.detail}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">by {entry.actor}</p>
      </div>
    </div>
  );
}
