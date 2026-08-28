'use client';

// ============================================================
// PLATFORM SITES — list every site across all customers on
// the platform. The API returns the full dataset; a search
// input filters client-side by site name / slug / domain /
// customer name. A small total-storage summary is derived
// from the returned array (sum of storageBytes).
// ============================================================

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  PlatformPageHeader,
  SearchInput,
  TableSkeleton,
  ErrorState,
  EmptyState,
  usePlatformApi,
  formatBytes,
  formatDate,
} from './shared';
import type { PlatformSite } from '@/lib/platform/platform-data';

type SiteRow = PlatformSite & { customerName: string };

function SiteStatusBadge({ status }: { status: PlatformSite['status'] }) {
  const map: Record<PlatformSite['status'], string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0',
    MAINTENANCE: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-0',
    SUSPENDED: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-0',
    ARCHIVED: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-0',
  };
  return <Badge className={cn('text-[10px] font-semibold', map[status])}>{status}</Badge>;
}

export function PlatformSitesModule() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = usePlatformApi<SiteRow[]>(
    '/api/platform/admin/sites',
    ['platform-sites'],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.domain ?? '').toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalStorage = useMemo(
    () => (data ?? []).reduce((a, s) => a + s.storageBytes, 0),
    [data],
  );

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Sites"
        subtitle="All websites across all customers on the platform."
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by site name, slug, domain…"
        />
        <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
          <span>
            <span className="font-semibold text-foreground">{data?.length ?? 0}</span> total
          </span>
          <span>
            Storage:{' '}
            <span className="font-semibold text-foreground">{formatBytes(totalStorage)}</span>
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : isError ? (
            <ErrorState message="Could not load sites. Please retry." onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState message="No sites found." />
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {filtered.length} site{filtered.length === 1 ? '' : 's'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Site</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Domain</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Status</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground">Customer</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground text-right">Articles</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground text-right">Media</th>
                      <th className="pb-2 pr-4 font-medium text-xs text-muted-foreground text-right">Storage</th>
                      <th className="pb-2 font-medium text-xs text-muted-foreground text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-accent/30 transition-colors">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium truncate max-w-[160px]">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{s.slug}</p>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                          {s.domain ?? '—'}
                        </td>
                        <td className="py-2.5 pr-4"><SiteStatusBadge status={s.status} /></td>
                        <td className="py-2.5 pr-4 truncate max-w-[140px]">{s.customerName}</td>
                        <td className="py-2.5 pr-4 text-right font-medium">{s.articles.toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-right font-medium">{s.media.toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatBytes(s.storageBytes)}
                        </td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(s.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
