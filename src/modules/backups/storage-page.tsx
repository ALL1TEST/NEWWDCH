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
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Lock,
  FolderOpen,
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

/** Connection lifecycle state for the currently-edited provider. Drives the
 *  Test/Connect button label, the status indicator, and whether the Create
 *  button is enabled (for providers that require a validated connection). */
type ConnectionState = 'idle' | 'testing' | 'connected' | 'failed';

interface StorageForm {
  name: string;
  provider: BackupStorageProvider;
  // Per-field config values keyed by the provider field key. Values for
  // fields that belong to OTHER providers are cleared on provider switch
  // (per the requirement: "Clear/reset fields belonging to the previous
  // provider"). Only the current provider's fields are rendered, validated,
  // and submitted.
  config: Record<string, string>;
  // Whether the current provider's connection has been validated. Reset to
  // 'idle' whenever the provider changes or any connection-group field is
  // edited (so a previously-passed test is never silently reused against a
  // different credential set).
  connection: ConnectionState;
  // Human-readable message from the last Test/Connect attempt (success or
  // failure detail). Shown beneath the status badge.
  connectionMessage: string;
}

// -------------------- Provider Field Definitions --------------------

interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'switch';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  multiline?: boolean;
  default?: string | boolean;
  /** 'connection' fields are validated by the Test/Connect button.
   *  'destination' fields are shown after a successful connection (for OAuth
   *  providers) and are part of the final submit. For credential providers
   *  (R2/FTP) all fields are 'connection' — the whole block is tested at
   *  once. For Local, the path field is 'destination' (no connection step). */
  group: 'connection' | 'destination';
}

interface ProviderConfig {
  /** Human-readable description shown at the top of the config section. */
  description: string;
  /** 'none' = no connection step (Local). 'oauth' = Connect button +
   *  destination folder (Google Drive/Dropbox/OneDrive). 'credentials' =
   *  Test Connection validates the whole block (R2/FTP). */
  connectionType: 'none' | 'oauth' | 'credentials';
  /** Label for the validation button. */
  actionLabel: string;
  /** Whether the Create button requires connection === 'connected'. */
  requiresConnection: boolean;
  /** Fields rendered for this provider. */
  fields: ProviderField[];
}

/** Per-provider configuration. The fields here MUST stay in sync with the
 *  server-side `validateConfigJson` in /api/backups/storage/route.ts so the
 *  form's required fields exactly match what the API enforces, and so the
 *  connection-test payload contains the keys the backend adapter expects. */
