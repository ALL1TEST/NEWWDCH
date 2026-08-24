'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Pencil,
  Trash2,
  MoreHorizontal,
  UserX,
  UserCheck,
  Loader2,
  Globe,
  Github,
  Linkedin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
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
import { useNavigationStore } from '@/lib/stores/navigation-store';
import {
  cn,
  formatDate,
  formatRelativeTime,
  labelize,
  truncate,
} from '@/lib/utils';
import type {
  PaginatedResponse,
  UserRole,
  UserStatus,
  SelectOption,
} from '@/shared/types';
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
  authorProfile?: AuthorProfileData | null;
}

interface EditFormData {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  bio: string;
  avatar: string;
}

// -------------------- Constants --------------------

const ROLE_OPTIONS: SelectOption<UserRole>[] = [
  { label: 'Super Admin', value: 'SUPER_ADMIN' },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Editor', value: 'EDITOR' },
  { label: 'Author', value: 'AUTHOR' },
  { label: 'Contributor', value: 'CONTRIBUTOR' },
];

const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50',
  ADMIN:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50',
  EDITOR:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
  AUTHOR:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50',
  CONTRIBUTOR:
    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
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

// -------------------- Invite Dialog --------------------

interface SiteOption {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo: string | null;
}

interface PermissionDef {
  key: string;
  label: string;
  description: string;
}

const SITE_PERMISSIONS: PermissionDef[] = [
  { key: 'full_access', label: 'Full Site Access', description: 'Complete access to all site features and settings.' },
  { key: 'site_settings', label: 'Site Settings', description: 'Modify site name, domain, theme and general configuration.' },
  { key: 'content_management', label: 'Content Management', description: 'Create, edit and delete articles.' },
  { key: 'articles', label: 'Articles', description: 'Write, edit, publish and manage articles.' },
  { key: 'categories', label: 'Categories', description: 'Create and organize content categories.' },
  { key: 'tags', label: 'Tags', description: 'Manage content tags and tag groups.' },
  { key: 'comments', label: 'Comments', description: 'Moderate, approve and delete reader comments.' },
  { key: 'media_library', label: 'Media Library', description: 'Upload, organize and manage media files.' },
  { key: 'seo', label: 'SEO', description: 'Manage meta tags, schema and indexing.' },
  { key: 'forms', label: 'Forms', description: 'Create and manage contact forms.' },
  { key: 'newsletter', label: 'Newsletter', description: 'Manage subscribers and campaigns.' },
  { key: 'analytics', label: 'Analytics', description: 'View traffic reports and analytics data.' },
  { key: 'api_management', label: 'API Management', description: 'Create and manage API keys.' },
  { key: 'integrations', label: 'Integrations', description: 'Configure webhooks and third-party integrations.' },
  { key: 'view_reports', label: 'View Reports', description: 'Access site performance and content reports.' },
  { key: 'publish_content', label: 'Publish Content', description: 'Publish and schedule content for publication.' },
  { key: 'schedule_articles', label: 'Schedule Articles', description: 'Schedule articles for future publication.' },
  { key: 'manage_ai', label: 'Manage AI', description: 'Configure AI providers and use AI features.' },
  { key: 'manage_team', label: 'Manage Team', description: 'Invite and manage team members.' },
  { key: 'delete_content', label: 'Delete Content', description: 'Permanently delete articles and media.' },
  { key: 'billing_access', label: 'Billing Access', description: 'View and manage billing and subscription details.' },
  { key: 'backup_access', label: 'Backup Access', description: 'Create, download and restore site backups.' },
];

const ROLE_PRESETS: Record<string, string[]> = {
  SUPER_ADMIN: SITE_PERMISSIONS.map((p) => p.key),
  ADMIN: ['full_access'],
  EDITOR: ['content_management', 'articles', 'categories', 'tags', 'comments', 'media_library', 'seo', 'publish_content', 'schedule_articles'],
  AUTHOR: ['articles', 'categories', 'tags', 'media_library'],
  CONTRIBUTOR: ['articles', 'media_library'],
  VIEWER: ['view_reports', 'analytics'],
  SEO_MANAGER: ['seo', 'analytics', 'view_reports', 'articles', 'categories', 'tags'],
  CONTENT_MANAGER: ['content_management', 'articles', 'categories', 'tags', 'comments', 'media_library', 'publish_content', 'schedule_articles', 'manage_ai'],
  MARKETING_MANAGER: ['newsletter', 'analytics', 'view_reports', 'seo', 'forms', 'integrations'],
};

