'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Pencil,
  Info,
  Loader2,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
} from '@/components/patterns';
import { getApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { STATUS_COLORS } from '@/shared/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import type { PaginationMeta } from '@/shared/types';

// -------------------- Types --------------------

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  type: string;
  status: string;
  environment: string;
  rateLimitPerMin: number;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  totalRequests: number;
  createdAt: string;
  updatedAt: string;
}

// -------------------- Helpers --------------------

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function DynamicBadge({
  value,
  fallback = 'border-transparent',
}: {
  value: string;
  fallback?: string;
}) {
  const colorClass = STATUS_COLORS[value] ?? fallback;
  const label = value.replace(/_/g, ' ');
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', colorClass)}>
      {label}
    </Badge>
  );
}

// -------------------- Usage Progress Bar --------------------

function UsageBar({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number;
  label: string;
}) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isOver = used > limit && limit > 0;

  let colorClass = 'text-green-600 dark:text-green-400';
  let barClass = '[&>div]:bg-green-500';
  if (percentage > 80 || isOver) {
    colorClass = 'text-red-600 dark:text-red-400';
    barClass = '[&>div]:bg-red-500';
  } else if (percentage > 50) {
    colorClass = 'text-amber-600 dark:text-amber-400';
    barClass = '[&>div]:bg-amber-500';
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium', colorClass)}>
          {formatNumber(used)}/{formatNumber(limit)}
          {isOver && (
            <span className="ml-1 text-red-500 font-semibold">⚠</span>
          )}
        </span>
      </div>
      <Progress value={percentage} className={cn('h-2', barClass)} />
    </div>
  );
}

// -------------------- Edit Rate Limits Dialog --------------------

