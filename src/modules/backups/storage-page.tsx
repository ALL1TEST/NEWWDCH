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
  AlertCircle,
  RefreshCw,
  Lock,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { cn, formatRelativeTime } from '@/lib/utils';
import type { ApiResponse, BackupStorageProvider } from '@/shared/types';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import {
  getProviderDefinition,
  getProvidersByCategory,
  type ProviderField,
  type FieldGroup,
  type ProviderCategory,
} from '@/lib/backup/provider-registry';

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

/** Connection lifecycle state for the currently-edited provider. Drives
 *  the action button label, the status indicator, and whether Create is
 *  enabled (for providers that require a validated connection). */
type ConnectionState = 'idle' | 'testing' | 'connected' | 'failed';

interface StorageForm {
  name: string;
  provider: BackupStorageProvider;
  // Per-field config values keyed by the provider field key. Values for
  // fields that belong to OTHER providers are cleared on provider switch
  // so only the current provider's fields are rendered, validated, and
  // submitted.
  config: Record<string, string>;
  // Whether the current provider's connection has been validated. Reset
  // to 'idle' whenever the provider changes or any connection/credential
  // field is edited (a previously-passed test is never silently reused
  // against a different credential set).
  connection: ConnectionState;
  connectionMessage: string;
}

const initialForm: StorageForm = {
  name: '',
  provider: 'LOCAL',
  config: {},
  connection: 'idle',
  connectionMessage: '',
};

// -------------------- Section label mapping --------------------

const SECTION_LABEL: Record<FieldGroup, string> = {
  connection: 'Connection',
  credentials: 'Credentials',
  destination: 'Destination',
};

// -------------------- Connection status badge --------------------

function ConnectionStatus({ state, message }: { state: ConnectionState; message: string }) {
  if (state === 'idle' || state === 'testing') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {state === 'testing' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <span>{state === 'testing' ? 'Testing connection…' : 'Not tested yet.'}</span>
      </div>
    );
  }
  if (state === 'connected') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 px-2.5 py-1.5 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-medium text-emerald-700 dark:text-emerald-300">Connected</span>
        {message && <span className="text-emerald-600/80 dark:text-emerald-400/80 truncate">— {message}</span>}
      </div>
    );
  }
  // failed
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-2.5 py-1.5 text-xs">
      <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-medium text-red-700 dark:text-red-300">Connection failed</p>
        {message && <p className="text-red-600/80 dark:text-red-400/80 break-words">{message}</p>}
        <p className="text-red-600/60 dark:text-red-400/60 mt-0.5">Invalid credentials or unreachable storage.</p>
      </div>
    </div>
  );
}

// -------------------- Provider Badge (table) --------------------

const CATEGORY_BADGE_CLASS: Record<ProviderCategory, string> = {
  LOCAL: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  OBJECT_STORAGE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CLOUD_DRIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  FILE_TRANSFER: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

function ProviderBadge({ provider }: { provider: BackupStorageProvider }) {
  const def = getProviderDefinition(provider);
  const category = def?.category ?? 'LOCAL';
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent font-medium', CATEGORY_BADGE_CLASS[category])}
    >
      {def?.name ?? provider}
    </Badge>
  );
}

// -------------------- Provider Dropdown (custom, categorized) --------------------

/** Custom categorized provider dropdown. Built on the Radix Popover so it
 *  inherits portal rendering (no clipping by the modal's overflow),
 *  outside-click + Escape close, and viewport-aware positioning. Options
 *  are grouped by category with small uppercase category labels. The
 *  panel width matches the trigger width. */
