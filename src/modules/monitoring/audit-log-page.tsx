'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, EmptyState } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { formatRelativeTime, getInitials } from '@/lib/utils';
import { ScrollText, Search } from 'lucide-react';
import type { PaginatedResponse } from '@/shared/types';

// -------------------- Types ----------------

interface AuditLogRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: string | null;
  ipAddress?: string;
  site?: { id: string; name: string } | null;
  user?: { id: string; name: string; avatarUrl?: string } | null;
  createdAt: string;
}

// -------------------- Audit Log Page --------------------

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const params: Record<string, string | number | undefined> = {
    page,
    pageSize: 25,
    search: search || undefined,
    startDate: fromDate || undefined,
    endDate: toDate || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.auditLog.list(params),
    queryFn: () => getApi<PaginatedResponse<AuditLogRow>>('/api/audit-logs', params),
    staleTime: 5_000,
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Track all user and system actions" />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions, resources..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8"
              />
            </div>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full sm:w-auto"
              placeholder="From"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full sm:w-auto"
              placeholder="To"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : logs.length === 0 ? (
            <EmptyState icon={ScrollText} title="No audit logs" description="No logs match your filters." />
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">User</th>
                    <th className="pb-2 pr-4 font-medium">Action</th>
                    <th className="pb-2 pr-4 font-medium">Resource</th>
                    <th className="pb-2 pr-4 font-medium">Site</th>
                    <th className="pb-2 pr-4 font-medium">IP Address</th>
                    <th className="pb-2 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-accent/50">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">
                              {log.user?.name ? getInitials(log.user.name) : 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium truncate max-w-[100px]">{log.user?.name ?? 'System'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground truncate max-w-[150px]">{log.resourceType}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground truncate max-w-[100px]">{log.site?.name ?? '—'}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-xs text-muted-foreground font-mono">{log.ipAddress ?? '—'}</td>
                      <td className="py-2.5 text-muted-foreground whitespace-nowrap">{formatRelativeTime(log.createdAt)}</td>
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
