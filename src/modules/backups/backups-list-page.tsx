'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Download,
  RotateCcw,
  Trash2,
  MoreHorizontal,
  ShieldCheck,
  Loader2,
  Lock,
  DatabaseBackup,
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
  StatusBadge,
  EmptyState,
} from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatFileSize, formatRelativeTime, labelize } from '@/lib/utils';
import { formatDurationMs, BACKUP_SCOPE_OPTIONS, BACKUP_STORAGE_OPTIONS, SCOPE_BADGE_CLASSES } from '@/lib/backup-constants';
import type { ApiResponse, BackupStatus, BackupType, BackupScope, BackupStorageProvider } from '@/shared/types';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

// -------------------- Types --------------------

interface BackupRow {
  id: string;
  name: string;
  note: string | null;
  scope: BackupScope;
  type: BackupType;
  size: number;
  status: BackupStatus;
  storageProvider: BackupStorageProvider;
  encryptionStatus: string;
  verificationStatus: string | null;
  durationMs: number | null;
  checksum: string | null;
  storagePath: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateBackupForm {
  name: string;
  description: string;
  scope: BackupScope;
  storageId: string; // selected storage destination ID
  encryptionEnabled: boolean;
}

// -------------------- Badge Components --------------------

function ScopeBadge({ scope }: { scope: BackupScope }) {
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', SCOPE_BADGE_CLASSES[scope])}>
      {labelize(scope)}
    </Badge>
  );
}

function TypeBadge({ type }: { type: BackupType }) {
  const classes: Record<BackupType, string> = {
    AUTOMATED: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    MANUAL: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', classes[type])}>
      {labelize(type)}
    </Badge>
  );
}

function EncryptionBadge({ status }: { status: string }) {
  if (status !== 'ENCRYPTED') {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <Badge variant="outline" className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
      <Lock className="h-3 w-3 mr-1" />
      Encrypted
    </Badge>
  );
}

function VerificationBadge({ status }: { status: string | null }) {
  if (!status || status === 'PENDING' || status === 'SKIPPED') {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return <StatusBadge status={status} size="sm" />;
}

// -------------------- Search Empty State (inline) --------------------

/** Inline empty state rendered inside the table when an active search yields
 * zero results. Distinct from the standalone "No backups yet" state which only
 * shows when the system genuinely has zero backups. */
function NoSearchResultsEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <DatabaseBackup className="h-10 w-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">No backups found</p>
      <p className="text-xs text-muted-foreground mt-1">No backups match your search.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}

// -------------------- Initial Form --------------------

const initialForm: CreateBackupForm = {
  name: '',
  description: '',
  scope: 'FULL',
  storageId: '',
  encryptionEnabled: false,
};

// -------------------- Backups List Page --------------------

