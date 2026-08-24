'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UserPlus,
  Pencil,
  Trash2,
  MoreHorizontal,
  UserX,
  UserCheck,
  Loader2,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  StatusBadge,
  PageHeader,
  ConfirmDialog,
} from '@/components/patterns';
import { AvatarWithFallback } from '@/components/shared';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  cn,
  formatDate,
  formatRelativeTime,
  labelize,
} from '@/lib/utils';
import type {
  PaginatedResponse,
  UserRole,
  UserStatus,
  SelectOption,
} from '@/shared/types';
import {
  BUILTIN_PAGES,
  SETTINGS_SUBPAGES,
  canAccessPage,
  customPermissionKeyFromName,
} from '@/lib/permissions';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import type { ColumnDef } from '@tanstack/react-table';

// -------------------- Types --------------------

interface AuthorProfileData {
  id: string;
  displayName?: string | null;
  slug?: string | null;
  bio?: string | null;
  website?: string | null;
  twitter?: string | null;
  github?: string | null;
  linkedin?: string | null;
  avatar?: string | null;
}

interface UserRow {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  bio?: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  pagePermissions?: string[] | null;
  authorProfile?: AuthorProfileData | null;
}

interface CustomPermissionRow {
  id: string;
  name: string;
  description?: string | null;
  route?: string | null;
  key: string;
  createdAt: string;
}

// -------------------- Constants --------------------

const ROLE_OPTIONS: SelectOption<UserRole>[] = [
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Editor', value: 'EDITOR' },
];

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50',
  EDITOR:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
};

const STATUS_OPTIONS: SelectOption<UserStatus>[] = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Invited', value: 'INVITED' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Deactivated', value: 'DEACTIVATED' },
];

// -------------------- Helpers --------------------

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium text-[11px] leading-4 px-1.5 py-0 shrink-0',
        ROLE_COLORS[role],
      )}
    >
      {labelize(role)}
    </Badge>
  );
}

// -------------------- Custom Permission Dialog --------------------

interface CustomPermFormData {
  name: string;
  description: string;
  route: string;
}

function CreateCustomPermissionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (perm: CustomPermissionRow) => void;
}) {
  const [form, setForm] = useState<CustomPermFormData>({
    name: '',
    description: '',
    route: '',
  });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: CustomPermFormData) =>
      postApi<CustomPermissionRow>('/api/custom-permissions', {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        route: data.route.trim() || undefined,
      }),
    onSuccess: (perm) => {
      toast.success(`Custom permission "${perm.name}" created`);
      onCreated(perm);
      setForm({ name: '', description: '', route: '' });
      setError(null);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create custom permission');
    },
  });

  const derivedKey = customPermissionKeyFromName(form.name);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!derivedKey) {
      setError('Name must contain at least one letter or number');
      return;
    }
    setError(null);
    createMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Custom Permission</DialogTitle>
          <DialogDescription>
            Create a custom page-level permission that can be granted to Editor users.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="cp-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="cp-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Manage Authors"
              autoFocus
            />
            {derivedKey && (
              <p className="text-xs text-muted-foreground">
                Key: <code className="font-mono bg-muted px-1 py-0.5 rounded">{derivedKey}</code>
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cp-desc">Description</Label>
            <Input
              id="cp-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional — short description"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cp-route">Route</Label>
            <Input
              id="cp-route"
              value={form.route}
              onChange={(e) => setForm((p) => ({ ...p, route: e.target.value }))}
              placeholder="Optional — e.g. #authors"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || !form.name.trim()}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Invite / Edit Dialog --------------------

interface InviteFormData {
  email: string;
  name: string;
  role: UserRole;
  pagePermissions: string[];
}

const DEFAULT_EDITOR_PAGES: string[] = ['dashboard', 'content', 'media'];

function InviteUserDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  editMode = false,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InviteFormData) => void;
  isLoading: boolean;
  editMode?: boolean;
  initialData?: InviteFormData | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<InviteFormData>({
    email: '',
    name: '',
    role: 'EDITOR',
    pagePermissions: DEFAULT_EDITOR_PAGES,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [deleteCustomTarget, setDeleteCustomTarget] = useState<CustomPermissionRow | null>(null);

  // Fetch custom permissions
  const { data: customPerms } = useQuery({
    queryKey: ['custom-permissions-list'],
    queryFn: () => getApi<CustomPermissionRow[]>('/api/custom-permissions'),
    enabled: open,
  });
  const customPermissions = customPerms ?? [];

  // Delete custom permission (also removes from all users' pagePermissions arrays)
  const deleteCustomMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/custom-permissions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-permissions-list'] });
      // Also refresh users list since their pagePermissions may have changed
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success('Custom permission deleted');
      setDeleteCustomTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete custom permission');
    },
  });

  React.useEffect(() => {
    if (open) {
      if (editMode && initialData) {
        setForm(initialData);
      } else {
        setForm({
          email: '',
          name: '',
          role: 'EDITOR',
          pagePermissions: DEFAULT_EDITOR_PAGES,
        });
      }
      setErrors({});
    }
  }, [open, editMode, initialData]);

  const handleRoleChange = (role: string) => {
    setForm((p) => ({
      ...p,
      role: role as UserRole,
      // When switching to ADMIN, clear pagePermissions (they have full access)
      pagePermissions: role === 'ADMIN' ? [] : p.pagePermissions.length > 0 ? p.pagePermissions : DEFAULT_EDITOR_PAGES,
    }));
  };

  const togglePage = (key: string) => {
    setForm((p) => ({
      ...p,
      pagePermissions: p.pagePermissions.includes(key)
        ? p.pagePermissions.filter((k) => k !== key)
        : [...p.pagePermissions, key],
    }));
  };

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSubmit({ ...form, email: form.email.trim(), name: form.name.trim() });
  };

  const isEditor = form.role === 'EDITOR';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit User' : 'Invite User'}</DialogTitle>
            <DialogDescription>
              {editMode
                ? 'Update user details, role, and page access.'
                : 'Send an invitation email to add a new team member to your organization.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, email: e.target.value }));
                    setErrors((p) => { const n = { ...p }; delete n.email; return n; });
                  }}
                  placeholder="user@example.com"
                  autoFocus
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-name">Name</Label>
                <Input
                  id="invite-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Full name (optional)"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={form.role} onValueChange={handleRoleChange}>
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <strong>Admin</strong> has full access to all pages. <strong>Editor</strong> only sees the pages
                selected below.
              </p>
            </div>

            {isEditor ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Page Access</Label>
                  <span className="text-xs text-muted-foreground">
                    {form.pagePermissions.length} selected
                  </span>
                </div>
                <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                  {BUILTIN_PAGES.map((page) => {
                    const checked = form.pagePermissions.includes(page.key);
                    const isSettings = page.key === 'settings';
                    return (
                      <div key={page.key}>
                        <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 cursor-pointer transition-colors">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePage(page.key)}
                          />
                          <span className="text-sm font-medium flex-1">{page.label}</span>
                          {isSettings && (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              grants all sub-pages
                            </span>
                          )}
                        </label>
                        {isSettings && (
                          <div className="pl-8 pb-1">
                            {SETTINGS_SUBPAGES.map((sub) => {
                              const subChecked = form.pagePermissions.includes(sub.key);
                              return (
                                <label
                                  key={sub.key}
                                  className="flex items-center gap-3 px-3 py-1.5 hover:bg-accent/50 cursor-pointer transition-colors"
                                >
                                  <Checkbox
                                    checked={subChecked}
                                    onCheckedChange={() => togglePage(sub.key)}
                                  />
                                  <span className="text-sm text-muted-foreground">{sub.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Custom permissions section */}
                  <div className="bg-muted/30">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Custom Permissions
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setShowCreateCustom(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Custom
                      </Button>
                    </div>
                    {customPermissions.length === 0 ? (
                      <div className="px-3 pb-3 text-xs text-muted-foreground">
                        No custom permissions yet. Click &quot;+ Custom&quot; to create one.
                      </div>
                    ) : (
                      customPermissions.map((perm) => {
                        const checked = form.pagePermissions.includes(perm.key);
                        return (
                          <div
                            key={perm.id}
                            className="group flex items-center gap-3 px-3 py-2 hover:bg-accent/50 transition-colors"
                          >
                            <label className="flex items-center gap-3 flex-1 cursor-pointer">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => togglePage(perm.key)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{perm.name}</div>
                                {perm.description && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {perm.description}
                                  </div>
                                )}
                              </div>
                            </label>
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteCustomTarget(perm);
                              }}
                              aria-label={`Delete custom permission ${perm.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-md bg-orange-50 border border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-900/50 dark:text-orange-300">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="text-sm">
                  Admin users have full access to every page — no per-page configuration needed.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || !form.email.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editMode ? 'Save Changes' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateCustomPermissionDialog
        open={showCreateCustom}
        onOpenChange={setShowCreateCustom}
        onCreated={() => {
          // customPermissions query is invalidated automatically by TanStack Query
          // when we refetch — but the mutation in CreateCustomPermissionDialog
          // doesn't invalidate, so we trigger a refetch here.
          queryClient.invalidateQueries({ queryKey: ['custom-permissions-list'] });
        }}
      />

      <ConfirmDialog
        open={!!deleteCustomTarget}
        onOpenChange={(o) => !o && setDeleteCustomTarget(null)}
        title="Delete Custom Permission"
        description={
          deleteCustomTarget
            ? `Delete "${deleteCustomTarget.name}"? It will also be removed from every user's page access list.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteCustomTarget) {
            // Also remove from the local form state
            setForm((p) => ({
              ...p,
              pagePermissions: p.pagePermissions.filter((k) => k !== deleteCustomTarget.key),
            }));
            deleteCustomMutation.mutate(deleteCustomTarget.id);
          }
        }}
        isLoading={deleteCustomMutation.isPending}
      />
    </>
  );
}

// -------------------- Component --------------------

export function UsersListPage() {
  const queryClient = useQueryClient();

  // Table state
  const table = useDataTable({
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
    initialPageSize: DEFAULT_PAGE_SIZE,
  });

  // Filter state
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog state
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Build query params
  const queryParams = useMemo(
    () => ({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
      ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
    [
      table.currentPage,
      table.pageSize,
      table.sortField,
      table.sortOrder,
      table.searchValue,
      roleFilter,
      statusFilter,
    ],
  );

  // Fetch users — use raw:true to get the full ApiResponse envelope
  const { data: rawData, isLoading } = useQuery({
    queryKey: queryKeys.users.list(queryParams),
    queryFn: () =>
      getApi<{ data: UserRow[]; meta: { pagination: { page: number; pageSize: number; total: number; totalPages: number } } }>(
        '/api/users',
        queryParams,
        { raw: true },
      ),
    staleTime: 10_000,
  });

  const users = rawData?.data ?? [];
  const pagination = rawData?.meta?.pagination;
  const totalItems = pagination?.total ?? 0;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setDeleteTarget(null);
    },
  });

  // Suspend/Activate toggle mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      patchApi(`/api/users/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setSuspendTarget(null);
    },
  });

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) =>
      postApi('/api/users/invite', {
        email: data.email,
        name: data.name || undefined,
        role: data.role,
        pagePermissions: data.pagePermissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setInviteDialogOpen(false);
      toast.success('Invitation sent');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to invite user');
    },
  });

  // Edit dialog state — reuses the Invite User form in edit mode
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  const openEditDialog = useCallback((user: UserRow) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  }, []);

  // Edit mutation (updates existing user)
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InviteFormData }) =>
      patchApi(`/api/users/${id}`, {
        name: data.name,
        email: data.email,
        role: data.role,
        pagePermissions: data.pagePermissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setEditDialogOpen(false);
      setEditingUser(null);
      toast.success('User updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update user');
    },
  });

  const handleSuspendToggle = useCallback(
    (user: UserRow) => {
      const newStatus: UserStatus =
        user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      toggleStatusMutation.mutate({ id: user.id, status: newStatus });
      setSuspendTarget(null);
    },
    [toggleStatusMutation],
  );

  // Column definitions
  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: 'name',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            <span className="font-medium">User</span>
          </button>
        ),
        accessorFn: (row) => row.name ?? row.email,
        size: 240,
        enableSorting: true,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <button
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity text-left w-full"
              onClick={(e) => {
                e.stopPropagation();
                openEditDialog(row);
              }}
            >
              <AvatarWithFallback
                src={user.avatar ?? undefined}
                name={user.name ?? user.email}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm">
                  {user.name || 'Unnamed'}
                </div>
              </div>
            </button>
          );
        },
      } as ColumnDef<UserRow>,
      ColumnDefHelper.textColumn<UserRow>({
        id: 'email',
        header: 'Email',
        accessorKey: 'email',
        truncate: 40,
        enableSorting: false,
      }),
      {
        id: 'role',
        header: 'Role',
        accessorKey: 'role',
        size: 130,
        enableSorting: true,
        cell: ({ getValue }) => {
          const role = getValue() as UserRole;
          return <RoleBadge role={role} />;
        },
      } as ColumnDef<UserRow>,
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        size: 120,
        enableSorting: true,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return <StatusBadge status={status} size="sm" />;
        },
      } as ColumnDef<UserRow>,
      {
        id: 'access',
        header: 'Page Access',
        size: 200,
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          if (user.role === 'ADMIN') {
            return (
              <Badge variant="secondary" className="text-xs font-normal">
                Full access
              </Badge>
            );
          }
          const count = user.pagePermissions?.length ?? 0;
          return (
            <span className="text-xs text-muted-foreground">
              {count === 0 ? 'No access' : `${count} page${count === 1 ? '' : 's'}`}
            </span>
          );
        },
      } as ColumnDef<UserRow>,
      ColumnDefHelper.dateColumn<UserRow>({
        id: 'lastLoginAt',
        header: 'Last Login',
        accessorKey: 'lastLoginAt',
        format: (d) => formatRelativeTime(d),
      }),
      ColumnDefHelper.dateColumn<UserRow>({
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        format: (d) => formatDate(d),
      }),
      ColumnDefHelper.actionColumn<UserRow>({
        id: 'actions',
        size: 60,
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
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditDialog(row)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSuspendTarget(row)}>
                {row.status === 'SUSPENDED' ? (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Activate
                  </>
                ) : (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    Suspend
                  </>
                )}
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
    [openEditDialog],
  );

  // Filter controls
  const filterContent = (
    <div className="flex items-center gap-2">
      <Select
        value={roleFilter}
        onValueChange={(v) => {
          setRoleFilter(v);
          table.setCurrentPage(1);
        }}
      >
        <SelectTrigger size="sm" className="w-[130px] h-9">
          <SelectValue placeholder="All Roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          {ROLE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v);
          table.setCurrentPage(1);
        }}
      >
        <SelectTrigger size="sm" className="w-[130px] h-9">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Manage user accounts and permissions"
        action={
          <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        totalItems={totalItems}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(field, order) => table.setSortField(field, order)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        onRowClick={(row) => openEditDialog(row)}
        searchPlaceholder="Search users..."
        searchValue={table.searchValue}
        onSearch={(v) => {
          table.setSearchValue(v);
          table.setCurrentPage(1);
        }}
        filterContent={filterContent}
        getRowId={(row) => row.id}
        emptyMessage="No users found."
      />

      {/* Invite Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSubmit={(d) => inviteMutation.mutate(d)}
        isLoading={inviteMutation.isPending}
      />

      {/* Edit User Dialog — reuses InviteUserDialog in edit mode */}
      <InviteUserDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingUser(null);
        }}
        onSubmit={(data) => {
          if (editingUser) {
            editMutation.mutate({ id: editingUser.id, data });
          }
        }}
        isLoading={editMutation.isPending}
        editMode
        initialData={
          editingUser
            ? {
                email: editingUser.email,
                name: editingUser.name ?? '',
                role: editingUser.role,
                pagePermissions: editingUser.pagePermissions ?? [],
              }
            : null
        }
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete User"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name || deleteTarget.email}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isLoading={deleteMutation.isPending}
      />

      {/* Suspend/Activate Confirmation */}
      <ConfirmDialog
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title={
          suspendTarget?.status === 'SUSPENDED' ? 'Activate User' : 'Suspend User'
        }
        description={
          suspendTarget
            ? suspendTarget.status === 'SUSPENDED'
              ? `Are you sure you want to activate "${suspendTarget.name || suspendTarget.email}"? They will regain access.`
              : `Are you sure you want to suspend "${suspendTarget.name || suspendTarget.email}"? They will lose access immediately.`
            : undefined
        }
        confirmLabel={suspendTarget?.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
        variant={suspendTarget?.status === 'SUSPENDED' ? 'default' : 'destructive'}
        onConfirm={() => {
          if (suspendTarget) handleSuspendToggle(suspendTarget);
        }}
        isLoading={toggleStatusMutation.isPending}
      />
    </div>
  );
}

// -------------------- Re-exports --------------------
// Re-export canAccessPage so other modules can use the same helper.
export { canAccessPage };