function ProviderDropdown({
  value,
  onChange,
  disabled,
}: {
  value: BackupStorageProvider;
  onChange: (v: BackupStorageProvider) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = getProviderDefinition(value);
  const SelectedIcon = selected?.icon ?? HardDrive;
  const categories = getProvidersByCategory();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-[color,box-shadow] hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex items-center gap-2 truncate text-left text-foreground">
            <SelectedIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{selected?.name ?? 'Select provider'}</span>
          </span>
          <ChevronDown
            className={cn('h-4 w-4 opacity-50 transition-transform shrink-0', open && 'rotate-180')}
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
        {/* Inner scroll area: tall enough to show all 11 providers + 4
            category labels on a typical viewport (≈480px) without
            scrolling; on shorter viewports it scrolls with the thin
            scrollbar. Capped at 70vh so the panel never overflows the
            viewport vertically. */}
        <div role="listbox" className="max-h-[70vh] overflow-y-auto storage-modal-scroll">
          {categories.map(({ category, label, providers }) => (
            <div key={category} className="py-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {label}
              </div>
              {providers.map((p) => {
                const isSelected = p.id === value;
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 justify-between rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent',
                      isSelected && 'bg-accent font-medium',
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{p.name}</span>
                      {p.status === 'coming_soon' && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Soon
                        </span>
                      )}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// -------------------- Search Empty State (inline) --------------------

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

// -------------------- Validation helpers --------------------

/** True when the Name field is non-empty AND every required field for the
 *  currently-selected provider has a non-empty value. For providers that
 *  require a validated connection, the connection state must also be
 *  'connected'. Coming-soon providers are never valid (Create disabled). */
function isFormValid(form: StorageForm): boolean {
  if (!form.name.trim()) return false;
  const def = getProviderDefinition(form.provider);
  if (!def) return false;
  if (def.status === 'coming_soon') return false;

  const allFieldsFilled = def.fields.every((f) => {
    if (!f.required) return true;
    const v = form.config[f.key];
    if (v == null) return false;
    return f.type === 'switch' ? true : v.trim() !== '';
  });
  if (!allFieldsFilled) return false;

  if (def.requiresConnection && form.connection !== 'connected') return false;
  return true;
}

/** Signature for the connection/credential-group fields of the current
 *  provider. Used to detect whether the user has edited any such field
 *  since the last Test/Connect — if so, the 'connected' state is stale. */
function connectionSignature(form: StorageForm): string {
  const def = getProviderDefinition(form.provider);
  if (!def) return '';
  const groups: FieldGroup[] =
    def.connectionType === 'oauth' ? ['connection'] : ['credentials'];
  return def.fields
    .filter((f) => groups.includes(f.group))
    .map((f) => `${f.key}=${form.config[f.key] ?? ''}`)
    .join('|');
}

/** True when all required connection/credential fields are filled, so the
 *  Test/Connect button can be enabled. */
function canValidateConnection(form: StorageForm): boolean {
  const def = getProviderDefinition(form.provider);
  if (!def || def.connectionType === 'none') return false;
  const groups: FieldGroup[] =
    def.connectionType === 'oauth' ? ['connection'] : ['credentials'];
  return def.fields
    .filter((f) => groups.includes(f.group))
    .every((f) => {
      if (!f.required) return true;
      const v = form.config[f.key];
      return v != null && v.trim() !== '';
    });
}

/** Detects password-type connection/credential fields still holding the
 *  API mask placeholder ('••••••••'). When editing an existing storage,
 *  secrets come back masked; re-testing with a mask sends a bogus secret.
 *  We block the test and ask the user to re-enter the secret. */
function maskedSecretFields(form: StorageForm): string[] {
  const def = getProviderDefinition(form.provider);
  if (!def) return [];
  const groups: FieldGroup[] =
    def.connectionType === 'oauth' ? ['connection'] : ['credentials'];
  return def.fields
    .filter((f) => f.type === 'password' && groups.includes(f.group))
    .map((f) => f.label)
    .filter((label) => label && label.length > 0)
    .filter((_, i) => {
      const f = def.fields
        .filter((x) => x.type === 'password' && groups.includes(x.group))[i];
      const v = form.config[f.key];
      return typeof v === 'string' && v.includes('•');
    });
}

/** Build the config object from the current provider's fields only. Empty
 *  optional fields are omitted. Number fields → Number. Switch → boolean. */
function buildConfigObject(form: StorageForm): Record<string, unknown> {
  const def = getProviderDefinition(form.provider);
  if (!def) return {};
  const configObj: Record<string, unknown> = {};
  for (const field of def.fields) {
    const raw = form.config[field.key];
    if (raw == null || raw.trim() === '') continue;
    if (field.type === 'number') {
      const n = Number(raw);
      if (!Number.isNaN(n)) configObj[field.key] = n;
    } else if (field.type === 'switch') {
      configObj[field.key] = raw === 'true';
    } else {
      configObj[field.key] = raw;
    }
  }
  return configObj;
}

// -------------------- Storage Page --------------------

export function StoragePage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StorageForm>(initialForm);
  const [deleteTarget, setDeleteTarget] = useState<StorageRow | null>(null);
  // Captures the connection signature at the moment of the last successful
  // validation. If the user edits any connection field afterwards, the
  // signature no longer matches and the 'connected' state is invalidated.
  const [validatedSignature, setValidatedSignature] = useState<string>('');

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

  const hasSearch = !!table.searchValue?.trim();
  const isInitialEmpty = !isLoading && storages.length === 0 && !hasSearch;
  const isSearchEmpty = !isLoading && storages.length === 0 && hasSearch;

  const createMutation = useMutation({
    mutationFn: (body: { name: string; provider: BackupStorageProvider; config: string; isActive: boolean }) =>
      postApi('/api/backups/storage', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStorage.all });
      toast.success('Storage configuration created');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create storage configuration'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string; provider: BackupStorageProvider; config: string; isActive: boolean } }) =>
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

  const testRowMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/backups/storage/${id}/test-connection`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStorage.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backupStorage.all });
      toast.success('Connection test passed');
    },
    onError: (err: Error) => toast.error(err.message || 'Connection test failed'),
  });

  // Create-flow validation: tests the connection against the form's current
  // (unpersisted) config by POSTing to /api/backups/storage?action=test.
  // The backend runs the real provider adapter — S3/R2/Wasabi/B2 use
  // ListObjectsV2 via @aws-sdk/client-s3; FTP uses basic-ftp access;
  // Google Drive/Dropbox/OneDrive perform a real OAuth refresh-token
  // exchange + API ping. No fake success. Used by both the Test Connection
  // and Connect buttons (they share the same real test mechanism).
  const testFlowMutation = useMutation({
    mutationFn: async (f: StorageForm) => {
      const configObj = buildConfigObject(f);
      return postApi<{ data: { success: boolean; message: string } }>(
        '/api/backups/storage?action=test',
        {
          name: f.name,
          provider: f.provider,
          config: JSON.stringify(configObj),
          isActive: true,
        },
      );
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setValidatedSignature('');
    setDialogOpen(true);
  };

  const openEdit = (row: StorageRow) => {
    setEditingId(row.id);
    // Flatten the stored config object into a string map for form inputs.
    // Secrets come back masked from the API ('••••••••'); show them as
    // the mask so the user knows a value is stored, and rely on the
    // backend merge-on-PATCH to preserve them if left unchanged.
    const storedConfig = row.config ?? {};
    const formConfig: Record<string, string> = {};
    for (const [k, v] of Object.entries(storedConfig)) {
      if (typeof v === 'boolean') {
        formConfig[k] = v ? 'true' : 'false';
      } else {
        formConfig[k] = v == null ? '' : String(v);
      }
    }

    // Derive the initial connection state from the stored row.
    let initialConnection: ConnectionState = 'idle';
    let initialMessage = '';
    const def = getProviderDefinition(row.provider);
    if (def && def.requiresConnection && def.status === 'available') {
      const groups: FieldGroup[] =
        def.connectionType === 'oauth' ? ['connection'] : ['credentials'];
      const hasCreds = def.fields
        .filter((f) => groups.includes(f.group) && f.required)
        .every((f) => {
          const v = formConfig[f.key];
          return v != null && v.trim() !== '';
        });
      if (hasCreds) {
        if (def.connectionType === 'credentials') {
          let testResult: { success?: boolean; message?: string } | null = null;
          try {
            testResult = row.lastTestResult ? JSON.parse(row.lastTestResult) : null;
          } catch {
            testResult = null;
          }
          if (testResult && testResult.success === true) {
            initialConnection = 'connected';
            initialMessage = testResult.message ?? '';
          } else if (row.isActive) {
            initialConnection = 'connected';
          }
        } else {
          // OAuth — credentials present implies a prior successful Connect.
          initialConnection = 'connected';
          initialMessage = 'Credentials configured';
        }
      }
    }

    setForm({
      name: row.name,
      provider: row.provider,
      config: formConfig,
      connection: initialConnection,
      connectionMessage: initialMessage,
    });
    setValidatedSignature(connectionSignature({
      name: row.name,
      provider: row.provider,
      config: formConfig,
      connection: initialConnection,
      connectionMessage: initialMessage,
    }));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(initialForm);
    setValidatedSignature('');
  };

  const updateConfigField = (key: string, value: string) => {
    setForm((prev) => {
      const def = getProviderDefinition(prev.provider);
      const groups: FieldGroup[] =
        def?.connectionType === 'oauth' ? ['connection'] : ['credentials'];
      const isConnField = def?.fields.some(
        (f) => f.key === key && groups.includes(f.group),
      );
      const nextConnection: ConnectionState =
        isConnField && prev.connection !== 'idle' && prev.connection !== 'testing'
          ? 'idle'
          : prev.connection;
      return {
        ...prev,
        config: { ...prev.config, [key]: value },
        connection: nextConnection,
        connectionMessage: nextConnection === 'idle' ? '' : prev.connectionMessage,
      };
    });
  };

  // Switching providers: clear ALL previous provider's config fields and
  // reset the connection state. The new provider starts fresh with empty
  // fields (only default values are seeded, e.g. FTP port=21).
  const handleProviderChange = (next: BackupStorageProvider) => {
    setForm((prev) => {
      const oldDef = getProviderDefinition(prev.provider);
      const cleared: Record<string, string> = { ...prev.config };
      if (oldDef) {
        for (const f of oldDef.fields) {
          delete cleared[f.key];
        }
      }
      const newDef = getProviderDefinition(next);
      if (newDef) {
        for (const f of newDef.fields) {
          if (f.default !== undefined) {
            cleared[f.key] = f.type === 'switch'
              ? (f.default ? 'true' : 'false')
              : String(f.default);
          }
        }
      }
      return {
        ...prev,
        provider: next,
        config: cleared,
        connection: 'idle',
        connectionMessage: '',
      };
    });
    setValidatedSignature('');
  };

  const updateForm = <K extends keyof StorageForm>(key: K, value: StorageForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!isFormValid(form)) return;
    const configObj = buildConfigObject(form);
    const def = getProviderDefinition(form.provider);
    const isActive = def?.requiresConnection ? form.connection === 'connected' : true;
    const body = {
      name: form.name,
      provider: form.provider,
      config: JSON.stringify(configObj),
      isActive,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ---- Test Connection / Connect (shared real test) ----
  // Sends the form's current config to the backend test action, which
  // runs the real provider adapter. On success, marks the form
  // 'connected' and captures the signature so any subsequent edit
  // invalidates the state. For OAuth providers, a successful Connect
  // reveals the destination (Folder) field.
  const handleTestOrConnect = async () => {
    const def = getProviderDefinition(form.provider);
    if (!def || def.connectionType === 'none') return;
    if (!form.name.trim()) {
      toast.error('Enter a name first');
      return;
    }
    if (!canValidateConnection(form)) {
      toast.error('Fill all required fields first');
      return;
    }
    const masked = maskedSecretFields(form);
    if (masked.length > 0) {
      toast.error(`Re-enter the masked credentials (${masked.join(', ')}) to re-test.`);
      return;
    }
    setForm((prev) => ({ ...prev, connection: 'testing', connectionMessage: '' }));
    try {
      const res = await testFlowMutation.mutateAsync(form);
      const result = res?.data ?? res;
      const success = result?.success === true;
      const message = result?.message ?? '';
      setForm((prev) => ({
        ...prev,
        connection: success ? 'connected' : 'failed',
        connectionMessage: message,
      }));
      setValidatedSignature(connectionSignature(form));
      if (success) {
        toast.success(def.connectionType === 'oauth' ? `${def.name} connected` : 'Connection test passed');
      } else {
        toast.error(message || 'Connection test failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      setForm((prev) => ({ ...prev, connection: 'failed', connectionMessage: message }));
      toast.error(message);
    }
  };

  const handleDisconnect = () => {
    setForm((prev) => ({
      ...prev,
      connection: 'idle',
      connectionMessage: '',
    }));
    setValidatedSignature('');
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isTesting = testFlowMutation.isPending;
  const currentDef = getProviderDefinition(form.provider);
  const currentSignature = connectionSignature(form);
  // If the form was validated but the user edited a connection field since,
  // the connection state is stale — treat as needing re-validation.
  const connectionStale =
    currentDef?.requiresConnection === true &&
    form.connection === 'connected' &&
    validatedSignature !== '' &&
    currentSignature !== validatedSignature;

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
      size: 160,
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
              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
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
        let parsed: { success?: boolean; message?: string } | null = null;
        try { parsed = JSON.parse(result); } catch { parsed = null; }
        const success = parsed?.success === true || result === 'SUCCESS';
        const message = parsed?.message;
        return success ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
            title={message}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Passed
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"
            title={message ?? result}
          >
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
              onClick={() => testRowMutation.mutate(row.id)}
              disabled={testRowMutation.isPending}
            >
              {testRowMutation.isPending ? (
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

  // ---- Modal body field-grouping helpers ----
  // Renders the provider-specific configuration as a set of subtle
  // section groups (CONNECTION / CREDENTIALS / DESTINATION), each with
  // its own small uppercase label. Only the groups that the provider
  // actually uses are rendered, so there are no empty sections.
  const renderConfigSection = () => {
    if (!currentDef) return null;

    // Coming-soon preview: show fields read-only + a banner. No test, no
    // create (the API rejects and the form's isFormValid returns false).
    if (currentDef.status === 'coming_soon') {
      return (
        <div className="space-y-3 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-800/40 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {currentDef.name} — coming soon
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Field preview. This provider isn't wired up yet — choose another destination to create now.
          </p>
          <div className="space-y-3 pt-1">
            {currentDef.fields.map((f) => (
              <ConfigField
                key={f.key}
                field={f}
                value={form.config[f.key] ?? ''}
                onChange={() => {}}
                disabled
              />
            ))}
          </div>
        </div>
      );
    }

    // Determine which groups this provider uses, in display order.
    const groupsUsed: FieldGroup[] = [];
    if (currentDef.connectionType === 'oauth') {
      groupsUsed.push('connection', 'destination');
    } else if (currentDef.connectionType === 'credentials') {
      groupsUsed.push('credentials');
    } else {
      // Local
      groupsUsed.push('destination');
    }

    return (
      <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
        {groupsUsed.map((group) => {
          const fields = currentDef.fields.filter((f) => f.group === group);
          if (fields.length === 0) return null;

          // For OAuth, only render the destination group AFTER a
          // successful (non-stale) connection. Before connecting, show
          // a "connect first" hint instead of the folder field.
          if (
            group === 'destination' &&
            currentDef.connectionType === 'oauth' &&
            (form.connection !== 'connected' || connectionStale)
          ) {
            return (
              <div key={group} className="space-y-2">
                <SectionLabel label={SECTION_LABEL[group]} />
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  <span>Connect the account first to choose a destination folder.</span>
                </div>
              </div>
            );
          }

          // For OAuth, when connected (non-stale), collapse the
          // connection group into a compact "Connected ✓" summary with
          // a Disconnect affordance — the user doesn't need to see the
          // raw credential fields once linked.
          if (
            group === 'connection' &&
            currentDef.connectionType === 'oauth' &&
            form.connection === 'connected' &&
            !connectionStale
          ) {
            return (
              <div key={group} className="space-y-2">
                <div className="flex items-center justify-between">
                  <SectionLabel label={SECTION_LABEL[group]} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </Button>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      {currentDef.name} connected
                    </p>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 truncate">
                      {form.connectionMessage || 'Credentials configured'}
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={group} className="space-y-2">
              <SectionLabel label={SECTION_LABEL[group]} />
              <div className="space-y-3">
                {fields.map((f) => (
                  <ConfigField
                    key={f.key}
                    field={f}
                    value={form.config[f.key] ?? ''}
                    onChange={(v) => updateConfigField(f.key, v)}
                    disabled={isTesting}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Inline connection status (success/failure) for credentials
            and OAuth providers, shown beneath the fields. The action
            button itself lives in the modal footer. */}
        {currentDef.connectionType !== 'none' &&
          form.connection !== 'idle' &&
          form.connection !== 'testing' &&
          !(currentDef.connectionType === 'oauth' && form.connection === 'connected' && !connectionStale) && (
            <ConnectionStatus
              state={connectionStale ? 'idle' : form.connection}
              message={connectionStale ? '' : form.connectionMessage}
            />
          )}
        {connectionStale && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Credentials changed — re-test the connection.
          </p>
        )}
      </div>
    );
  };

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

      {/* Add / Edit Storage Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent
          className="sm:max-w-[560px] p-0 gap-0 overflow-hidden"
          /* Prevent clicks OUTSIDE the dialog content (e.g. on the
             portal-rendered provider dropdown panel) from closing the
             modal mid-edit. The dropdown is a separate DismissableLayer
             that manages its own open state; this only stops the Dialog
             from being dismissed by pointer events that originate on the
             Popover portal. The modal still closes via Cancel / Close /
             Escape, which is the intended UX for a form. */
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* Header (fixed) */}
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="text-base">
              {editingId ? 'Edit Storage' : 'Add Storage'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingId ? 'Update storage destination configuration.' : 'Configure a backup storage destination.'}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable config content (thin scrollbar) */}
          <div className="storage-modal-scroll px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="storage-name" className="text-xs">
                Name<span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                id="storage-name"
                placeholder="e.g., Production R2 Bucket"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </div>

            {/* Provider */}
            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <ProviderDropdown
                value={form.provider}
                onChange={handleProviderChange}
              />
            </div>

            {/* Provider-specific configuration (renders generically from
                the registry — no provider-specific UI logic here) */}
            {renderConfigSection()}
          </div>

          {/* Footer (fixed) */}
          <DialogFooter className="px-5 py-3 border-t border-border bg-muted/20 flex flex-row items-center justify-between sm:justify-between">
            {/* Left: Test Connection / Connect action (only for
                providers that need a connection, and only when it makes
                sense — e.g. hidden for OAuth once already connected). */}
            <div className="flex items-center gap-2">
              {currentDef && currentDef.connectionType !== 'none' && currentDef.status === 'available' && !(
                currentDef.connectionType === 'oauth' &&
                form.connection === 'connected' &&
                !connectionStale
              ) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestOrConnect}
                  disabled={
                    isTesting ||
                    !canValidateConnection(form) ||
                    (currentDef.connectionType === 'credentials' && !form.name.trim())
                  }
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : currentDef.connectionType === 'oauth' ? (
                    <Plug className="h-4 w-4 mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {currentDef.actionLabel}
                </Button>
              )}
            </div>

            {/* Right: Cancel + Create */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSaving || !isFormValid(form)}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
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

// -------------------- Section label --------------------

function SectionLabel({ label }: { label: string }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {label}
    </h4>
  );
}

// -------------------- Config Field Renderer --------------------
// Renders a single provider field generically. Password fields mask
// their value (type=password + a lock affordance). Switch fields use
// the Switch component. Multiline password fields (e.g. GCS private
// key) render as a masked Textarea. The component is fully driven by
// the ProviderField definition — it has no provider-specific logic.

function ConfigField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ProviderField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputId = `storage-config-${field.key}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-xs">
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {field.type === 'switch' ? (
        <div className="flex items-center gap-2 h-9">
          <Switch
            id={inputId}
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
            disabled={disabled}
          />
          <span className="text-xs text-muted-foreground">
            {value === 'true' ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      ) : field.type === 'password' && field.multiline ? (
        <Textarea
          id={inputId}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          disabled={disabled}
          className="font-mono text-xs"
        />
      ) : (
        <div className="relative">
          <Input
            id={inputId}
            type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            autoComplete={field.type === 'password' ? 'new-password' : undefined}
            className={field.type === 'password' ? 'pr-9' : ''}
          />
          {field.type === 'password' && value && (
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
          )}
        </div>
      )}
      {field.helpText && (
        <p className="text-xs text-muted-foreground leading-relaxed">{field.helpText}</p>
      )}
    </div>
  );
}
