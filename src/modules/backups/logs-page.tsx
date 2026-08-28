'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileText,
  Filter,
  CalendarRange,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
  EmptyState,
  StatusBadge,
} from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatFileSize, formatRelativeTime, labelize } from '@/lib/utils';
import { formatDurationMs } from '@/lib/backup-constants';
import type { ApiResponse } from '@/shared/types';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { PlatformPageHeader } from '@/modules/platform/shared';

// -------------------- Types --------------------

interface LogRow {
  id: string;
  action: string;
  status: string;
  backupId: string | null;
  // NOTE: the API returns the related Backup via a nested `backup` object
  // (not a flat `backupName`), so the Backup Name column reads
  // `row.backup?.name`. The search endpoint matches the backup name via
  // the `backup` relation as well.
  backup: { id: string; name: string; filename: string | null; status: string; scope: string } | null;
  databaseSize: number | null;
  archiveSize: number | null;
  fileCount: number | null;
  durationMs: number | null;
  storageProvider: string | null;
  verificationResult: string | null;
  errorMessage: string | null;
  warnings: string | null;
  createdAt: string;
}

// -------------------- Filter Options --------------------

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'RESTORE', label: 'Restore' },
  { value: 'VERIFY', label: 'Verify' },
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'SCHEDULE', label: 'Schedule' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
];

// -------------------- Search Empty State (inline) --------------------

/** Inline empty state rendered INSIDE the table body when an active search
 * or filter yields zero results. Distinct from the standalone full-page
 * "No log entries yet" state, which only shows when the system genuinely
 * has zero logs (no search AND no filters active).
 *
 * The table headers, search input, filter controls, and footer/pagination
 * all remain visible — only the body renders this empty state. The clear
 * button resets BOTH the search text and all filters (action/status/dates)
 * so it works whether the empty result was caused by a search term or by a
 * filter selection. The label adapts to what is actually active. */
function NoLogsSearchEmpty({
  onClear,
  clearLabel,
}: {
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">No logs found</p>
      <p className="text-xs text-muted-foreground mt-1">No log entries match your search.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        {clearLabel}
      </Button>
    </div>
  );
}

// -------------------- Error Cell (Read more / Read less) --------------------

/** Per-row expandable cell for the Error column.
 *
 * - Short errors (fit in 2 lines): rendered in full, NO "Read more" button.
 * - Long errors: clamped to 2 lines via `line-clamp-2` with a "Read more"
 *   button BELOW the text. Clicking expands the full text in place (no
 *   modal/tooltip/popup) and toggles the button to "Read less".
 * - Each row owns its own expanded state (this component instance). TanStack
 *   keys rows by id via `getRowId`, so when search/filter results change,
 *   rows that leave the result set unmount (state discarded) and new rows
 *   mount fresh (collapsed) — stale expanded state is never carried across
 *   unrelated rows. The `useEffect` below additionally resets to collapsed
 *   if the same row's error value changes after a refetch.
 * - The content is width-constrained to a GENEROUS max-width (`480px`) so a
 *   long error message wraps naturally. This is wide enough that typical
 *   long errors (100–300 chars) grow the column and naturally trigger
 *   horizontal scrolling (per the user's requirement: "Long Error messages
 *   must automatically trigger horizontal scrolling when needed" / "Never
 *   shrink columns excessively just to avoid scrolling"), while still
 *   preventing a single multi-thousand-char stack trace from dominating
 *   the entire table width. `break-words` + `whitespace-pre-wrap` handle
 *   long unbroken tokens and preserved newlines.
 * - Overflow detection is measurement-based (scrollHeight vs clientHeight)
 *   so the "Read more" button appears ONLY when the text is genuinely
 *   clamped — not based on a fragile character/line heuristic.
 */
const ERROR_CELL_MAX_WIDTH = '480px';
const ERROR_CELL_CLAMP_LINES = 2;

