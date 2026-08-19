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
  RefreshCw,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { API_SCOPES, SCOPE_GROUPS, EXPIRATION_OPTIONS } from '@/lib/api/api-service';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toast } from 'sonner';
import type { PaginationMeta } from '@/shared/types';

// -------------------- Types --------------------

interface PatRow {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user: { id: string; name: string; email: string } | null;
}

interface CreateForm {
  name: string;
  scopes: string[];
  expiration: string;
}

interface EditForm extends CreateForm {
  id: string;
}

const DEFAULT_CREATE_FORM: CreateForm = {
  name: '',
  scopes: [],
  expiration: '30d',
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

  const canSubmit = form.name.trim() !== '' && form.scopes.length > 0 && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Personal Access Token</DialogTitle>
          <DialogDescription>
            Generate a new personal access token. The raw token will only be
            shown once.
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
              placeholder="e.g. CI/CD Pipeline"
            />
          </div>

          {/* Expiration */}
          <div className="grid gap-2">
            <Label htmlFor="create-expiration">Expiration</Label>
            <Select
              value={form.expiration}
              onValueChange={(v) => update({ expiration: v })}
            >
              <SelectTrigger id="create-expiration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            Create Token
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
    data ?? { ...DEFAULT_CREATE_FORM, id: '' }
  );

  React.useEffect(() => {
    if (open && data) setForm(data);
  }, [open, data]);

  const update = (patch: Partial<EditForm>) =>
    setForm((p) => ({ ...p, ...patch }));

  const canSubmit = form.name.trim() !== '' && form.scopes.length > 0 && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Personal Access Token</DialogTitle>
          <DialogDescription>Update token configuration.</DialogDescription>
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

          {/* Expiration */}
          <div className="grid gap-2">
            <Label htmlFor="edit-expiration">Expiration</Label>
            <Select
              value={form.expiration}
              onValueChange={(v) => update({ expiration: v })}
            >
              <SelectTrigger id="edit-expiration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

// -------------------- Show Token Dialog --------------------