export function BackupsListPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateBackupForm>(initialForm);
  const [deleteTarget, setDeleteTarget] = useState<BackupRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupRow | null>(null);

  const table = useDataTable({ initialSortField: 'createdAt', initialSortOrder: 'desc' });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.backups.list({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
    }),
    queryFn: () => getApi<ApiResponse<BackupRow[]>>('/api/backups', {
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
    }, { raw: true }),
    staleTime: 10_000,
  });

  // Fetch configured storage destinations for the dropdown
  const { data: storageDestinationsData } = useQuery({
    queryKey: ['backup-storage-destinations'],
    queryFn: () => getApi<{ id: string; name: string; provider: string; isActive: boolean }[]>('/api/backups/storage?pageSize=100'),
    staleTime: 30_000,
  });
  const storageDestinations = (storageDestinationsData as unknown as { id: string; name: string; provider: string; isActive: boolean }[] | undefined)?.filter(s => s.isActive) ?? [];

  const backups = data?.data ?? [];
  const pagination = data?.meta?.pagination;
  const hasSearch = !!table.searchValue?.trim();
  const isInitialEmpty = !isLoading && backups.length === 0 && !hasSearch;
  const isSearchEmpty = !isLoading && backups.length === 0 && hasSearch;

  const createMutation = useMutation({
    mutationFn: (body: CreateBackupForm) => postApi('/api/backups', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStats.all });
      toast.success('Backup creation started');
      setDialogOpen(false);
      setForm(initialForm);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create backup'),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/backups/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
      toast.success('Verification started');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to verify backup'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/backups/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
      setRestoreTarget(null);
      toast.success('Restore initiated successfully');
    },
    onError: (err: Error) => {
      setRestoreTarget(null);
      toast.error(err.message || 'Failed to restore backup');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/backups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStats.all });
      setDeleteTarget(null);
      toast.success('Backup deleted');
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      toast.error(err.message || 'Failed to delete backup');
    },
  });

  // Column min-widths are intentionally generous and the table uses
  // `table-layout: auto` (NOT table-fixed) so cells NEVER truncate or clip —
  // every value (Name, Scope, Type, Encryption, Verification, Status,
  // Duration, Created, Storage) renders in full. The table carries a
  // `min-width` (tableMinWidth below) equal to the sum of these column
  // widths; when the viewport/card is narrower than that, the table
  // container scrolls horizontally with a thin, subtle scrollbar that
  // stays inside the card. The pagination/footer lives outside the scroll
  // area so it always aligns with the card edges.
  const columns: ColumnDef<BackupRow>[] = [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        size: 220,
        // No `truncate`/`overflow-hidden` — full name always visible.
        // `title` provides a hover tooltip for very long names without
        // ever clipping the cell text.
        cell: ({ getValue }) => {
          const value = (getValue() as string) ?? '';
          if (!value) return <span className="text-muted-foreground">—</span>;
          return <span className="font-medium" title={value}>{value}</span>;
        },
      },
      {
        id: 'scope',
        header: 'Scope',
        accessorKey: 'scope',
        enableSorting: false,
        size: 120,
        cell: ({ getValue }) => <ScopeBadge scope={getValue() as BackupScope} />,
      },
      {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        enableSorting: false,
        size: 110,
        cell: ({ getValue }) => <TypeBadge type={getValue() as BackupType} />,
      },
      {
        id: 'size',
        header: 'Size',
        accessorFn: (row) => row.size,
        enableSorting: false,
        size: 80,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {formatFileSize(getValue() as number)}
          </span>
        ),
      },
      {
        id: 'storageProvider',
        header: 'Storage',
        accessorKey: 'storageProvider',
        enableSorting: false,
        size: 120,
        // Full storage label visible (e.g. "Amazon S3", "Backblaze B2");
        // never truncated.
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return <span className="text-xs text-muted-foreground" title={labelize(v)}>{labelize(v)}</span>;
        },
      },
      {
        id: 'encryptionEnabled',
        header: 'Encryption',
        accessorKey: 'encryptionStatus',
        enableSorting: false,
        size: 120,
        cell: ({ getValue }) => <EncryptionBadge status={getValue() as string} />,
      },
      {
        id: 'verificationStatus',
        header: 'Verification',
        accessorKey: 'verificationStatus',
        enableSorting: false,
        size: 110,
        cell: ({ getValue }) => <VerificationBadge status={getValue() as string | null} />,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        size: 110,
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} size="sm" />,
      },
      {
        id: 'duration',
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
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        size: 170,
        // Full relative timestamp visible (e.g. "Yesterday at 11:56 AM").
        // NO ellipsis, NO truncation, NO clipping. The 170px min-width +
        // auto layout guarantees the longest realistic value fits; if a
        // value is somehow wider the table simply scrolls horizontally.
        cell: ({ getValue }) => {
          const value = getValue() as string | Date;
          if (!value) return <span className="text-muted-foreground">—</span>;
          const rel = formatRelativeTime(value);
          return <span className="text-xs text-muted-foreground" title={rel}>{rel}</span>;
        },
      },
      ColumnDefHelper.actionColumn<BackupRow>({
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
              <DropdownMenuItem
                onClick={() => window.open(`/api/backups/${row.id}/download`, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => verifyMutation.mutate(row.id)}
                disabled={row.status !== 'COMPLETED' || verifyMutation.isPending}
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Verify
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setRestoreTarget(row)}
                disabled={row.status !== 'COMPLETED'}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteTarget(row)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ];

  const updateForm = (key: keyof CreateBackupForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Backups"
        description="View and manage all backup operations"
        action={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Backup
          </Button>
        }
      />

      {isInitialEmpty ? (
        <EmptyState
          icon={DatabaseBackup}
          title="No backups yet"
          description="Create your first backup to protect your data."
          action={{ label: 'Create Backup', onClick: () => setDialogOpen(true) }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={backups}
          isLoading={isLoading}
          totalItems={pagination?.total ?? 0}
          pageSize={table.pageSize}
          currentPage={table.currentPage}
          onPageChange={(p) => table.setCurrentPage(p)}
          onSortChange={(f, o) => table.setSortField(f, o)}
          sortField={table.sortField}
          sortOrder={table.sortOrder}
          searchPlaceholder="Search backups..."
          searchValue={table.searchValue}
          onSearch={(v) => {
            table.setSearchValue(v);
            table.setCurrentPage(1);
          }}
          getRowId={(row) => row.id}
          // Auto layout (NOT table-fixed): cells never truncate/clip — every
          // value renders in full. The table's min-width (1310px = sum of
          // column min-widths: Name 220 + Scope 120 + Type 110 + Size 80 +
          // Storage 120 + Encryption 120 + Verification 110 + Status 110 +
          // Duration 90 + Created 170 + Actions 60) guarantees the table is
          // only as narrow as its content needs; on viewports narrower than
          // that, the table-container's overflow-x-auto provides a thin,
          // subtle horizontal scrollbar that stays inside the card. The
          // pagination/footer lives outside the scroll area and always
          // aligns with the card edges.
          tableMinWidth={1310}
          emptyMessage="No backups found."
          emptyState={
            isSearchEmpty ? (
              <NoSearchResultsEmpty
                onClear={() => {
                  table.setSearchValue('');
                  table.setCurrentPage(1);
                }}
              />
            ) : undefined
          }
        />
      )}

      {/* Create Backup Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>
              Start a new backup of your system data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="backup-name">Name</Label>
              <Input
                id="backup-name"
                placeholder="e.g., Daily backup"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-desc">Description</Label>
              <Textarea
                id="backup-desc"
                placeholder="Optional description..."
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-scope">Scope</Label>
              <Select value={form.scope} onValueChange={(v) => updateForm('scope', v)}>
                <SelectTrigger id="backup-scope">
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
              <Label htmlFor="backup-storage">Storage Destination</Label>
              <Select value={form.storageId} onValueChange={(v) => updateForm('storageId', v)}>
                <SelectTrigger id="backup-storage">
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
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="backup-encryption">Encryption</Label>
                <p className="text-xs text-muted-foreground">Encrypt backup with AES-256</p>
              </div>
              <Switch
                id="backup-encryption"
                checked={form.encryptionEnabled}
                onCheckedChange={(v) => updateForm('encryptionEnabled', v)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name.trim() || !form.storageId}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <ConfirmDialog
        open={!!restoreTarget}
        onOpenChange={(v) => !v && setRestoreTarget(null)}
        title="Restore Backup"
        description={
          restoreTarget
            ? `Are you sure you want to restore from "${restoreTarget.name}"? This will overwrite current data with the backup. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Restore"
        variant="destructive"
        onConfirm={() => {
          if (restoreTarget) restoreMutation.mutate(restoreTarget.id);
        }}
        isLoading={restoreMutation.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete Backup"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
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