interface InviteFormData {
  email: string;
  name: string;
  role: string;
  assignedSites: string[];
  sitePermissions: string[];
}

function InviteUserDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InviteFormData) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<InviteFormData>({ email: '', name: '', role: 'AUTHOR', assignedSites: [], sitePermissions: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [siteSearch, setSiteSearch] = useState('');
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [permissionsExpanded, setPermissionsExpanded] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const { data: sitesData } = useQuery({
    queryKey: ['sites-list-invite'],
    queryFn: () => getApi<SiteOption[]>('/api/sites'),
    enabled: open,
  });
  const sites = sitesData ?? [];

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSiteDropdown(false);
      }
    };
    if (showSiteDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSiteDropdown]);

  React.useEffect(() => {
    if (open) {
      setForm({ email: '', name: '', role: 'AUTHOR', assignedSites: [], sitePermissions: [] });
      setErrors({});
      setSiteSearch('');
      setPermissionsExpanded(false);
    }
  }, [open]);

  const filteredSites = React.useMemo(() => {
    if (!siteSearch.trim()) return sites;
    const q = siteSearch.toLowerCase();
    return sites.filter((s) => s.name.toLowerCase().includes(q) || (s.domain && s.domain.toLowerCase().includes(q)));
  }, [sites, siteSearch]);

  const selectedSiteObjects = React.useMemo(() => {
    return form.assignedSites.map((id) => sites.find((s) => s.id === id)).filter(Boolean) as SiteOption[];
  }, [form.assignedSites, sites]);

  const handleRoleChange = (role: string) => {
    const presetPerms = ROLE_PRESETS[role] ?? [];
    setForm((p) => ({ ...p, role, sitePermissions: presetPerms }));
  };

  const togglePermission = (key: string) => {
    setForm((p) => ({
      ...p,
      sitePermissions: p.sitePermissions.includes(key)
        ? p.sitePermissions.filter((k) => k !== key)
        : [...p.sitePermissions, key],
    }));
  };

  const addSite = (id: string) => {
    if (!form.assignedSites.includes(id)) {
      setForm((p) => ({ ...p, assignedSites: [...p.assignedSites, id] }));
    }
    setShowSiteDropdown(false);
    setSiteSearch('');
  };

  const removeSite = (id: string) => {
    setForm((p) => ({ ...p, assignedSites: p.assignedSites.filter((s) => s !== id) }));
  };

  const addAllSites = () => {
    setForm((p) => ({ ...p, assignedSites: sites.map((s) => s.id) }));
    setShowSiteDropdown(false);
  };

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSubmit({ ...form, email: form.email.trim(), name: form.name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new team member to your organization.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email <span className="text-destructive">*</span></Label>
              <Input id="invite-email" type="email" value={form.email}
                onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
                placeholder="user@example.com" autoFocus />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input id="invite-name" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name (optional)" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role Preset</Label>
            <Select value={form.role} onValueChange={handleRoleChange}>
              <SelectTrigger id="invite-role"><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {Object.keys(ROLE_PRESETS).map((role) => (
                  <SelectItem key={role} value={role}>
                    {role === 'SUPER_ADMIN' ? 'Super Admin' : role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Selecting a role automatically sets recommended permissions. You can customize below.</p>
          </div>
          <div className="grid gap-2">
            <Label>Assigned Sites</Label>
            <div className="relative" ref={dropdownRef}>
              <div className="flex flex-wrap gap-1.5 min-h-[42px] p-2 border rounded-md bg-background cursor-text"
                onClick={() => setShowSiteDropdown(true)}>
                {selectedSiteObjects.length === 0 && !showSiteDropdown && (
                  <span className="text-sm text-muted-foreground">Search and select sites...</span>
                )}
                {selectedSiteObjects.map((site) => (
                  <Badge key={site.id} variant="secondary" className="gap-1.5 pr-1 py-1 text-xs font-normal">
                    {site.logo ? <img src={site.logo} alt="" className="h-3.5 w-3.5 rounded-sm object-cover" /> : <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span>{site.name}</span>
                    {site.domain && <span className="text-muted-foreground">({site.domain})</span>}
                    <button type="button" className="ml-0.5 hover:bg-muted rounded-full p-0.5"
                      onClick={(e) => { e.stopPropagation(); removeSite(site.id); }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </Badge>
                ))}
                {showSiteDropdown && (
                  <input type="text" className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
                    placeholder="Search sites..." value={siteSearch} onChange={(e) => setSiteSearch(e.target.value)}
                    autoFocus onKeyDown={(e) => { if (e.key === 'Escape') setShowSiteDropdown(false); }} />
                )}
              </div>
              {showSiteDropdown && (
                <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  <button type="button" className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 border-b"
                    onClick={addAllSites}>
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>Select All Sites</span>
                    <span className="text-xs text-muted-foreground ml-auto">({sites.length})</span>
                  </button>
                  {filteredSites.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No sites found</div>
                  ) : (
                    filteredSites.map((site) => {
                      const isSelected = form.assignedSites.includes(site.id);
                      return (
                        <button key={site.id} type="button"
                          className={cn('w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-3', isSelected && 'bg-accent')}
                          onClick={() => isSelected ? removeSite(site.id) : addSite(site.id)}>
                          {site.logo ? <img src={site.logo} alt="" className="h-5 w-5 rounded object-cover" />
                            : <div className="h-5 w-5 rounded bg-muted flex items-center justify-center"><Globe className="h-3 w-3 text-muted-foreground" /></div>}
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{site.name}</div>
                            {site.domain && <div className="text-xs text-muted-foreground truncate">{site.domain}</div>}
                          </div>
                          {isSelected && <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Assign the user to one or multiple websites. Leave empty for all sites.</p>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Site Permissions</Label>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setPermissionsExpanded(!permissionsExpanded)}>
                {permissionsExpanded ? 'Collapse' : `Expand (${form.sitePermissions.length} selected)`}
              </button>
            </div>
            {permissionsExpanded ? (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {SITE_PERMISSIONS.map((perm) => (
                  <label key={perm.key} className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 cursor-pointer transition-colors">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-input"
                      checked={form.sitePermissions.includes(perm.key)} onChange={() => togglePermission(perm.key)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{perm.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{perm.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="border rounded-lg p-3">
                <div className="flex flex-wrap gap-1.5">
                  {form.sitePermissions.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No permissions selected</span>
                  ) : (
                    form.sitePermissions.map((key) => {
                      const perm = SITE_PERMISSIONS.find((p) => p.key === key);
                      return perm ? <Badge key={key} variant="secondary" className="text-xs font-normal">{perm.label}</Badge> : null;
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !form.email.trim()}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Helpers --------------------

function getInitialFormData(user: UserRow): EditFormData {
  return {
    name: user.name ?? '',
    email: user.email,
    role: user.role,
    status: user.status,
    bio: user.bio ?? '',
    avatar: user.avatar ?? '',
  };
}

// -------------------- Component --------------------

export function UsersListPage() {
  const navigate = useNavigationStore((s) => s.navigate);
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

  // Drawer & dialog state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<EditFormData>({
    name: '',
    email: '',
    role: 'AUTHOR',
    status: 'ACTIVE',
    bio: '',
    avatar: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
  // (getApi without raw unwraps the `data` field, losing pagination info)
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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EditFormData> }) =>
      patchApi(`/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setDrawerOpen(false);
      setEditUser(null);
      setFormErrors({});
    },
  });

  // Suspend/Activate toggle mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: UserStatus;
    }) =>
      patchApi(`/api/users/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setSuspendTarget(null);
    },
  });

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) => postApi('/api/users/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setInviteDialogOpen(false);
    },
  });

  // Navigation helpers
  const goToDetail = useCallback(
    (id: string) => navigate('users', id),
    [navigate],
  );

  // Edit handlers
  const openEditDrawer = useCallback((user: UserRow) => {
    setEditUser(user);
    setFormData(getInitialFormData(user));
    setFormErrors({});
    setDrawerOpen(true);
  }, []);

  const closeEditDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditUser(null);
    setFormErrors({});
  }, []);

  const handleSave = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = 'Invalid email address';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    if (!editUser) return;
    updateMutation.mutate({
      id: editUser.id,
      data: {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        status: formData.status,
        bio: formData.bio.trim() || undefined,
        avatar: formData.avatar.trim() || '',
      },
    });
  }, [formData, editUser, updateMutation]);

  const handleSuspendToggle = useCallback(
    (user: UserRow) => {
      const newStatus: UserStatus =
        user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      toggleStatusMutation.mutate({ id: user.id, status: newStatus });
      setSuspendTarget(null);
    },
    [toggleStatusMutation],
  );

  // Handle drawer state change — clean up when closed
  const handleDrawerOpenChange = useCallback(
    (open: boolean) => {
      setDrawerOpen(open);
      if (!open) {
        setEditUser(null);
        setFormErrors({});
      }
    },
    [],
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
                goToDetail(user.id);
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
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
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
              <DropdownMenuItem onClick={() => goToDetail(row.id)}>
                <Pencil className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEditDrawer(row)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setSuspendTarget(row)}
              >
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
    [goToDetail, openEditDrawer],
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
          <Button
            size="sm"
            onClick={() => setInviteDialogOpen(true)}
          >
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
        onRowClick={(row) => goToDetail(row.id)}
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

      {/* Edit Drawer (Sheet) */}
      <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
        <SheetContent
          side="right"
          className="sm:max-w-[640px] w-full overflow-y-auto p-0"
        >
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>Edit User</SheetTitle>
            <SheetDescription>
              Update user details, role, and status.
            </SheetDescription>
          </SheetHeader>

          <div className="p-6 space-y-5">
            {/* Avatar preview */}
            <div className="flex items-center gap-4">
              <AvatarWithFallback
                src={formData.avatar || undefined}
                name={formData.name || 'User'}
                size="lg"
              />
              <div>
                <p className="font-medium text-sm">
                  {formData.name || 'Unnamed'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formData.email}
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Full name"
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="edit-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="email@example.com"
              />
              {formErrors.email && (
                <p className="text-xs text-destructive">{formErrors.email}</p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    role: v as UserRole,
                  }))
                }
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: v as UserStatus,
                  }))
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea
                id="edit-bio"
                value={formData.bio}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bio: e.target.value }))
                }
                placeholder="Short biography..."
                rows={3}
              />
            </div>

            {/* Avatar URL */}
            <div className="space-y-2">
              <Label htmlFor="edit-avatar">Avatar URL</Label>
              <Input
                id="edit-avatar"
                value={formData.avatar}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, avatar: e.target.value }))
                }
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
          </div>

          <SheetFooter className="p-6 pt-4 border-t">
            <div className="flex items-center justify-end gap-2 w-full">
              <SheetClose asChild>
                <Button variant="outline" size="sm" onClick={closeEditDrawer}>
                  Cancel
                </Button>
              </SheetClose>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
          suspendTarget?.status === 'SUSPENDED'
            ? 'Activate User'
            : 'Suspend User'
        }
        description={
          suspendTarget
            ? suspendTarget.status === 'SUSPENDED'
              ? `Are you sure you want to activate "${suspendTarget.name || suspendTarget.email}"? They will regain access.`
              : `Are you sure you want to suspend "${suspendTarget.name || suspendTarget.email}"? They will lose access immediately.`
            : undefined
        }
        confirmLabel={
          suspendTarget?.status === 'SUSPENDED' ? 'Activate' : 'Suspend'
        }
        variant={
          suspendTarget?.status === 'SUSPENDED' ? 'default' : 'destructive'
        }
        onConfirm={() => {
          if (suspendTarget) handleSuspendToggle(suspendTarget);
        }}
        isLoading={toggleStatusMutation.isPending}
      />
    </div>
  );
}