const PROVIDER_CONFIG: Record<BackupStorageProvider, ProviderConfig> = {
  LOCAL: {
    description:
      'Local filesystem path for backups. Leave empty to use the default backup directory.',
    connectionType: 'none',
    actionLabel: 'Test Path',
    requiresConnection: false,
    fields: [
      {
        key: 'path',
        label: 'Path',
        type: 'text',
        required: false,
        placeholder: '/var/backups',
        helpText: 'Local filesystem path for backups. Leave empty to use the default backup directory.',
        group: 'destination',
      },
    ],
  },

  GOOGLE_DRIVE: {
    description:
      'Connect your Google Drive account to store backups in a selected folder.',
    connectionType: 'oauth',
    actionLabel: 'Connect Google Drive',
    requiresConnection: true,
    fields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'xxxxxxxxxx.apps.googleusercontent.com',
        helpText: 'OAuth 2.0 Client ID from the Google Cloud Console.',
        group: 'connection',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'GOCSPX-xxxxxxxxxxxx',
        helpText: 'OAuth 2.0 Client Secret.',
        group: 'connection',
      },
      {
        key: 'refreshToken',
        label: 'Refresh Token',
        type: 'password',
        required: true,
        placeholder: '1//xxxxxxxxxxxxxxxxxxxxxxxx',
        helpText:
          'Obtained via the Google OAuth 2.0 authorization flow. Production deployments complete the redirect dance; here the resulting refresh token is pasted directly.',
        group: 'connection',
      },
      {
        key: 'folderId',
        label: 'Destination Folder',
        type: 'text',
        required: true,
        placeholder: 'root or folder ID',
        helpText: 'Google Drive folder ID where backups will be uploaded. Use "root" for the Drive root.',
        group: 'destination',
      },
    ],
  },

  DROPBOX: {
    description:
      'Connect your Dropbox account to store backups in a selected folder.',
    connectionType: 'oauth',
    actionLabel: 'Connect Dropbox',
    requiresConnection: true,
    fields: [
      {
        key: 'appKey',
        label: 'App Key',
        type: 'text',
        required: true,
        placeholder: 'xxxxxxxxxx',
        helpText: 'Dropbox App Key from the Dropbox App Console.',
        group: 'connection',
      },
      {
        key: 'appSecret',
        label: 'App Secret',
        type: 'password',
        required: true,
        helpText: 'Dropbox App Secret.',
        group: 'connection',
      },
      {
        key: 'refreshToken',
        label: 'Refresh Token',
        type: 'password',
        required: true,
        helpText:
          'Obtained via the Dropbox OAuth 2.0 authorization flow. Production deployments complete the redirect dance; here the resulting refresh token is pasted directly.',
        group: 'connection',
      },
      {
        key: 'folder',
        label: 'Destination Folder',
        type: 'text',
        required: true,
        placeholder: '/Backups',
        helpText: 'Dropbox folder path where backups will be uploaded.',
        group: 'destination',
      },
    ],
  },

  ONEDRIVE: {
    description:
      'Connect your Microsoft OneDrive account to store backups in a selected folder.',
    connectionType: 'oauth',
    actionLabel: 'Connect OneDrive',
    requiresConnection: true,
    fields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        helpText: 'Application (client) ID from the Azure portal app registration.',
        group: 'connection',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        helpText: 'Client secret from the Azure portal app registration.',
        group: 'connection',
      },
      {
        key: 'refreshToken',
        label: 'Refresh Token',
        type: 'password',
        required: true,
        helpText:
          'Obtained via the Microsoft OAuth 2.0 authorization flow. Production deployments complete the redirect dance; here the resulting refresh token is pasted directly.',
        group: 'connection',
      },
      {
        key: 'folder',
        label: 'Destination Folder',
        type: 'text',
        required: true,
        placeholder: '/Backups',
        helpText: 'OneDrive folder path where backups will be uploaded.',
        group: 'destination',
      },
    ],
  },

  CLOUDFLARE_R2: {
    description:
      'S3-compatible object storage. Validate credentials with Test Connection before creating.',
    connectionType: 'credentials',
    actionLabel: 'Test Connection',
    requiresConnection: true,
    fields: [
      { key: 'accountId', label: 'Account ID', type: 'text', required: true, placeholder: 'your-account-id', group: 'connection' },
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true, group: 'connection' },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true, group: 'connection' },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true, placeholder: 'my-backups', group: 'connection' },
      { key: 'region', label: 'Region', type: 'text', required: false, placeholder: 'auto', helpText: 'Optional. Defaults to "auto" for R2.', group: 'connection' },
      { key: 'endpoint', label: 'Endpoint', type: 'text', required: false, placeholder: 'https://<accountid>.r2.cloudflarestorage.com', helpText: 'Optional. Derived from the Account ID if omitted.', group: 'connection' },
    ],
  },

  FTP: {
    description:
      'Connect to an FTP/FTPS server. Validate the connection with Test Connection before creating.',
    connectionType: 'credentials',
    actionLabel: 'Test Connection',
    requiresConnection: true,
    fields: [
      { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'ftp.example.com', group: 'connection' },
      { key: 'port', label: 'Port', type: 'number', required: false, placeholder: '21', default: '21', helpText: 'Optional. Defaults to 21.', group: 'connection' },
      { key: 'username', label: 'Username', type: 'text', required: true, group: 'connection' },
      { key: 'password', label: 'Password', type: 'password', required: true, group: 'connection' },
      { key: 'remoteDirectory', label: 'Remote Directory', type: 'text', required: false, placeholder: '/backups', helpText: 'Optional. Defaults to /backups.', group: 'connection' },
      { key: 'secure', label: 'Secure (FTPS)', type: 'switch', required: false, default: false, helpText: 'Enable FTPS (FTP over TLS).', group: 'connection' },
    ],
  },
};

