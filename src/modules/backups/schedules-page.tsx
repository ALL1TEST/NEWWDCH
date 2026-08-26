'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  CalendarClock,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
  ConfirmDialog,
  EmptyState,
} from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime, labelize } from '@/lib/utils';
import { BACKUP_SCOPE_OPTIONS } from '@/lib/backup-constants';
import type { ApiResponse, BackupScope, BackupStorageProvider, BackupScheduleFrequency } from '@/shared/types';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

// -------------------- Types --------------------

interface ScheduleRow {
  id: string;
  name: string;
  description: string | null;
  frequency: BackupScheduleFrequency;
  cronExpression: string | null;
  scope: BackupScope;
  storageId: string | null;
  storageProvider: BackupStorageProvider;
  encryptionEnabled: boolean;
  verificationEnabled: boolean;
  retentionCount: number;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleForm {
  name: string;
  description: string;
  frequency: BackupScheduleFrequency;
  cronExpression: string;
  scope: BackupScope;
  storageId: string;
  storageProvider: BackupStorageProvider; // derived from selected destination, submitted to API
  encryptionEnabled: boolean;
  verificationEnabled: boolean;
  retentionCount: number;
}

// -------------------- Constants --------------------

const FREQUENCIES: { value: BackupScheduleFrequency; label: string }[] = [
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'EVERY_6_HOURS', label: 'Every 6 Hours' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'CUSTOM_CRON', label: 'Custom Cron' },
];

const initialForm: ScheduleForm = {
  name: '',
  description: '',
  frequency: 'DAILY',
  cronExpression: '',
  scope: 'FULL',
  storageId: '',
  storageProvider: 'LOCAL',
  encryptionEnabled: false,
  verificationEnabled: true,
  retentionCount: 7,
};

// -------------------- Search Empty State (inline) --------------------

/** Inline empty state rendered inside the table body when an active search
 * yields zero results. Distinct from the standalone "No schedules configured"
 * state which only shows when the system genuinely has zero schedules.
 * Keeps the table card, header row, and pagination visible so the user can
 * see/search/clear within the same structure. Mirrors the Backups table's
 * `NoSearchResultsEmpty` component for consistency. */
function NoSchedulesSearchResultsEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">No schedules found</p>
      <p className="text-xs text-muted-foreground mt-1">No schedules match your search.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}

// -------------------- Schedules Page --------------------

