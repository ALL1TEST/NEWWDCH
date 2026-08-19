'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Copy,
  AlertTriangle,
  Shield,
  Loader2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { API_SCOPES, SCOPE_GROUPS } from '@/lib/api/api-service';
import { STATUS_COLORS } from '@/shared/constants';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toast } from 'sonner';
import type { PaginationMeta } from '@/shared/types';

// -------------------- Types --------------------

interface OAuthClientRow {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  clientSecretHash: string;
  grantTypes: string;
  redirectUris: string | null;
  scopes: string;
  status: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface CreateForm {
  name: string;
  description: string;
  grantTypes: string[];
  redirectUris: string;
  scopes: string[];
}

interface EditForm extends CreateForm {
  id: string;
  status: string;
}

const GRANT_TYPE_OPTIONS = [
  'AUTHORIZATION_CODE',
  'CLIENT_CREDENTIALS',
  'PKCE',
] as const;

const DEFAULT_CREATE_FORM: CreateForm = {
  name: '',
  description: '',
  grantTypes: [],
  redirectUris: '',
  scopes: [],
};

// -------------------- Helpers --------------------

function parseScopes(scopesStr: string | null | undefined): string[] {
  if (!scopesStr) return [];
  try {
    const parsed = JSON.parse(scopesStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseGrantTypes(str: string | null | undefined): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// -------------------- Status Badge --------------------

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

// -------------------- Scopes Badge Group --------------------

function ScopesBadgeGroup({ scopes }: { scopes: string[] }) {
  const maxShow = 3;
  const shown = scopes.slice(0, maxShow);
  const remaining = scopes.length - maxShow;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map((s) => (
        <Badge
          key={s}
          variant="secondary"
          className="text-[10px] font-mono px-1.5 py-0"
        >
          {s.split(':')[1]}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          +{remaining}
        </Badge>
      )}
    </div>
  );
}

// -------------------- Scope Grouped Checkboxes --------------------

function ScopeGroupedCheckboxes({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (scopes: string[]) => void;
  disabled?: boolean;
}) {
  const toggleScope = (key: string) => {
    if (disabled) return;
    if (selected.includes(key)) {
      onChange(selected.filter((s) => s !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const toggleGroup = (group: string) => {
    if (disabled) return;
    const groupScopes = API_SCOPES.filter((s) => s.group === group).map((s) => s.key);
    const allSelected = groupScopes.every((s) => selected.includes(s));
    if (allSelected) {
      onChange(selected.filter((s) => !(groupScopes as readonly string[]).includes(s)));
    } else {
      const newScopes = [...new Set([...selected, ...groupScopes])];
      onChange(newScopes);
    }
  };

  return (
    <div className="space-y-4 max-h-56 overflow-y-auto">
      {SCOPE_GROUPS.map((group) => {
        const groupScopes = API_SCOPES.filter((s) => s.group === group);
        const allSelected = groupScopes.every((s) => selected.includes(s.key));
        return (
          <div key={group}>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium mb-2 hover:text-foreground/80 transition-colors"
              onClick={() => toggleGroup(group)}
              disabled={disabled}
            >
              <Checkbox checked={allSelected} className="h-4 w-4" />
              <span>{group}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
                {groupScopes.filter((s) => selected.includes(s.key)).length}/{groupScopes.length}
              </Badge>
            </button>
            <div className="grid grid-cols-2 gap-1.5 ml-6">
              {groupScopes.map((scope) => (
                <label
                  key={scope.key}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer hover:bg-muted/50 text-xs transition-colors',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Checkbox
                    checked={selected.includes(scope.key)}
                    onCheckedChange={() => toggleScope(scope.key)}
                    disabled={disabled}
                    className="h-3.5 w-3.5"
                  />
                  <span className="font-mono truncate">{scope.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------- Create Dialog --------------------

function CreateDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (form: CreateForm) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<CreateForm>(DEFAULT_CREATE_FORM);

  React.useEffect(() => {
    if (open) setForm(DEFAULT_CREATE_FORM);
  }, [open]);

  const update = (patch: Partial<CreateForm>) =>
    setForm((p) => ({ ...p, ...patch }));

  const toggleGrantType = (gt: string) => {
    if (form.grantTypes.includes(gt)) {
      update({ grantTypes: form.grantTypes.filter((g) => g !== gt) });
    } else {
      update({ grantTypes: [...form.grantTypes, gt] });
    }
  };

  const canSubmit = form.name.trim() !== '' && form.grantTypes.length > 0 && form.scopes.length > 0 && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create OAuth Client</DialogTitle>
          <DialogDescription>
            Register a new OAuth2 client application. The client secret will only
            be shown once after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="create-name">Name *</Label>
            <Input
              id="create-name"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Mobile App"
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="create-desc">Description</Label>
            <Textarea
              id="create-desc"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="What is this client used for?"
              rows={2}
            />
          </div>

          {/* Grant Types */}
          <div className="grid gap-2">
            <Label>Grant Types *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GRANT_TYPE_OPTIONS.map((gt) => (
                <label
                  key={gt}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 text-sm transition-colors',
                    form.grantTypes.includes(gt) && 'border-primary bg-primary/5',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Checkbox
                    checked={form.grantTypes.includes(gt)}
                    onCheckedChange={() => toggleGrantType(gt)}
                    disabled={isLoading}
                  />
                  <DynamicBadge value={gt} />
                </label>
              ))}
            </div>
          </div>

          {/* Redirect URIs */}
          <div className="grid gap-2">
            <Label htmlFor="create-redirect-uris">Redirect URIs</Label>
            <Textarea
              id="create-redirect-uris"
              value={form.redirectUris}
              onChange={(e) => update({ redirectUris: e.target.value })}
              placeholder={"https://app.example.com/callback\nhttps://app.example.com/auth/callback"}
              rows={3}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              One URL per line. Required for AUTHORIZATION_CODE and PKCE grant types.
            </p>
          </div>

          {/* Scopes */}
          <div className="grid gap-2">
            <Label>Scopes *</Label>
            <ScopeGroupedCheckboxes
              selected={form.scopes}
              onChange={(scopes) => update({ scopes })}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {form.scopes.length} scope{form.scopes.length !== 1 ? 's' : ''} selected
            </p>
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
          <Button onClick={() => onSubmit(form)} disabled={!canSubmit}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Edit Dialog --------------------

function EditDialog({
  open,
  onOpenChange,
  data,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: EditForm | null;
  onSubmit: (form: EditForm) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<EditForm>(
    data ?? { ...DEFAULT_CREATE_FORM, id: '', status: 'ACTIVE' }
  );

  React.useEffect(() => {
    if (open && data) setForm(data);
  }, [open, data]);

  const update = (patch: Partial<EditForm>) =>
    setForm((p) => ({ ...p, ...patch }));

  const toggleGrantType = (gt: string) => {
    if (form.grantTypes.includes(gt)) {
      update({ grantTypes: form.grantTypes.filter((g) => g !== gt) });
    } else {
      update({ grantTypes: [...form.grantTypes, gt] });
    }
  };

  const canSubmit = form.name.trim() !== '' && form.grantTypes.length > 0 && form.scopes.length > 0 && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit OAuth Client</DialogTitle>
          <DialogDescription>Update OAuth2 client configuration.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Status */}
          <div className="grid gap-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update({ status: v })}
            >
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Active
                  </span>
                </SelectItem>
                <SelectItem value="INACTIVE">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-zinc-400" />
                    Inactive
                  </span>
                </SelectItem>
                <SelectItem value="REVOKED">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Revoked
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grant Types */}
          <div className="grid gap-2">
            <Label>Grant Types *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GRANT_TYPE_OPTIONS.map((gt) => (
                <label
                  key={gt}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 text-sm transition-colors',
                    form.grantTypes.includes(gt) && 'border-primary bg-primary/5',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Checkbox
                    checked={form.grantTypes.includes(gt)}
                    onCheckedChange={() => toggleGrantType(gt)}
                    disabled={isLoading}
                  />
                  <DynamicBadge value={gt} />
                </label>
              ))}
            </div>
          </div>

          {/* Redirect URIs */}
          <div className="grid gap-2">
            <Label htmlFor="edit-redirect-uris">Redirect URIs</Label>
            <Textarea
              id="edit-redirect-uris"
              value={form.redirectUris}
              onChange={(e) => update({ redirectUris: e.target.value })}
              placeholder="One URL per line"
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          {/* Scopes */}
          <div className="grid gap-2">
            <Label>Scopes *</Label>
            <ScopeGroupedCheckboxes
              selected={form.scopes}
              onChange={(scopes) => update({ scopes })}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {form.scopes.length} scope{form.scopes.length !== 1 ? 's' : ''} selected
            </p>
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
          <Button onClick={() => onSubmit(form)} disabled={!canSubmit}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Show Client Secret Dialog --------------------

function ShowSecretDialog({
  open,
  onOpenChange,
  clientSecret,
  clientId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientSecret: string | null;
  clientId: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            OAuth Client Created Successfully
          </DialogTitle>
          <DialogDescription>
            Save these credentials now. The client secret will not be shown
            again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 p-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            For security purposes, the client secret is only displayed once.
            Make sure to copy and store it in a secure location before closing
            this dialog.
          </p>
        </div>

        <div className="grid gap-4 py-2">
          {/* Client ID */}
          <div className="grid gap-2">
            <Label>Client ID</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-mono break-all select-all leading-relaxed">
                {clientId}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => clientId && handleCopy(clientId)}
                className="shrink-0"
              >
                <Copy className={cn('h-4 w-4', copied && 'text-green-500')} />
              </Button>
            </div>
          </div>

          {/* Client Secret */}
          <div className="grid gap-2">
            <Label>Client Secret</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-mono break-all select-all leading-relaxed">
                {clientSecret}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => clientSecret && handleCopy(clientSecret)}
                className="shrink-0"
              >
                <Copy className={cn('h-4 w-4', copied && 'text-green-500')} />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Main Component --------------------

export function OAuthClientsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // ---- Dialog state ----
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    data: EditForm | null;
  }>({ open: false, data: null });
  const [newCredentials, setNewCredentials] = useState<{
    clientId: string | null;
    clientSecret: string | null;
  }>({ clientId: null, clientSecret: null });
  const [deleteTarget, setDeleteTarget] = useState<OAuthClientRow | null>(null);

  // ---- Filter state ----
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchValue, setSearchValue] = useState('');

  const table = useDataTable({
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
  });

  // ---- Query ----
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.oauthClients.list({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      status: statusFilter,
      search: searchValue,
    }),
    queryFn: () =>
      getApi<{ data: OAuthClientRow[]; meta: { requestId: string; pagination: PaginationMeta } }>('/api/oauth-clients', {
        page: table.currentPage,
        pageSize: table.pageSize,
        sort: table.sortField,
        order: table.sortOrder,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchValue || undefined,
      }, { raw: true }),
    staleTime: 10_000,
  });

  const clients = data?.data ?? [];
  const pagination = data?.meta?.pagination;

  // ---- Mutations ----
  const createMutation = useMutation({
    mutationFn: (form: CreateForm) => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        grantTypes: form.grantTypes,
        redirectUris: form.redirectUris
          .split('\n')
          .map((u) => u.trim())
          .filter((u) => u.length > 0),
        scopes: form.scopes,
        userId: user?.id,
      };
      return postApi<OAuthClientRow & { clientSecret: string }>('/api/oauth-clients', body);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oauthClients.all });
      setCreateDialogOpen(false);
      if (res) {
        setNewCredentials({
          clientId: res.clientId,
          clientSecret: res.clientSecret,
        });
      }
      toast.success('OAuth client created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create OAuth client');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (form: EditForm) => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        grantTypes: form.grantTypes,
        redirectUris: form.redirectUris
          .split('\n')
          .map((u) => u.trim())
          .filter((u) => u.length > 0),
        scopes: form.scopes,
      };
      return patchApi(`/api/oauth-clients/${form.id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oauthClients.all });
      setEditDialog({ open: false, data: null });
      toast.success('OAuth client updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update OAuth client');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/oauth-clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.oauthClients.all });
      setDeleteTarget(null);
      toast.success('OAuth client deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete OAuth client');
    },
  });

  // ---- Copy handler ----
  const handleCopyClientId = async (clientId: string) => {
    try {
      await navigator.clipboard.writeText(clientId);
      toast.success('Client ID copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  // ---- Row to edit form converter ----
  const rowToEditForm = (row: OAuthClientRow): EditForm => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    status: row.status,
    grantTypes: parseGrantTypes(row.grantTypes),
    redirectUris: (() => {
      if (!row.redirectUris) return '';
      try {
        const parsed = JSON.parse(row.redirectUris);
        return Array.isArray(parsed) ? parsed.join('\n') : '';
      } catch {
        return '';
      }
    })(),
    scopes: parseScopes(row.scopes),
  });

  // ---- Columns ----
  const columns = useMemo<ColumnDef<OAuthClientRow>[]>(
    () => [
      ColumnDefHelper.textColumn<OAuthClientRow>({
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        className: 'font-medium min-w-[140px]',
      }),

      {
        id: 'clientId',
        header: 'Client ID',
        accessorKey: 'clientId',
        enableSorting: false,
        size: 200,
        cell: ({ row }) => {
          const clientId = row.original.clientId;
          return (
            <div className="flex items-center gap-1.5">
              <code className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
                {clientId}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyClientId(clientId);
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },

      {
        id: 'grantTypes',
        header: 'Grant Types',
        accessorFn: (row) => {
          const gts = parseGrantTypes(row.grantTypes);
          return gts.join(',');
        },
        enableSorting: false,
        size: 180,
        cell: ({ row }) => {
          const gts = parseGrantTypes(row.original.grantTypes);
          return (
            <div className="flex items-center gap-1 flex-wrap">
              {gts.map((gt) => (
                <DynamicBadge key={gt} value={gt} />
              ))}
            </div>
          );
        },
      },

      {
        id: 'scopes',
        header: 'Scopes',
        accessorFn: (row) => {
          const scopes = parseScopes(row.scopes);
          return scopes.join(',');
        },
        enableSorting: false,
        size: 180,
        cell: ({ row }) => (
          <ScopesBadgeGroup scopes={parseScopes(row.original.scopes)} />
        ),
      },

      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        size: 100,
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return <DynamicBadge value={val} />;
        },
      },

      {
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        size: 120,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return (
            <span className="text-sm text-muted-foreground">
              {val ? formatDate(val) : '—'}
            </span>
          );
        },
      },

      ColumnDefHelper.actionColumn<OAuthClientRow>({
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
                onClick={() =>
                  setEditDialog({
                    open: true,
                    data: rowToEditForm(row),
                  })
                }
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
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
    ],
    []
  );

  // ---- Handlers ----
  const handleSearch = (value: string) => {
    setSearchValue(value);
    table.setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    table.setCurrentPage(1);
  };

  // ---- Render ----
  return (
    <div className="space-y-4">
      <PageHeader
        title="OAuth Clients"
        description="Manage OAuth2 client applications for third-party integrations"
        action={
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Client
          </Button>
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search OAuth clients..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="REVOKED">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={clients}
        isLoading={isLoading}
        totalItems={pagination?.total ?? 0}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        getRowId={(row) => row.id}
        emptyMessage="No OAuth clients found. Create one to get started."
      />

      {/* Create Dialog */}
      <CreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={(form) => createMutation.mutate(form)}
        isLoading={createMutation.isPending}
      />

      {/* Edit Dialog */}
      <EditDialog
        open={editDialog.open}
        onOpenChange={(v) => setEditDialog((p) => ({ ...p, open: v }))}
        data={editDialog.data}
        onSubmit={(form) => updateMutation.mutate(form)}
        isLoading={updateMutation.isPending}
      />

      {/* Show Client Secret Dialog */}
      <ShowSecretDialog
        open={!!newCredentials.clientSecret}
        onOpenChange={(v) =>
          !v && setNewCredentials({ clientId: null, clientSecret: null })
        }
        clientSecret={newCredentials.clientSecret}
        clientId={newCredentials.clientId}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete OAuth Client"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? Any applications using this client will immediately lose access.`
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