function ErrorCell({ value }: { value: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  // Stale-state prevention: each row owns its own expanded state via this
  // component instance, and TanStack keys rows by id (getRowId=row.id). When
  // search/filter results change, rows that leave the result set UNMOUNT
  // (their ErrorCell state is discarded) and new rows MOUNT fresh
  // (collapsed) — so an expanded state from a filtered-out row is never
  // inherited by an unrelated row that takes its position. No explicit
  // reset effect is needed (and calling setState in an effect body is an
  // anti-pattern the React Compiler flags).

  // Measure whether the clamped text overflows its line limit. Re-runs on
  // value change, on expand/collapse toggle, and on element resize (column
  // width / viewport changes) via ResizeObserver so detection stays accurate.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (!expanded) {
        setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, expanded]);

  if (!value) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <div style={{ maxWidth: ERROR_CELL_MAX_WIDTH }}>
      <p
        ref={ref}
        className={cn(
          'text-xs text-red-600 dark:text-red-400 break-words whitespace-pre-wrap',
          !expanded && 'line-clamp-2',
        )}
        style={!expanded ? { WebkitLineClamp: ERROR_CELL_CLAMP_LINES } : undefined}
      >
        {value}
      </p>
      {(isOverflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:underline"
          aria-expanded={expanded}
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

// -------------------- Logs Page --------------------

export function LogsPage({ scope = 'client' }: { scope?: 'client' | 'platform' } = {}) {
  const isPlatform = scope === 'platform';
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const table = useDataTable({ initialSortField: 'createdAt', initialSortOrder: 'desc' });

  const queryParams = useMemo(
    () => ({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
      action: actionFilter !== 'all' ? actionFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      // Include scope in the cache key so client and platform entries do
      // not collide. The value here is opaque to TanStack Query.
      ...(isPlatform ? { scope: 'platform' } : {}),
    }),
    [table.currentPage, table.pageSize, table.sortField, table.sortOrder, table.searchValue, actionFilter, statusFilter, fromDate, toDate, isPlatform],
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.backupLogs.list(queryParams),
    queryFn: () => getApi<ApiResponse<LogRow[]>>('/api/backups/logs', queryParams, { raw: true }),
    staleTime: 10_000,
  });

  const logs = data?.data ?? [];
  const pagination = data?.meta?.pagination;

  // ---- Dual empty-state logic ----
  // TWO distinct empty states:
  //   A) isInitialEmpty — system has ZERO logs AND no active search AND no
  //      active filter. Render the existing full-page "No log entries yet"
  //      state. (This is the ONLY path to the page-level empty state.)
  //   B) isResultEmpty — logs exist (or could exist) but the current
  //      search OR filter returns zero results. Keep the table card,
  //      headers, search input, filter controls, and footer visible, and
  //      render "No logs found" INSIDE the table body via the DataTable
  //      `emptyState` prop (DataTableEmpty spans colSpan=999 so the
  //      headers remain visible above it).
  // Search AND filter both affect the table rows; the page-level empty
  // state is gated on BOTH being inactive.
  const hasSearch = !!table.searchValue?.trim();
  const hasFilter =
    actionFilter !== 'all' || statusFilter !== 'all' || fromDate !== '' || toDate !== '';
  const hasActiveSearchOrFilter = hasSearch || hasFilter;
  const isInitialEmpty = !isLoading && logs.length === 0 && !hasActiveSearchOrFilter;
  const isResultEmpty = !isLoading && logs.length === 0 && hasActiveSearchOrFilter;

  // Reset everything (search text + all filters + page) — used by the
  // inline empty-state "Clear" button so a single click restores all rows
  // regardless of whether the empty result was caused by a search term or a
  // filter selection.
  const clearSearchAndFilters = () => {
    table.setSearchValue('');
    setActionFilter('all');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
    table.setCurrentPage(1);
  };

  // Adaptive clear-button label that reflects what is actually active, so
  // the action is never misleading.
  const clearLabel = hasSearch && hasFilter
    ? 'Clear search & filters'
    : hasSearch
      ? 'Clear search'
      : 'Clear filters';

  const handleExport = () => {
    // Export logs as CSV
    if (logs.length === 0) {
      toast.info('No logs to export');
      return;
    }
    const headers = ['Action', 'Status', 'Backup Name', 'DB Size', 'File Count', 'Duration', 'Provider', 'Verification', 'Error', 'Created'];
    const rows = logs.map((log) => [
      log.action,
      log.status,
      log.backup?.name || '',
      log.databaseSize ? formatFileSize(log.databaseSize) : '',
      log.fileCount?.toString() || '',
      formatDurationMs(log.durationMs),
      log.storageProvider || '',
      log.verificationResult || '',
      log.errorMessage?.replace(/"/g, '""') || '',
      log.createdAt,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported');
  };

  const columns = useMemo<ColumnDef<LogRow>[]>(
    () => [
      {
        id: 'action',
        header: 'Action',
        accessorKey: 'action',
        size: 120,
        cell: ({ getValue }) => (
          <Badge
            variant="outline"
            className={cn(
              'border-transparent font-medium',
              getValue() === 'CREATE'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : getValue() === 'RESTORE'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : getValue() === 'VERIFY'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                    : getValue() === 'DELETE'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            )}
          >
            {labelize(getValue() as string)}
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        size: 120,
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} size="sm" />,
      },
      {
        id: 'backupName',
        header: 'Backup Name',
        // The API returns the related Backup via a nested `backup` object
        // (not a flat `backupName`), so read the name off the relation.
        accessorFn: (row) => row.backup?.name ?? null,
        className: 'font-medium',
        size: 180,
        cell: ({ getValue }) => {
          const v = (getValue() as string | null) ?? '';
          if (!v) return <span className="text-muted-foreground text-xs">—</span>;
          // Full name visible; `title` provides a hover tooltip for very
          // long names without ever clipping the cell text.
          return <span className="font-medium" title={v}>{v}</span>;
        },
      },
      {
        id: 'databaseSize',
        header: 'DB Size',
        accessorKey: 'databaseSize',
        enableSorting: false,
        size: 100,
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return (
            <span className="tabular-nums text-xs text-muted-foreground">
              {val ? formatFileSize(val) : '—'}
            </span>
          );
        },
      },
      {
        id: 'fileCount',
        header: 'Files',
        accessorKey: 'fileCount',
        enableSorting: false,
        size: 80,
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return (
            <span className="tabular-nums text-xs text-muted-foreground">
              {val !== null ? val : '—'}
            </span>
          );
        },
      },
      {
        id: 'durationMs',
        header: 'Duration',
        accessorKey: 'durationMs',
        enableSorting: false,
        size: 90,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-xs text-muted-foreground">
            {formatDurationMs(getValue() as number | null)}
          </span>
        ),
      },
      {
        id: 'storageProvider',
        header: 'Provider',
        accessorKey: 'storageProvider',
        enableSorting: false,
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {getValue() ? labelize(getValue() as string) : '—'}
          </span>
        ),
      },
      {
        id: 'verificationResult',
        header: 'Verification',
        accessorKey: 'verificationResult',
        enableSorting: false,
        size: 110,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          if (!val) return <span className="text-muted-foreground text-xs">—</span>;
          return <StatusBadge status={val} size="sm" />;
        },
      },
      {
        id: 'errorMessage',
        header: 'Error',
        accessorKey: 'errorMessage',
        enableSorting: false,
        size: 220,
        // Per-row expandable cell: short errors render in full (no "Read
        // more"); long errors clamp to 2 lines with a "Read more" button
        // BELOW the text that expands the full message in place (no modal /
        // tooltip / popup). Each row owns its own expanded state; see
        // ErrorCell for how stale state is prevented from carrying across
        // unrelated rows when search/filter results change.
        cell: ({ getValue }) => <ErrorCell value={getValue() as string | null} />,
      },
      ColumnDefHelper.dateColumn<LogRow>({
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        format: (d) => formatRelativeTime(d),
        size: 140,
      }),
    ],
    [],
  );

  const filterContent = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue placeholder="Action" />
        </SelectTrigger>
        <SelectContent>
          {ACTION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger className="h-9 w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); table.setCurrentPage(1); }}
          className="h-9 w-[140px] text-xs"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); table.setCurrentPage(1); }}
          className="h-9 w-[140px] text-xs"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {isPlatform ? (
        <PlatformPageHeader
          title="Backup Logs"
          subtitle="Platform-wide audit trail of every backup operation across all customers and sites."
          actions={
            <Button size="sm" variant="outline" onClick={handleExport} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          }
        />
      ) : (
        <PageHeader
          breadcrumbs={false}
          title="Backup Logs"
          description="View activity logs for all backup operations"
          action={
            <Button size="sm" variant="outline" onClick={handleExport} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          }
        />
      )}

      {isInitialEmpty ? (
        <EmptyState
          icon={FileText}
          title="No log entries yet"
          description="Backup activity logs will appear here once operations are performed."
        />
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          isLoading={isLoading}
          totalItems={pagination?.total ?? 0}
          pageSize={table.pageSize}
          currentPage={table.currentPage}
          onPageChange={(p) => table.setCurrentPage(p)}
          onSortChange={(f, o) => table.setSortField(f, o)}
          sortField={table.sortField}
          sortOrder={table.sortOrder}
          searchPlaceholder="Search logs..."
          searchValue={table.searchValue}
          onSearch={(v) => {
            table.setSearchValue(v);
            table.setCurrentPage(1);
          }}
          filterContent={filterContent}
          getRowId={(row) => row.id}
          // Sensible minimum width = sum of column sizes
          // (120+120+180+100+80+90+120+110+220+140 = 1280). With
          // `table-layout: auto` (no `tableFixed`), columns GROW beyond
          // these minimums to fit their content (e.g. a long error message
          // or a long backup name) — and when the total exceeds the card
          // width, the table container's `overflow-x: auto` activates a
          // thin, in-card horizontal scrollbar (styled via globals.css
          // `[data-slot="table-container"]`). The min-width is only
          // applied when the table has rows, so the search-empty and
          // initial-empty states render cleanly without forcing a
          // scrollbar (DataTable's `tableMinWidth && data.length > 0`
          // guard). Long error messages are NOT aggressively capped — the
          // ErrorCell uses a generous 480px max-width so typical long
          // errors grow the column naturally and trigger horizontal
          // scrolling instead of being shrunk to fit the card.
          tableMinWidth={1280}
          // When an active search OR filter returns zero results, keep the
          // table card, headers, search input, filter controls, and footer
          // visible, and render the "No logs found" empty state INSIDE the
          // table body (DataTableEmpty spans colSpan=999 so the headers
          // remain visible above it). The result count (totalItems=0) flows
          // through so the footer correctly shows 0 matching items. The
          // clear button resets search + all filters (label adapts).
          emptyMessage="No log entries found."
          emptyState={
            isResultEmpty ? (
              <NoLogsSearchEmpty onClear={clearSearchAndFilters} clearLabel={clearLabel} />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
