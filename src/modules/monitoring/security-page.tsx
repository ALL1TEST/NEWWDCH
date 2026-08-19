'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  UserX,
  Ban,
  Gauge,
  Search,
  Skull,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader, EmptyState } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime, labelize } from '@/lib/utils';
import type { PaginatedResponse, SecurityEventType } from '@/shared/types';

// -------------------- Types --------------------

interface SecurityRow {
  id: string;
  eventType: SecurityEventType;
  description: string;
  ipAddress: string;
  user?: { id: string; name: string } | null;
  details?: string;
  createdAt: string;
}

interface SecuritySummary {
  totalEvents: number;
  failedLogins: number;
  blockedIps: number;
  rateLimitHits: number;
  suspiciousActivity: number;
  bruteForceAttempts: number;
}

interface SecurityData extends PaginatedResponse<SecurityRow> {
  summary?: SecuritySummary;
}

// -------------------- Constants --------------------

const EVENT_TYPE_COLORS: Record<string, string> = {
  FAILED_LOGIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  BLOCKED_IP: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  RATE_LIMIT_HIT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  PERMISSION_ERROR: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SUSPICIOUS_ACTIVITY: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  EXPIRED_SESSION: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  BRUTE_FORCE_ATTEMPT: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  UNKNOWN: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'FAILED_LOGIN', label: 'Failed Login' },
  { value: 'BLOCKED_IP', label: 'Blocked IP' },
  { value: 'RATE_LIMIT_HIT', label: 'Rate Limit Hit' },
  { value: 'PERMISSION_ERROR', label: 'Permission Error' },
  { value: 'SUSPICIOUS_ACTIVITY', label: 'Suspicious Activity' },
  { value: 'EXPIRED_SESSION', label: 'Expired Session' },
  { value: 'BRUTE_FORCE_ATTEMPT', label: 'Brute Force' },
];

// -------------------- Security Page --------------------

export function SecurityPage() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const params: Record<string, string | number | undefined> = {
    page,
    pageSize: 25,
    eventType: eventType || undefined,
    startDate: fromDate || undefined,
    endDate: toDate || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monitoring.securityEvents.list(params),
    queryFn: () => getApi<SecurityData>('/api/monitoring/security', params),
    staleTime: 5_000,
  });

  const events = data?.data ?? [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader title="Security Monitoring" description="Track security events and suspicious activity" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><ShieldAlert className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Total Events</span></div><p className="text-2xl font-bold tabular-nums">{summary?.totalEvents ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><UserX className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Failed Logins</span></div><p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{summary?.failedLogins ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Ban className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Blocked IPs</span></div><p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{summary?.blockedIps ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Gauge className="h-4 w-4 text-orange-500" /><span className="text-xs text-muted-foreground">Rate Limits</span></div><p className="text-2xl font-bold tabular-nums">{summary?.rateLimitHits ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Search className="h-4 w-4 text-purple-500" /><span className="text-xs text-muted-foreground">Suspicious</span></div><p className="text-2xl font-bold tabular-nums">{summary?.suspiciousActivity ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Skull className="h-4 w-4 text-red-600" /><span className="text-xs text-muted-foreground">Brute Force</span></div><p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{summary?.bruteForceAttempts ?? 0}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Select value={eventType || 'all'} onValueChange={(v) => { setEventType(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Event Type" /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((et) => <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="w-full sm:w-auto" />
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="w-full sm:w-auto" />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : events.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No security events" description="No security events match your filters." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Event Type</th>
                    <th className="pb-2 pr-4 font-medium">Description</th>
                    <th className="pb-2 pr-4 font-medium">IP Address</th>
                    <th className="pb-2 pr-4 font-medium">User</th>
                    <th className="pb-2 pr-4 font-medium">Details</th>
                    <th className="pb-2 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-accent/50">
                      <td className="py-2.5 pr-4">
                        <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', EVENT_TYPE_COLORS[evt.eventType] ?? EVENT_TYPE_COLORS.UNKNOWN)}>
                          {labelize(evt.eventType)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs truncate max-w-[200px]">{evt.description}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground font-mono">{evt.ipAddress}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{evt.user?.name ?? '—'}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground truncate max-w-[150px]">{evt.details ?? '—'}</td>
                      <td className="py-2.5 text-muted-foreground whitespace-nowrap">{formatRelativeTime(evt.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
