'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  HardDrive,
  Loader2,
  Plug,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { ApiResponse, BackupStorageProvider } from '@/shared/types';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

// -------------------- Types --------------------

interface StorageRow {
  id: string;
  name: string;
  provider: BackupStorageProvider;
  config: Record<string, unknown> | null;
  isActive: boolean;
  lastTestAt: string | null;
  lastTestResult: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StorageForm {
  name: string;
  provider: BackupStorageProvider;
  config: string; // JSON string
}

// -------------------- Provider Badge --------------------

function ProviderBadge({ provider }: { provider: BackupStorageProvider }) {
  const classes: Record<string, string> = {
    LOCAL: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    AMAZON_S3: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    GOOGLE_DRIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    DROPBOX: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    ONEDRIVE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    CLOUDFLARE_R2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    BACKBLAZE_B2: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    FTP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    SFTP: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent font-medium', classes[provider] ?? classes.LOCAL)}
    >
      {labelize(provider)}
    </Badge>
  );
}

// -------------------- Constants --------------------

const PROVIDERS: { value: BackupStorageProvider; label: string }[] = [
  { value: 'LOCAL', label: 'Local' },
  { value: 'AMAZON_S3', label: 'Amazon S3' },
  { value: 'GOOGLE_DRIVE', label: 'Google Drive' },
  { value: 'DROPBOX', label: 'Dropbox' },
  { value: 'ONEDRIVE', label: 'OneDrive' },
  { value: 'CLOUDFLARE_R2', label: 'Cloudflare R2' },
  { value: 'BACKBLAZE_B2', label: 'Backblaze B2' },
  { value: 'FTP', label: 'FTP' },
  { value: 'SFTP', label: 'SFTP' },
];

const initialForm: StorageForm = {
  name: '',
  provider: 'LOCAL',
  config: '{}',
};

// -------------------- Storage Page --------------------

export function StoragePage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StorageForm>(initialForm);
  const [deleteTarget, setDeleteTarget] = useState<StorageRow | null>(null);

  const table = useDataTable({ initialSortField: 'createdAt', initialSortOrder: 'desc' });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.backupStorage.list({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
    }),
    queryFn: () => getApi<ApiResponse<StorageRow[]>>('/api/backups/storage', {
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
    }, { raw: true }),
    staleTime: 10_000,
  });

  const storages = data?.data ?? [];
  const pagination = data?.meta?.pagination;

  const createMutation = useMutation({
    mutationFn: (body: Omit<StorageForm, 'config'> & { config: Record<string, unknown> }) =>
      postApi('/api/backups/storage', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStorage.all });
      toast.success('Storage configuration created');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create storage configuration'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Omit<StorageForm, 'config'> & { config: Record<string, unknown> }> }) =>
      patchApi(`/api/backups/storage/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStorage.all });
      toast.success('Storage configuration updated');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update storage configuration'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/backups/storage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStorage.all });
      setDeleteTarget(null);
      toast.success('Storage configuration deleted');
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      toast.error(err.message || 'Failed to delete storage configuration');
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/backups/storage/${id}/test-connection`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStorage.detail(id) });
      toast.success('Connection test passed');
    },
    onError: (err: Error) => toast.error(err.message || 'Connection test failed'),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (row: StorageRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      provider: row.provider,
      config: JSON.stringify(row.config || {}, null, 2),
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
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(form.config);
    } catch {
      toast.error('Invalid JSON in configuration');
      return;
    }
    const body = {
      name: form.name,
      provider: form.provider,
      config: parsedConfig,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const updateForm = <K extends keyof StorageForm>(key: K, value: StorageForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<StorageRow>[] = [
      ColumnDefHelper.textColumn<StorageRow>({
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        className: 'font-medium',
      }),
      {
        id: 'provider',
        header: 'Provider',
        accessorKey: 'provider',
        enableSorting: false,
        size: 150,
        cell: ({ getValue }) => <ProviderBadge provider={getValue() as BackupStorageProvider} />,
      },
      {
        id: 'isActive',
        header: 'Status',
        accessorKey: 'isActive',
        enableSorting: false,
        size: 100,
        cell: ({ getValue }) => (
          <Badge
            variant="outline"
            className={cn(
              'border-transparent font-medium',
              getValue()
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
            )}
          >
            {getValue() ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'lastTestAt',
        header: 'Last Test',
        accessorKey: 'lastTestAt',
        size: 140,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return (
            <span className="text-xs text-muted-foreground">
              {val ? formatRelativeTime(val) : '—'}
            </span>
          );
        },
      },
      {
        id: 'lastTestResult',
        header: 'Test Result',
        accessorKey: 'lastTestResult',
        enableSorting: false,
        size: 120,
        cell: ({ row }) => {
          const result = row.original.lastTestResult;
          if (!result) return <span className="text-muted-foreground text-xs">—</span>;
          return result === 'SUCCESS' ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Passed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              Failed
            </span>
          );
        },
      },
      ColumnDefHelper.actionColumn<StorageRow>({
        id: 'actions',
        size: 50,
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
              <DropdownMenuItem
                onClick={() => testConnectionMutation.mutate(row.id)}
                disabled={testConnectionMutation.isPending}
              >
                {testConnectionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4 mr-2" />
                )}
                Test Connection
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
        title="Storage"
        description="Configure backup storage destinations"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Storage
          </Button>
        }
      />

      {storages.length === 0 && !isLoading ? (
        <EmptyState
          icon={HardDrive}
          title="No storage configured"
          description="Add a storage destination to save your backups."
          action={{ label: 'Add Storage', onClick: openCreate }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={storages}
          isLoading={isLoading}
          totalItems={pagination?.total ?? 0}
          pageSize={table.pageSize}
          currentPage={table.currentPage}
          onPageChange={(p) => table.setCurrentPage(p)}
          onSortChange={(f, o) => table.setSortField(f, o)}
          sortField={table.sortField}
          sortOrder={table.sortOrder}
          searchPlaceholder="Search storage..."
          searchValue={table.searchValue}
          onSearch={(v) => {
            table.setSearchValue(v);
            table.setCurrentPage(1);
          }}
          getRowId={(row) => row.id}
          emptyMessage="No storage configurations found."
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Storage' : 'Add Storage'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update storage destination configuration.'
                : 'Configure a new backup storage destination.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="storage-name">Name</Label>
              <Input
                id="storage-name"
                placeholder="e.g., Production S3 Bucket"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storage-provider">Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => updateForm('provider', v as BackupStorageProvider)}
              >
                <SelectTrigger id="storage-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="storage-config">Configuration (JSON)</Label>
              <Textarea
                id="storage-config"
                placeholder='{"bucket": "my-backups", "region": "us-east-1"}'
                value={form.config}
                onChange={(e) => updateForm('config', e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Provider-specific configuration as JSON. For S3: bucket, region, accessKeyId, secretAccessKey.
              </p>
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
        title="Delete Storage Configuration"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? Existing backups stored via this configuration will not be affected.`
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