export function SchedulesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>(initialForm);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleRow | null>(null);

  const table = useDataTable({ initialSortField: 'createdAt', initialSortOrder: 'desc' });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.backupSchedules.list({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
    }),
    queryFn: () => getApi<ApiResponse<ScheduleRow[]>>('/api/backups/schedules', {
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
    }, { raw: true }),
    staleTime: 10_000,
  });

  // Fetch configured storage destinations for the dropdown
  const { data: storageData } = useQuery({
    queryKey: ['backup-storage-destinations'],
    queryFn: () => getApi<{ id: string; name: string; provider: string; isActive: boolean }[]>('/api/backups/storage?pageSize=100'),
    staleTime: 30_000,
  });
  const storageDestinations = (storageData as unknown as { id: string; name: string; provider: string; isActive: boolean }[] | undefined)?.filter(s => s.isActive) ?? [];

  const schedules = data?.data ?? [];
  const pagination = data?.meta?.pagination;

  // Dual empty-state logic (mirrors the Backups table):
  // - isInitialEmpty: system genuinely has zero schedules AND no search is
  //   active → show the full-page "No schedules configured" state.
  // - isSearchEmpty: a search IS active but returns zero results → keep the
  //   table card/headers/pagination visible and render the inline
  //   "No schedules found" empty state inside the table body.
  // These two states must NEVER be confused.
  const hasSearch = !!table.searchValue?.trim();
  const isInitialEmpty = !isLoading && schedules.length === 0 && !hasSearch;
  const isSearchEmpty = !isLoading && schedules.length === 0 && hasSearch;

  const createMutation = useMutation({
    mutationFn: (body: ScheduleForm) => postApi('/api/backups/schedules', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupSchedules.all });
      toast.success('Schedule created');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create schedule'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ScheduleForm> }) =>
      patchApi(`/api/backups/schedules/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupSchedules.all });
      toast.success('Schedule updated');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update schedule'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/backups/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupSchedules.all });
      setDeleteTarget(null);
      toast.success('Schedule deleted');
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      toast.error(err.message || 'Failed to delete schedule');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      patchApi(`/api/backups/schedules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupSchedules.all });
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (row: ScheduleRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      description: row.description || '',
      frequency: row.frequency,
      cronExpression: row.cronExpression || '',
      scope: row.scope,
      storageId: row.storageId || '',
      storageProvider: row.storageProvider,
      encryptionEnabled: row.encryptionEnabled,
      verificationEnabled: row.verificationEnabled,
      retentionCount: row.retentionCount,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    // Submit storageProvider (the API uses this); storageId is UI-only.
    const { storageId: _omitStorageId, ...body } = form;
    void _omitStorageId;
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const updateForm = <K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Column min-widths are intentionally generous and the table uses
  // `table-layout: auto` (NOT table-fixed) so cells NEVER truncate or clip —
  // every value (Name, Frequency, Scope, Storage, Encrypt, Verify, Retention,
  // Active, Next Run, Last Run, Actions) renders in full. Long schedule names
  // simply make the table wider and trigger horizontal scroll inside the
  // card. Mirrors the Backups table's reusable overflow/scroll pattern.
  // Sum of min-widths: 220+110+130+130+90+90+110+80+150+150+60 = 1320px.
  const columns: ColumnDef<ScheduleRow>[] = [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        size: 220,
        // No `truncate`/`overflow-hidden` — full schedule name always visible.
        // `title` provides a hover tooltip for very long names without ever
        // clipping the cell text.
        cell: ({ getValue }) => {
          const value = (getValue() as string) ?? '';
          if (!value) return <span className="text-muted-foreground">—</span>;
          return <span className="font-medium" title={value}>{value}</span>;
        },
      },
      {
        id: 'frequency',
        header: 'Frequency',
        accessorKey: 'frequency',
        enableSorting: false,
        size: 110,
        cell: ({ row }) => {
          const freq = row.original.frequency;
          const cron = row.original.cronExpression;
          return (
            <span className="text-sm">
              {labelize(freq)}
              {freq === 'CUSTOM_CRON' && cron && (
                <span className="block text-xs text-muted-foreground font-mono">{cron}</span>
              )}
            </span>
          );
        },
      },
      {
        id: 'scope',
        header: 'Scope',
        accessorKey: 'scope',
        enableSorting: false,
        size: 130,
        cell: ({ getValue }) => (
          <Badge variant="outline" className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
            {labelize(getValue() as string)}
          </Badge>
        ),
      },
      {
        id: 'storage',
        header: 'Storage',
        accessorKey: 'storageProvider',
        enableSorting: false,
        size: 130,
        // Full storage label visible (e.g. "Cloudflare R2", "Google Drive");
        // never truncated.
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground" title={labelize(getValue() as string)}>
            {labelize(getValue() as string)}
          </span>
        ),
      },
      {
        id: 'encryptionEnabled',
        header: 'Encrypt',
        accessorKey: 'encryptionEnabled',
        enableSorting: false,
        size: 90,
        cell: ({ getValue }) => (
          <span className={cn(
            'text-xs font-medium',
            getValue() ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
          )}>
            {getValue() ? 'Yes' : 'No'}
          </span>
        ),
      },
      {
        id: 'verificationEnabled',
        header: 'Verify',
        accessorKey: 'verificationEnabled',
        enableSorting: false,
        size: 90,
        cell: ({ getValue }) => (
          <span className={cn(
            'text-xs font-medium',
            getValue() ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
          )}>
            {getValue() ? 'Yes' : 'No'}
          </span>
        ),
      },
      {
        id: 'retentionCount',
        header: 'Retention',
        accessorKey: 'retentionCount',
        enableSorting: false,
        size: 110,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">{getValue() as number} days</span>
        ),
      },
      {
        id: 'isActive',
        header: 'Active',
        accessorKey: 'isActive',
        enableSorting: false,
        size: 80,
        cell: ({ row }) => (
          <Switch
            checked={row.original.isActive}
            onCheckedChange={(checked) =>
              toggleActiveMutation.mutate({ id: row.original.id, isActive: checked })
            }
          />
        ),
      },
      {
        id: 'nextRunAt',
        header: 'Next Run',
        accessorKey: 'nextRunAt',
        size: 150,
        // Full relative timestamp visible (e.g. "Tomorrow at 2:00 AM"); never
        // truncated. The 150px min-width + auto layout guarantees realistic
        // values fit; if a value is somehow wider the table scrolls.
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return (
            <span className="text-xs text-muted-foreground" title={val ? formatRelativeTime(val) : undefined}>
              {val ? formatRelativeTime(val) : '—'}
            </span>
          );
        },
      },
      {
        id: 'lastRunAt',
        header: 'Last Run',
        accessorKey: 'lastRunAt',
        size: 150,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return (
            <span className="text-xs text-muted-foreground" title={val ? formatRelativeTime(val) : undefined}>
              {val ? formatRelativeTime(val) : '—'}
            </span>
          );
        },
      },
      ColumnDefHelper.actionColumn<ScheduleRow>({
        id: 'actions',
        size: 60,
        render: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Backup Schedules"
        description="Configure automated backup schedules"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </Button>
        }
      />

      {isInitialEmpty ? (
        <EmptyState
          icon={CalendarClock}
          title="No schedules configured"
          description="Create a schedule to automate your backups."
          action={{ label: 'Create Schedule', onClick: openCreate }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={schedules}
          isLoading={isLoading}
          totalItems={pagination?.total ?? 0}
          pageSize={table.pageSize}
          currentPage={table.currentPage}
          onPageChange={(p) => table.setCurrentPage(p)}
          onSortChange={(f, o) => table.setSortField(f, o)}
          sortField={table.sortField}
          sortOrder={table.sortOrder}
          searchPlaceholder="Search schedules..."
          searchValue={table.searchValue}
          onSearch={(v) => {
            table.setSearchValue(v);
            table.setCurrentPage(1);
          }}
          getRowId={(row) => row.id}
          // Auto layout (NOT table-fixed): cells never truncate/clip — every
          // value renders in full. The table's min-width (1320px = sum of
          // column min-widths: Name 220 + Frequency 110 + Scope 130 +
          // Storage 130 + Encrypt 90 + Verify 90 + Retention 110 + Active 80
          // + Next Run 150 + Last Run 150 + Actions 60) guarantees the table
          // is only as narrow as its content needs; on viewports narrower
          // than that, the table-container's overflow-x-auto provides a thin,
          // subtle horizontal scrollbar that stays inside the card. The
          // pagination/footer lives outside the scroll area and always
          // aligns with the card edges. Same reusable pattern as the Backups
          // table for consistency.
          tableMinWidth={1320}
          emptyMessage="No schedules found."
          emptyState={
            isSearchEmpty ? (
              <NoSchedulesSearchResultsEmpty
                onClear={() => {
                  table.setSearchValue('');
                  table.setCurrentPage(1);
                }}
              />
            ) : undefined
          }
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Schedule' : 'Create Schedule'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update backup schedule configuration.'
                : 'Configure a new automated backup schedule.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="sched-name">Name</Label>
              <Input
                id="sched-name"
                placeholder="e.g., Daily Database Backup"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-desc">Description</Label>
              <Textarea
                id="sched-desc"
                placeholder="Optional description..."
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-freq">Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => updateForm('frequency', v as BackupScheduleFrequency)}
              >
                <SelectTrigger id="sched-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.frequency === 'CUSTOM_CRON' && (
              <div className="space-y-2">
                <Label htmlFor="sched-cron">Custom Cron Expression</Label>
                <Input
                  id="sched-cron"
                  placeholder="0 2 * * *"
                  value={form.cronExpression}
                  onChange={(e) => updateForm('cronExpression', e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Use standard 5-field cron format (minute hour day month weekday)
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sched-scope">Scope</Label>
                <Select
                  value={form.scope}
                  onValueChange={(v) => updateForm('scope', v as BackupScope)}
                >
                  <SelectTrigger id="sched-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKUP_SCOPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sched-storage">Storage Destination</Label>
                <Select
                  value={form.storageId}
                  onValueChange={(v) => {
                    const dest = storageDestinations.find((s) => s.id === v);
                    updateForm('storageId', v);
                    if (dest) updateForm('storageProvider', dest.provider as BackupStorageProvider);
                  }}
                >
                  <SelectTrigger id="sched-storage">
                    <SelectValue placeholder="Select a storage destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {storageDestinations.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span>{s.name}</span>
                          <span className="text-xs text-muted-foreground">{s.provider}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {storageDestinations.length === 0 && (
                  <p className="text-xs text-amber-600">No storage destinations configured. Add one in Storage first.</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-retention">Retention Count</Label>
              <Input
                id="sched-retention"
                type="number"
                min={1}
                max={365}
                value={form.retentionCount}
                onChange={(e) => updateForm('retentionCount', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Number of backups to keep</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sched-encrypt">Encryption</Label>
                <p className="text-xs text-muted-foreground">Encrypt scheduled backups</p>
              </div>
              <Switch
                id="sched-encrypt"
                checked={form.encryptionEnabled}
                onCheckedChange={(v) => updateForm('encryptionEnabled', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sched-verify">Verification</Label>
                <p className="text-xs text-muted-foreground">Verify backups after creation</p>
              </div>
              <Switch
                id="sched-verify"
                checked={form.verificationEnabled}
                onCheckedChange={(v) => updateForm('verificationEnabled', v)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !form.name.trim()}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete Schedule"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? Automated backups associated with this schedule will no longer run.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