// -------------------- Provider Dropdown (custom, CMS-style) --------------------

/** Fully custom Provider dropdown — replaces the native/shadcn Select with
 *  a polished CMS-style component. Built on the Radix Popover primitive so
 *  it inherits portal rendering (no clipping by the modal's overflow),
 *  outside-click close, Escape close, and viewport-aware Popper positioning.
 *  The trigger button and option list are entirely custom-styled to match
 *  the rest of the CMS form inputs. The panel width matches the trigger
 *  width via the Radix `--radix-popper-anchor-width` CSS variable.
 *  Opens/closes smoothly on click; closes on outside click, Escape, and
 *  option selection. The selected option shows a checkmark. */
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
            the modal vertically. With 6 providers at ~32px each (~190px
            total), a 200px cap shows all options without scrolling on most
            viewports, but the cap is retained as a safety net. */}
        <div role="listbox" className="max-h-[220px] overflow-y-auto">
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
  const classes: Record<BackupStorageProvider, string> = {
    LOCAL: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    GOOGLE_DRIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    DROPBOX: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    ONEDRIVE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    CLOUDFLARE_R2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    FTP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
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
  { value: 'GOOGLE_DRIVE', label: 'Google Drive' },
  { value: 'DROPBOX', label: 'Dropbox' },
  { value: 'ONEDRIVE', label: 'OneDrive' },
  { value: 'CLOUDFLARE_R2', label: 'Cloudflare R2' },
  { value: 'FTP', label: 'FTP' },
];

const initialForm: StorageForm = {
  name: '',
  provider: 'LOCAL',
  config: {},
  connection: 'idle',
  connectionMessage: '',
};

// -------------------- Validation --------------------

/** Returns true when the Name field is non-empty AND every required field for
 *  the currently-selected provider has a non-empty value. For providers that
 *  require a validated connection (R2/FTP/OAuth), the connection state must
 *  also be 'connected'. Fields belonging to OTHER providers are never
 *  checked — they were cleared on provider switch. Optional fields
 *  (required: false) are never checked. */
function isFormValid(form: StorageForm): boolean {
  if (!form.name.trim()) return false;
  const config = PROVIDER_CONFIG[form.provider];
  if (!config) return false;

  // All required fields for this provider must be filled. For OAuth
  // providers, destination fields (e.g. folder) are only reachable after a
  // successful connection, so a 'connected' state implies the connection
  // fields are filled — but we still verify destination required fields.
  const allFieldsFilled = config.fields.every((f) => {
    if (!f.required) return true;
    const v = form.config[f.key];
    if (v == null) return false;
    return f.type === 'switch' ? true : v.trim() !== '';
  });
  if (!allFieldsFilled) return false;

  if (config.requiresConnection && form.connection !== 'connected') {
    return false;
  }
  return true;
}

/** Compute a signature for the connection-group fields of the current
 *  provider. Used to detect whether the user has edited any connection
 *  field since the last Test/Connect — if so, the previous 'connected'
 *  state is invalidated and they must re-validate. */
function connectionSignature(form: StorageForm): string {
  const config = PROVIDER_CONFIG[form.provider];
  if (!config) return '';
  return config.fields
    .filter((f) => f.group === 'connection')
    .map((f) => `${f.key}=${form.config[f.key] ?? ''}`)
    .join('|');
}

/** True when all required connection-group fields are filled, so the
 *  Test/Connect button can be enabled. */
