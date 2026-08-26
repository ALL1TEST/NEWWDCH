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
  Check,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
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
  // Per-field config values keyed by the provider field key (e.g.
  // "bucket", "region", "accessKeyId"). Stored as strings because form
  // inputs always produce strings; converted to the right type on submit.
  // Values for fields that belong to OTHER providers are retained across
  // provider switches (so the user doesn't lose typed input if they flip
  // back), but only the current provider's fields are rendered, validated,
  // and submitted — hidden fields are never sent to the API.
  config: Record<string, string>;
}

// -------------------- Provider Field Definitions --------------------

interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  multiline?: boolean;
}

/** The configuration fields each provider needs, aligned with the
 *  server-side `validateConfigJson` in /api/backups/storage/route.ts so the
 *  form's required fields exactly match what the API enforces. Fields NOT
 *  listed here (i.e. fields belonging to another provider) are neither
 *  rendered nor validated when this provider is selected. */
const PROVIDER_FIELDS: Record<BackupStorageProvider, ProviderField[]> = {
  LOCAL: [
    { key: 'path', label: 'Path', type: 'text', required: false, placeholder: '/var/backups', helpText: 'Local filesystem path for backups. Leave empty to use the default backup directory.' },
  ],
  AMAZON_S3: [
    { key: 'bucket', label: 'Bucket', type: 'text', required: true, placeholder: 'my-backups' },
    { key: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
    { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
    { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
  ],
  GOOGLE_DRIVE: [
    { key: 'folderId', label: 'Folder ID', type: 'text', required: true, placeholder: 'root or folder ID' },
    { key: 'credentials', label: 'Credentials (JSON)', type: 'text', required: true, multiline: true, placeholder: '{"client_id":"...","client_secret":"..."}', helpText: 'OAuth2 credentials JSON for the Google API project.' },
  ],
  DROPBOX: [
    { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
  ],
  ONEDRIVE: [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
  ],
  CLOUDFLARE_R2: [
    { key: 'accountId', label: 'Account ID', type: 'text', required: true },
    { key: 'bucket', label: 'Bucket', type: 'text', required: true },
    { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
    { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
  ],
  BACKBLAZE_B2: [
    { key: 'bucket', label: 'Bucket', type: 'text', required: true },
    { key: 'keyId', label: 'Key ID', type: 'text', required: true },
    { key: 'applicationKey', label: 'Application Key', type: 'password', required: true },
  ],
  FTP: [
    { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'ftp.example.com' },
    { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '21' },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
  SFTP: [
    { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'sftp.example.com' },
    { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '22' },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
};

// -------------------- Provider Dropdown (custom, CMS-style) --------------------

/** Fully custom Provider dropdown — replaces the native/shadcn Select with
 *  a polished CMS-style component. Built on the Radix Popover primitive so
 *  it inherits portal rendering (no clipping by the modal's overflow),
 *  outside-click close, Escape close, and viewport-aware Popper positioning.
 *  The trigger button and option list are entirely custom-styled to match
 *  the rest of the CMS form inputs (white bg, thin border, rounded, subtle
 *  shadow, hover state, selected state with a checkmark). The panel width
 *  matches the trigger width via the Radix `--radix-popper-anchor-width`
 *  CSS variable. Opens/closes smoothly on click; closes on outside click,
 *  Escape, and option selection. */
function ProviderDropdown({
  value,
  onChange,
}: {
  value: BackupStorageProvider;
  onChange: (v: BackupStorageProvider) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = PROVIDERS.find((p) => p.value === value)?.label ?? 'Select provider';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-[color,box-shadow] hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="truncate text-left text-foreground">{selectedLabel}</span>
          <ChevronDown
            className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        className="p-1"
        style={{ width: 'var(--radix-popper-anchor-width)' }}
      >
        {/* Inner scroll area: max-height capped so the panel never overflows
            the modal vertically. With 9 providers at ~32px each (~290px
            total), a 200px cap shows ~6 options and scrolls for the rest,
            keeping the panel within the modal's content area on standard
            viewport sizes. The outer PopoverContent inherits this height. */}
        <div role="listbox" className="max-h-[180px] overflow-y-auto">
          {PROVIDERS.map((p) => {
            const isSelected = p.value === value;
            return (
              <button
                key={p.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(p.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent',
                  isSelected && 'bg-accent font-medium',
                )}
              >
                <span className="truncate">{p.label}</span>
                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
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
  config: {},
};

// -------------------- Validation --------------------

/** Returns true when the Name field is non-empty AND every required field
 *  for the currently-selected provider has a non-empty value. Fields that
 *  belong to OTHER providers are intentionally NOT checked — the user's
 *  requirement: "Do not validate hidden fields belonging to another
 *  provider." Optional fields (required: false) are never checked. */
function isFormValid(form: StorageForm): boolean {
  if (!form.name.trim()) return false;
  const fields = PROVIDER_FIELDS[form.provider] ?? [];
  return fields.every(
    (f) => !f.required || (form.config[f.key] != null && form.config[f.key].trim() !== ''),
  );
}

// -------------------- Search Empty State (inline) --------------------

/** Inline empty state rendered INSIDE the table body when an active search
 * yields zero results. This is distinct from the standalone full-page
 * "No storage configured" state, which only shows when the system genuinely
 * has zero storage destinations configured (no search active).
 *
 * The table headers, search input, and footer/pagination all remain
 * visible — only the body renders this empty state. Mirrors the pattern
 * used by the Backups list page. */
function NoStorageSearchEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <HardDrive className="h-10 w-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">No storage found</p>
      <p className="text-xs text-muted-foreground mt-1">No storage destinations match your search.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}

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

  // ---- Dual empty-state logic ----
  // TWO distinct empty states:
  //   A) isInitialEmpty — system has ZERO storage destinations AND no active
  //      search. Render the existing full-page "No storage configured" state.
  //   B) isSearchEmpty — destinations exist (or could exist) but the current
  //      search returns zero results. Keep the table/card/headers/footer
  //      visible and render "No storage found" INSIDE the table body via the
  //      DataTable `emptyState` prop (DataTableEmpty spans colSpan=999 so
  //      the headers stay visible above it).
  // Search filtering must only affect table rows, never the page-level
  // empty state — so the full-page EmptyState is gated on `!hasSearch`.
  const hasSearch = !!table.searchValue?.trim();
  const isInitialEmpty = !isLoading && storages.length === 0 && !hasSearch;
  const isSearchEmpty = !isLoading && storages.length === 0 && hasSearch;

  const createMutation = useMutation({
    mutationFn: (body: { name: string; provider: BackupStorageProvider; config: string }) =>
      postApi('/api/backups/storage', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStorage.all });
      toast.success('Storage configuration created');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create storage configuration'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string; provider: BackupStorageProvider; config: string } }) =>
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
    // Flatten the stored config object into a string map for form inputs.
    // Numbers (e.g. port: 21) are coerced to strings; nullish values become ''.
    const storedConfig = row.config ?? {};
    const formConfig: Record<string, string> = {};
    for (const [k, v] of Object.entries(storedConfig)) {
      formConfig[k] = v == null ? '' : String(v);
    }
    setForm({
      name: row.name,
      provider: row.provider,
      config: formConfig,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(initialForm);
  };

  // Update a single config field value within the form state. Preserves
  // values for other providers' fields (they stay in `form.config` but are
  // not rendered/validated/submitted when their provider isn't selected).
  const updateConfigField = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  const handleSubmit = () => {
    if (!isFormValid(form)) return;
    // Build the config object from ONLY the current provider's fields.
    // This ensures hidden fields (from another provider) are never sent to
    // the API, and the value type matches what the server expects (number
    // fields like `port` are converted from string to Number). Empty
    // optional fields are omitted entirely (the server treats absent keys
    // the same as empty). The API schema expects `config` as a JSON string,
    // so we JSON.stringify before sending.
    const fields = PROVIDER_FIELDS[form.provider] ?? [];
    const configObj: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = form.config[f.key];
      if (raw == null || raw.trim() === '') continue;
      configObj[f.key] = f.type === 'number' ? Number(raw) : raw;
    }
    const body = {
      name: form.name,
      provider: form.provider,
      config: JSON.stringify(configObj),
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

      {isInitialEmpty ? (
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
          // When an active search returns zero results, keep the table/card,
          // headers, search input, and footer visible and render the
          // "No storage found" empty state INSIDE the table body (DataTableEmpty
          // spans colSpan=999 so the headers remain visible above it). The
          // result count (totalItems=0) is passed through so the footer
          // correctly shows 0 matching items.
          emptyMessage="No storage configurations found."
          emptyState={
            isSearchEmpty ? (
              <NoStorageSearchEmpty
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
              <ProviderDropdown
                value={form.provider}
                onChange={(v) => updateForm('provider', v)}
              />
            </div>

            {/* Dynamic provider-specific configuration fields. Only the
                fields for the currently-selected provider are rendered —
                fields for other providers are hidden (and neither
                validated nor submitted). Switching providers updates this
                list immediately without clearing already-typed values for
                fields shared across providers (e.g. `bucket` is used by
                both AMAZON_S3 and CLOUDFLARE_R2, so switching between them
                preserves the typed bucket name). */}
            {(PROVIDER_FIELDS[form.provider] ?? []).length > 0 && (
              <div className="space-y-3">
                {(PROVIDER_FIELDS[form.provider] ?? []).map((f) => {
                  const fieldValue = form.config[f.key] ?? '';
                  const inputId = `storage-config-${f.key}`;
                  return (
                    <div key={f.key} className="space-y-2">
                      <Label htmlFor={inputId}>
                        {f.label}
                        {f.required && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                      {f.multiline ? (
                        <Textarea
                          id={inputId}
                          placeholder={f.placeholder}
                          value={fieldValue}
                          onChange={(e) => updateConfigField(f.key, e.target.value)}
                          rows={4}
                          className="font-mono text-xs"
                        />
                      ) : (
                        <Input
                          id={inputId}
                          type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}
                          placeholder={f.placeholder}
                          value={fieldValue}
                          onChange={(e) => updateConfigField(f.key, e.target.value)}
                          autoComplete={f.type === 'password' ? 'new-password' : undefined}
                        />
                      )}
                      {f.helpText && (
                        <p className="text-xs text-muted-foreground">{f.helpText}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !isFormValid(form)}
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