function ShowTokenDialog({
  open,
  onOpenChange,
  rawToken,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rawToken: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!rawToken) return;
    try {
      await navigator.clipboard.writeText(rawToken);
      setCopied(true);
      toast.success('Token copied to clipboard');
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
            Token Created Successfully
          </DialogTitle>
          <DialogDescription>
            Save this token now. You won&apos;t be able to see it again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 p-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            For security purposes, the full personal access token is only
            displayed once. Make sure to copy and store it in a secure location
            before closing this dialog.
          </p>
        </div>

        <div className="grid gap-2 py-2">
          <Label>Your Personal Access Token</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-mono break-all select-all leading-relaxed">
              {rawToken}
            </code>
            <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
              <Copy className={cn('h-4 w-4', copied && 'text-green-500')} />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Rotate Token Dialog --------------------

function RotateTokenDialog({
  open,
  onOpenChange,
  tokenName,
  rawToken,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tokenName: string;
  rawToken: string | null;
  isLoading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!rawToken) return;
    try {
      await navigator.clipboard.writeText(rawToken);
      setCopied(true);
      toast.success('New token copied to clipboard');
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
            <RefreshCw className="h-5 w-5 text-sky-500" />
            Token Rotated
          </DialogTitle>
          <DialogDescription>
            The personal access token &quot;{tokenName}&quot; has been rotated.
            The old token is no longer valid.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 p-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            The new token is shown below. Save it now — it cannot be displayed
            again. Update all integrations immediately.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rawToken ? (
          <div className="grid gap-2 py-2">
            <Label>New Personal Access Token</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-mono break-all select-all leading-relaxed">
                {rawToken}
              </code>
              <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
                <Copy className={cn('h-4 w-4', copied && 'text-green-500')} />
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Main Component --------------------

export function PatPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // ---- Dialog state ----
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    data: EditForm | null;
  }>({ open: false, data: null });
  const [newRawToken, setNewRawToken] = useState<string | null>(null);
  const [rotateDialog, setRotateDialog] = useState<{
    open: boolean;
    tokenName: string;
    rawToken: string | null;
  }>({ open: false, tokenName: '', rawToken: null });
  const [deleteTarget, setDeleteTarget] = useState<PatRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PatRow | null>(null);
  const [rotateTarget, setRotateTarget] = useState<PatRow | null>(null);

  // ---- Filter state ----
  const [searchValue, setSearchValue] = useState('');

  const table = useDataTable({
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
  });

  // ---- Query ----
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.personalAccessTokens.list({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: searchValue,
    }),
    queryFn: () =>
      getApi<{ data: PatRow[]; meta: { requestId: string; pagination: PaginationMeta } }>('/api/personal-access-tokens', {
        page: table.currentPage,
        pageSize: table.pageSize,
        sort: table.sortField,
        order: table.sortOrder,
        search: searchValue || undefined,
      }, { raw: true }),
    staleTime: 10_000,
  });

  const tokens = data?.data ?? [];
  const pagination = data?.meta?.pagination;

  // ---- Mutations ----
  const createMutation = useMutation({
    mutationFn: (form: CreateForm) => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        scopes: form.scopes,
        expiration: form.expiration,
        userId: user?.id,
      };
      return postApi<PatRow & { rawToken: string }>('/api/personal-access-tokens', body);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personalAccessTokens.all });
      setCreateDialogOpen(false);
      if (res?.rawToken) {
        setNewRawToken(res.rawToken);
      }
      toast.success('Personal access token created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create token');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (form: EditForm) => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        scopes: form.scopes,
        expiration: form.expiration,
      };
      return patchApi(`/api/personal-access-tokens/${form.id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personalAccessTokens.all });
      setEditDialog({ open: false, data: null });
      toast.success('Token updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update token');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/personal-access-tokens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personalAccessTokens.all });
      setDeleteTarget(null);
      toast.success('Token deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete token');
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) =>
      postApi<PatRow & { rawToken: string }>(`/api/personal-access-tokens/rotate/${id}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personalAccessTokens.all });
      const name = rotateTarget?.name ?? 'Token';
      setRotateTarget(null);
      setRotateDialog({ open: true, tokenName: name, rawToken: res?.rawToken ?? null });
      toast.success('Token rotated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to rotate token');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      postApi(`/api/personal-access-tokens/revoke/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personalAccessTokens.all });
      setRevokeTarget(null);
      toast.success('Token revoked');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to revoke token');
    },
  });

  // ---- Row to edit form converter ----
  const rowToEditForm = (row: PatRow): EditForm => ({
    id: row.id,
    name: row.name,
    scopes: parseScopes(row.scopes),
    expiration: row.expiresAt ? 'custom' : 'never',
  });

  // ---- Columns ----
  const columns = useMemo<ColumnDef<PatRow>[]>(
    () => [
      ColumnDefHelper.textColumn<PatRow>({
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        className: 'font-medium min-w-[140px]',
      }),

      {
        id: 'tokenPrefix',
        header: 'Token Prefix',
        accessorKey: 'tokenPrefix',
        enableSorting: false,
        size: 180,
        cell: ({ row }) => (
          <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
            {row.original.tokenPrefix}...
          </code>
        ),
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
        id: 'lastUsedAt',
        header: 'Last Used',
        accessorKey: 'lastUsedAt',
        size: 120,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return (
            <span className="text-sm text-muted-foreground">
              {val ? formatRelativeTime(val) : '—'}
            </span>
          );
        },
      },

      {
        id: 'lastUsedIp',
        header: 'Last IP',
        accessorKey: 'lastUsedIp',
        enableSorting: false,
        size: 120,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return (
            <span className="text-xs font-mono text-muted-foreground">
              {val ?? '—'}
            </span>
          );
        },
      },

      {
        id: 'expiresAt',
        header: 'Expires',
        accessorKey: 'expiresAt',
        size: 120,
        cell: ({ row }) => {
          const val = row.original.expiresAt;
          if (!val) return <span className="text-sm text-muted-foreground">Never</span>;
          const isExpired = new Date(val) < new Date();
          return (
            <span
              className={cn(
                'text-sm',
                isExpired ? 'text-red-500 font-medium' : 'text-muted-foreground'
              )}
            >
              {formatDate(val)}
            </span>
          );
        },
      },

      {
        id: 'isActive',
        header: 'Active',
        accessorKey: 'isActive',
        size: 80,
        cell: ({ getValue }) => {
          const active = getValue() as boolean;
          return (
            <Badge
              variant="outline"
              className={cn(
                'border-transparent font-medium',
                active
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}
            >
              {active ? 'Active' : 'Inactive'}
            </Badge>
          );
        },
      },

      ColumnDefHelper.actionColumn<PatRow>({
        id: 'actions',
        render: (row) => {
          const isInactive = !row.isActive;
          return (
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

                {!isInactive && (
                  <DropdownMenuItem
                    onClick={() => setRotateTarget(row)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Rotate
                  </DropdownMenuItem>
                )}

                {!isInactive && (
                  <DropdownMenuItem
                    onClick={() => setRevokeTarget(row)}
                    className="text-amber-600 dark:text-amber-400 focus:text-amber-600"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Revoke
                  </DropdownMenuItem>
                )}

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
          );
        },
      }),
    ],
    [rotateTarget?.name]
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
        title="Personal Access Tokens"
        description="Manage personal access tokens for CLI tools and scripts"
        action={
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Token
          </Button>
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
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
        data={tokens}
        isLoading={isLoading}
        totalItems={pagination?.total ?? 0}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        getRowId={(row) => row.id}
        emptyMessage="No personal access tokens found. Create one to get started."
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

      {/* Show New Token Dialog */}
      <ShowTokenDialog
        open={!!newRawToken}
        onOpenChange={(v) => !v && setNewRawToken(null)}
        rawToken={newRawToken}
      />

      {/* Rotate Token Dialog */}
      <RotateTokenDialog
        open={rotateDialog.open}
        onOpenChange={(v) =>
          setRotateDialog((p) => ({ ...p, open: v }))
        }
        tokenName={rotateDialog.tokenName}
        rawToken={rotateDialog.rawToken}
        isLoading={false}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete Token"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? Any integrations using this token will immediately lose access.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isLoading={deleteMutation.isPending}
      />

      {/* Revoke Confirmation */}
      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(v) => !v && setRevokeTarget(null)}
        title="Revoke Token"
        description={
          revokeTarget
            ? `Are you sure you want to revoke "${revokeTarget.name}"? The token will be immediately disabled and cannot be used again.`
            : undefined
        }
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.id);
        }}
        isLoading={revokeMutation.isPending}
      />

      {/* Rotate Confirmation */}
      <ConfirmDialog
        open={!!rotateTarget}
        onOpenChange={(v) => !v && setRotateTarget(null)}
        title="Rotate Token"
        description={
          rotateTarget
            ? `Are you sure you want to rotate "${rotateTarget.name}"? A new token will be generated and the old token will stop working immediately.`
            : undefined
        }
        confirmLabel="Rotate Token"
        onConfirm={() => {
          if (rotateTarget) rotateMutation.mutate(rotateTarget.id);
        }}
        isLoading={rotateMutation.isPending}
      />
    </div>
  );
}