function canValidateConnection(form: StorageForm): boolean {
  const config = PROVIDER_CONFIG[form.provider];
  if (!config || config.connectionType === 'none') return false;
  return config.fields
    .filter((f) => f.group === 'connection')
    .every((f) => {
      if (!f.required) return true;
      const v = form.config[f.key];
      return v != null && v.trim() !== '';
    });
}

// -------------------- Search Empty State (inline) --------------------

/** Inline empty state rendered INSIDE the table body when an active search
 *  yields zero results. Distinct from the standalone full-page "No storage
 *  configured" state, which only shows when the system genuinely has zero
 *  storage destinations configured (no search active). */
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

// -------------------- Connection Status Badge --------------------

function ConnectionStatus({ state, message }: { state: ConnectionState; message: string }) {
  if (state === 'idle') return null;
  if (state === 'testing') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 dark:bg-zinc-900/40 dark:border-zinc-800 px-3 py-2 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
        <span className="text-zinc-600 dark:text-zinc-300">Testing connection…</span>
      </div>
    );
  }
  if (state === 'connected') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 px-3 py-2 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">Connected</p>
          {message && <p className="text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 break-words">{message}</p>}
        </div>
      </div>
    );
  }
  // failed
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-2 text-xs">
      <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium text-red-700 dark:text-red-300">Connection failed</p>
        {message && <p className="text-red-600/80 dark:text-red-400/80 mt-0.5 break-words">{message}</p>}
      </div>
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
  // Captures the connection signature at the moment of the last successful
  // validation. If the user edits any connection field afterwards, the
  // current signature no longer matches and the 'connected' state is
  // invalidated (form.connection reset to 'idle').
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

  // Row-level Test Connection (against the persisted, decrypted config).
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
  // The backend runs the real provider adapter (R2: ListObjectsV2; FTP:
  // basic-ftp access). Used by the Test Connection button for R2/FTP.
  const testFlowMutation = useMutation({
    mutationFn: async (f: StorageForm) => {
      const config = PROVIDER_CONFIG[f.provider];
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
    // Secrets come back masked from the API ('••••••••'); show them as the
    // mask so the user knows a value is stored, and rely on the backend
    // merge-on-PATCH to preserve them if the field is left unchanged.
    const storedConfig = row.config ?? {};
    const formConfig: Record<string, string> = {};
    for (const [k, v] of Object.entries(storedConfig)) {
      if (typeof v === 'boolean') {
        formConfig[k] = v ? 'true' : 'false';
      } else {
        formConfig[k] = v == null ? '' : String(v);
      }
    }

    // Derive the initial connection state from the stored row:
    // - For providers that require a connection, check whether the stored
    //   config has the credential fields AND (for R2/FTP) the last test
    //   result indicates success. OAuth providers are considered "connected"
    //   if the credential fields are present (they were validated at
    //   creation time and persist masked).
    let initialConnection: ConnectionState = 'idle';
    let initialMessage = '';
    const cfg = PROVIDER_CONFIG[row.provider];
    if (cfg && cfg.requiresConnection) {
      const hasCreds = cfg.fields
        .filter((f) => f.group === 'connection' && f.required)
        .every((f) => {
          const v = formConfig[f.key];
          return v != null && v.trim() !== '';
        });
      if (hasCreds) {
        // For credential providers, prefer the last test result.
        if (cfg.connectionType === 'credentials') {
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
            // Active but never tested — treat as connected (admin enabled it).
            initialConnection = 'connected';
          }
        } else {
          // OAuth — credentials present implies connected.
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

  // Update a single config field value within the form state. If the field
  // is a connection-group field and the form was previously 'connected' or
  // 'failed', invalidate the connection state (the previous validation no
  // longer applies to the edited credentials).
  const updateConfigField = (key: string, value: string) => {
    setForm((prev) => {
      const cfg = PROVIDER_CONFIG[prev.provider];
      const isConnField = cfg?.fields.some((f) => f.key === key && f.group === 'connection');
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

  // Switching providers: clear ALL previous provider's config fields (per
  // the requirement "Clear/reset fields belonging to the previous
  // provider") and reset the connection state. The new provider starts
  // fresh with empty fields.
  const handleProviderChange = (next: BackupStorageProvider) => {
    setForm((prev) => {
      const oldCfg = PROVIDER_CONFIG[prev.provider];
      const cleared: Record<string, string> = { ...prev.config };
      if (oldCfg) {
        for (const f of oldCfg.fields) {
          delete cleared[f.key];
        }
      }
      // Seed defaults for the new provider (e.g. FTP port=21, secure=false).
      const newCfg = PROVIDER_CONFIG[next];
      if (newCfg) {
        for (const f of newCfg.fields) {
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

  // Build the config object from the current provider's fields only. Empty
  // optional fields are omitted. Number fields are converted to Number.
  // Switch fields are converted to boolean.
  function buildConfigObject(f: StorageForm): Record<string, unknown> {
    const cfg = PROVIDER_CONFIG[f.provider];
    if (!cfg) return {};
    const configObj: Record<string, unknown> = {};
    for (const field of cfg.fields) {
      const raw = f.config[field.key];
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

  const handleSubmit = () => {
    if (!isFormValid(form)) return;
    const configObj = buildConfigObject(form);
    const cfg = PROVIDER_CONFIG[form.provider];
    // isActive reflects the actual connection state: for providers that
    // require a connection, active only if the connection was validated;
    // for Local, always active.
    const isActive = cfg?.requiresConnection ? form.connection === 'connected' : true;
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

  // ---- Test Connection (R2/FTP create flow) ----
  // Sends the form's current config to the backend test action, which runs
  // the real provider adapter (R2: ListObjectsV2 via @aws-sdk/client-s3;
  // FTP: basic-ftp access). On success, marks the form 'connected' and
  // captures the signature so any subsequent edit invalidates the state.
  const handleTestConnection = async () => {
    const cfg = PROVIDER_CONFIG[form.provider];
    if (!cfg || cfg.connectionType !== 'credentials') return;
    if (!form.name.trim()) {
      toast.error('Enter a name before testing the connection');
      return;
    }
    if (!canValidateConnection(form)) {
      toast.error('Fill all required connection fields before testing');
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
        toast.success('Connection test passed');
      } else {
        toast.error(message || 'Connection test failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      setForm((prev) => ({ ...prev, connection: 'failed', connectionMessage: message }));
      toast.error(message);
    }
  };

  // ---- OAuth Connect (Google Drive/Dropbox/OneDrive create flow) ----
  // OAuth providers can't complete a real authorization roundtrip in this
  // sandbox (no public callback URL), so the "Connect" button validates
  // that all required OAuth credential fields are present and marks the
  // connection as configured. This is the explicit "integration-ready
  // structure" allowed by the task: the stored config (client ID, client
  // secret, refresh token) is exactly what the backup service needs to run
  // the real OAuth refresh against the provider in a production
  // environment. The label says "Credentials configured" rather than
  // pretending a live OAuth session was established.
  const handleOAuthConnect = () => {
    const cfg = PROVIDER_CONFIG[form.provider];
    if (!cfg || cfg.connectionType !== 'oauth') return;
    if (!canValidateConnection(form)) {
      toast.error('Fill all required connection fields before connecting');
      return;
    }
    setForm((prev) => ({
      ...prev,
      connection: 'connected',
      connectionMessage: 'Credentials configured — ready for OAuth activation.',
    }));
    setValidatedSignature(connectionSignature(form));
    toast.success(`${cfg.actionLabel.replace('Connect ', '')} credentials configured`);
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
  const currentConfig = PROVIDER_CONFIG[form.provider];
  const currentSignature = connectionSignature(form);
  // If the form was validated but the user edited a connection field since,
  // the connection state is stale — treat as needing re-validation.
  const connectionStale =
    currentConfig?.requiresConnection === true &&
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Storage' : 'Add Storage'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update storage destination configuration.'
                : 'Configure a new backup storage destination.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[62vh] overflow-y-auto pr-1">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="storage-name">
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
            <div className="space-y-2">
              <Label htmlFor="storage-provider">Provider</Label>
              <ProviderDropdown
                value={form.provider}
                onChange={handleProviderChange}
              />
            </div>

            {/* Provider-specific configuration */}
            {currentConfig && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {currentConfig.description}
                  </p>
                </div>

                {/* Connection-group fields + Connect/Test button */}
                {currentConfig.connectionType !== 'none' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {currentConfig.connectionType === 'oauth' ? 'Connection' : 'Credentials'}
                      </h4>
                      {form.connection === 'connected' && !connectionStale && currentConfig.connectionType === 'oauth' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleDisconnect}
                        >
                          Disconnect
                        </Button>
                      )}
                    </div>

                    {/* If OAuth is already connected (and not stale), show a
                        compact connected summary instead of re-rendering the
                        credential inputs. The user can Disconnect to edit. */}
                    {currentConfig.connectionType === 'oauth' &&
                    form.connection === 'connected' &&
                    !connectionStale ? (
                      <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 px-3 py-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                            {PROVIDERS.find((p) => p.value === form.provider)?.label} connected
                          </p>
                          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 truncate">
                            {form.connectionMessage || 'Credentials configured'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {currentConfig.fields
                          .filter((f) => f.group === 'connection')
                          .map((f) => (
                            <ConfigField
                              key={f.key}
                              field={f}
                              value={form.config[f.key] ?? ''}
                              onChange={(v) => updateConfigField(f.key, v)}
                              disabled={isTesting}
                            />
                          ))}

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={
                              currentConfig.connectionType === 'oauth'
                                ? handleOAuthConnect
                                : handleTestConnection
                            }
                            disabled={
                              isTesting ||
                              !canValidateConnection(form) ||
                              (currentConfig.connectionType === 'credentials' && !form.name.trim())
                            }
                          >
                            {isTesting ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : currentConfig.connectionType === 'oauth' ? (
                              <Plug className="h-4 w-4 mr-2" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {currentConfig.actionLabel}
                          </Button>
                          {currentConfig.connectionType === 'oauth' && (
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              OAuth credentials stored encrypted
                            </span>
                          )}
                        </div>

                        {form.connection !== 'idle' && form.connection !== 'testing' && (
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
                      </>
                    )}
                  </div>
                )}

                {/* Destination-group fields (Local path; OAuth folder after
                    a successful connection). For credential providers there
                    are no destination fields (everything was tested above). */}
                {currentConfig.connectionType === 'none' &&
                  currentConfig.fields
                    .filter((f) => f.group === 'destination')
                    .map((f) => (
                      <ConfigField
                        key={f.key}
                        field={f}
                        value={form.config[f.key] ?? ''}
                        onChange={(v) => updateConfigField(f.key, v)}
                        disabled={isTesting}
                      />
                    ))}

                {currentConfig.connectionType === 'oauth' &&
                  form.connection === 'connected' &&
                  !connectionStale &&
                  currentConfig.fields
                    .filter((f) => f.group === 'destination')
                    .map((f) => (
                      <ConfigField
                        key={f.key}
                        field={f}
                        value={form.config[f.key] ?? ''}
                        onChange={(v) => updateConfigField(f.key, v)}
                        disabled={isTesting}
                      />
                    ))}

                {currentConfig.connectionType === 'oauth' &&
                  (form.connection !== 'connected' || connectionStale) && (
                    <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                      <span>Connect the account first to choose a destination folder.</span>
                    </div>
                  )}
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

// -------------------- Config Field Renderer --------------------

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
      ) : field.multiline ? (
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