function EditLimitsDialog({
  open,
  onOpenChange,
  data,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ApiKeyRow | null;
  onSubmit: (id: string, limits: { rateLimitPerMin: number; rateLimitPerHour: number; rateLimitPerDay: number }) => void;
  isLoading: boolean;
}) {
  const [perMin, setPerMin] = useState('100');
  const [perHour, setPerHour] = useState('1000');
  const [perDay, setPerDay] = useState('10000');

  React.useEffect(() => {
    if (open && data) {
      setPerMin(String(data.rateLimitPerMin ?? 100));
      setPerHour(String(data.rateLimitPerHour ?? 1000));
      setPerDay(String(data.rateLimitPerDay ?? 10000));
    }
  }, [open, data]);

  const canSubmit = !isLoading && data != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Rate Limits</DialogTitle>
          <DialogDescription>
            Update rate limits for &quot;{data?.name}&quot;. Changes take
            effect immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="grid gap-2">
            <Label htmlFor="limit-min">Per Minute (req/min)</Label>
            <Input
              id="limit-min"
              type="number"
              min="1"
              value={perMin}
              onChange={(e) => setPerMin(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="limit-hour">Per Hour (req/hour)</Label>
            <Input
              id="limit-hour"
              type="number"
              min="1"
              value={perHour}
              onChange={(e) => setPerHour(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="limit-day">Per Day (req/day)</Label>
            <Input
              id="limit-day"
              type="number"
              min="1"
              value={perDay}
              onChange={(e) => setPerDay(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!data) return;
              onSubmit(data.id, {
                rateLimitPerMin: parseInt(perMin, 10) || 100,
                rateLimitPerHour: parseInt(perHour, 10) || 1000,
                rateLimitPerDay: parseInt(perDay, 10) || 10000,
              });
            }}
            disabled={!canSubmit}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Main Component --------------------

export function RateLimitsPage() {
  const queryClient = useQueryClient();

  // ---- Dialog state ----
  const [editTarget, setEditTarget] = useState<ApiKeyRow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // ---- Filter state ----
  const [searchValue, setSearchValue] = useState('');

  const table = useDataTable({
    initialSortField: 'name',
    initialSortOrder: 'asc',
  });

  // ---- Query (reuse /api/api-keys endpoint) ----
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.apiKeys.list({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: searchValue,
    }),
    queryFn: () =>
      getApi<{ data: ApiKeyRow[]; meta: { requestId: string; pagination: PaginationMeta } }>('/api/api-keys', {
        page: table.currentPage,
        pageSize: table.pageSize,
        sort: table.sortField,
        order: table.sortOrder,
        search: searchValue || undefined,
      }, { raw: true }),
    staleTime: 10_000,
  });

  const keys = data?.data ?? [];
  const pagination = data?.meta?.pagination;

  // ---- Mutations ----
  const updateLimitsMutation = useMutation({
    mutationFn: ({
      id,
      limits,
    }: {
      id: string;
      limits: { rateLimitPerMin: number; rateLimitPerHour: number; rateLimitPerDay: number };
    }) => patchApi(`/api/api-keys/${id}`, limits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      setEditDialogOpen(false);
      setEditTarget(null);
      toast.success('Rate limits updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update rate limits');
    },
  });

  // ---- Columns ----
  const columns = useMemo<ColumnDef<ApiKeyRow>[]>(
    () => [
      ColumnDefHelper.textColumn<ApiKeyRow>({
        id: 'name',
        header: 'Key Name',
        accessorKey: 'name',
        className: 'font-medium min-w-[140px]',
      }),

      {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        enableSorting: false,
        size: 80,
        cell: ({ getValue }) => <DynamicBadge value={getValue() as string} />,
      },

      {
        id: 'environment',
        header: 'Environment',
        accessorKey: 'environment',
        size: 120,
        cell: ({ getValue }) => <DynamicBadge value={getValue() as string} />,
      },

      {
        id: 'rateLimitPerMin',
        header: 'Per Minute',
        accessorKey: 'rateLimitPerMin',
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-sm font-mono">
            {formatNumber(getValue() as number)}
            <span className="text-muted-foreground text-xs ml-1">req/min</span>
          </span>
        ),
      },

      {
        id: 'rateLimitPerHour',
        header: 'Per Hour',
        accessorKey: 'rateLimitPerHour',
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-sm font-mono">
            {formatNumber(getValue() as number)}
            <span className="text-muted-foreground text-xs ml-1">req/hr</span>
          </span>
        ),
      },

      {
        id: 'rateLimitPerDay',
        header: 'Per Day',
        accessorKey: 'rateLimitPerDay',
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-sm font-mono">
            {formatNumber(getValue() as number)}
            <span className="text-muted-foreground text-xs ml-1">req/day</span>
          </span>
        ),
      },

      {
        id: 'totalRequests',
        header: 'Total Requests',
        accessorKey: 'totalRequests',
        size: 120,
        cell: ({ row }) => {
          const total = row.original.totalRequests;
          const dayLimit = row.original.rateLimitPerDay;
          return (
            <div className="space-y-1.5 min-w-[140px]">
              <span className="text-sm font-medium">{formatNumber(total)}</span>
              <UsageBar used={total} limit={dayLimit * 30} label="30d usage" />
            </div>
          );
        },
      },

      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        size: 100,
        cell: ({ getValue }) => <DynamicBadge value={getValue() as string} />,
      },

      ColumnDefHelper.actionColumn<ApiKeyRow>({
        id: 'actions',
        render: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditTarget(row);
                  setEditDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Limits
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ],
    []
  );

  // ---- Handlers ----
  const handleSearch = (value: string) => {
    setSearchValue(value);
    table.setCurrentPage(1);
  };

  // ---- Render ----
  return (
    <div className="space-y-4">
      <PageHeader
        title="Rate Limits"
        description="Configure and monitor API rate limits per key"
      />

      {/* Info Card */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-sky-100 p-2 dark:bg-sky-900/30">
            <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="text-sm font-medium">How Rate Limiting Works</h4>
            <div className="text-sm text-muted-foreground space-y-1.5">
              <p>
                Rate limits use a <strong>sliding window</strong> algorithm to track
                request counts. Each API key has independent limits for per-minute,
                per-hour, and per-day windows.
              </p>
              <p>
                When a key exceeds its rate limit, the API returns a{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  429 Too Many Requests
                </code>{' '}
                response with{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  Retry-After
                </code>{' '}
                header indicating when the client may retry.
              </p>
              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-xs">&lt; 50% used</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs">50-80% used</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-xs">&gt; 80% used</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search API keys..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={keys}
        isLoading={isLoading}
        totalItems={pagination?.total ?? 0}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        getRowId={(row) => row.id}
        emptyMessage="No API keys found."
      />

      {/* Edit Rate Limits Dialog */}
      <EditLimitsDialog
        open={editDialogOpen}
        onOpenChange={(v) => {
          setEditDialogOpen(v);
          if (!v) setEditTarget(null);
        }}
        data={editTarget}
        onSubmit={(id, limits) =>
          updateLimitsMutation.mutate({ id, limits })
        }
        isLoading={updateLimitsMutation.isPending}
      />
    </div>
  );
}
