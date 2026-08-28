'use client';

// ============================================================
// PLATFORM BACKUPS — Platform-wide backup management.
// ============================================================
// Visual + implementation mirror the Client Backups page
// (src/modules/backups/backups-list-page.tsx): same PageHeader
// + Table layout, same Create Backup Dialog, same Restore /
// Delete ConfirmDialogs, same Verify + Download actions, same
// badge components (Scope / Type / Encryption / Verification /
// Status), same Skeleton-loading + EmptyState + inline
// No-Search-Results patterns.
//
// BUT the scope is PLATFORM-WIDE — see ALL backups across ALL
// sites (no site filter). The PLATFORM badge is preserved via
// PlatformPageHeader (NOT the client PageHeader).
//
// REUSES the existing Backup Prisma model + /api/backups API +
// backup-service — NO second backup engine. The /api/backups
// GET + POST routes were extended with a `scope=platform`
// query/body param guarded by requirePlatformAdmin (PLATFORM_ADMIN
// OR OWNER). The per-id endpoints (GET/PATCH/DELETE/verify/restore/
// download) are scope-agnostic and work as-is.
// ============================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { StatusBadge, ConfirmDialog, EmptyState } from '@/components/patterns';
import { getApi, postApi, deleteApi } from '@/lib/api-client';
import { cn, formatFileSize, formatRelativeTime, labelize } from '@/lib/utils';
import {
  formatDurationMs,
  BACKUP_SCOPE_OPTIONS,
  SCOPE_BADGE_CLASSES,
} from '@/lib/backup-constants';
import type {
  ApiResponse,
  BackupStatus,
  BackupType,
  BackupScope,
  BackupStorageProvider,
} from '@/shared/types';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  PlatformPageHeader,
  ErrorState,
} from '@/modules/platform/shared';

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
  backupScope: BackupScope;
  storageId: string;
  encryptionEnabled: boolean;
}

interface ListResponse {
  data: BackupRow[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

interface StorageDestination {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
}

// -------------------- Badge Components --------------------

function ScopeBadge({ scope }: { scope: BackupScope }) {
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent font-medium', SCOPE_BADGE_CLASSES[scope])}
    >
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
    <Badge
      variant="outline"
      className={cn('border-transparent font-medium', classes[type])}
    >
      {labelize(type)}
    </Badge>
  );
}

function EncryptionBadge({ status }: { status: string }) {
  if (status !== 'ENCRYPTED') {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <Badge
      variant="outline"
      className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium"
    >
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

// -------------------- Inline search empty state --------------------

/** Inline empty state rendered inside the table when an active search
 * yields zero results. Distinct from the standalone "No backups yet"
 * state which only shows when the system genuinely has zero backups. */
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
  backupScope: 'FULL',
  storageId: '',
  encryptionEnabled: false,
};

// -------------------- Main Component --------------------

export function PlatformBackupsModule() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  // -------------------- UI State --------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateBackupForm>(initialForm);
  const [deleteTarget, setDeleteTarget] = useState<BackupRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupRow | null>(null);

  // -------------------- Search State (debounced, client-side) --------------------
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const updateSearch = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearch('');
  }, []);

  const updateForm = useCallback(
    (key: keyof CreateBackupForm, value: string | boolean) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // -------------------- Data fetching --------------------
  // GET /api/backups?scope=platform — platform admin sees ALL backups
  // across all sites (no site filter). The queryKey includes `search`
  // per spec; the API call itself does NOT send search server-side
  // because we filter client-side by name (mirrors spec wording).
  const { data: raw, isLoading, isError, refetch } = useQuery({
    queryKey: ['platform-backups', search],
    queryFn: () =>
      getApi<ListResponse>(
        '/api/backups',
        { scope: 'platform', pageSize: 20 },
        { raw: true },
      ),
    staleTime: 10_000,
  });

  const backups = useMemo(() => {
    const list = (Array.isArray(raw?.data) ? raw.data : []) as BackupRow[];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((b) =>
      (b.name ?? '').toLowerCase().includes(q) ||
      (b.note ?? '').toLowerCase().includes(q),
    );
  }, [raw, search]);

  // Fetch configured storage destinations for the dropdown.
  // Platform admins have no active site context, so api-client does not
  // inject siteId — the storage endpoint returns ALL destinations across
  // all sites. The `?scope=platform` is passed for explicitness (it's a
  // no-op on the storage route today).
  const { data: storageDestinationsData } = useQuery({
    queryKey: ['platform-backups-storage-destinations'],
    queryFn: () =>
      getApi<ListResponse>('/api/backups/storage', {
        scope: 'platform',
        pageSize: 100,
      }, { raw: true }),
    staleTime: 30_000,
  });
  const storageDestinations = useMemo(() => {
    const list = (Array.isArray(storageDestinationsData?.data)
      ? storageDestinationsData.data
      : []) as StorageDestination[];
    return list.filter((s) => s.isActive);
  }, [storageDestinationsData]);

  const hasSearch = !!search.trim();
  const isInitialEmpty = !isLoading && backups.length === 0 && !hasSearch;
  const isSearchEmpty = !isLoading && backups.length === 0 && hasSearch;

  // -------------------- Mutations --------------------
  const createMutation = useMutation({
    mutationFn: () =>
      postApi('/api/backups', {
        scope: 'platform',
        backupScope: form.backupScope,
        name: form.name.trim(),
        description: form.description.trim(),
        storageId: form.storageId || undefined,
        encryptionEnabled: form.encryptionEnabled,
      } as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-backups'] });
      toast.success('Backup creation started');
      setDialogOpen(false);
      setForm(initialForm);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create backup'),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) =>
      postApi(`/api/backups/${id}/verify`, {
        ...(currentUserId ? { createdById: currentUserId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-backups'] });
      toast.success('Verification started');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to verify backup'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      postApi(`/api/backups/${id}/restore`, {
        ...(currentUserId ? { createdById: currentUserId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-backups'] });
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
      queryClient.invalidateQueries({ queryKey: ['platform-backups'] });
      setDeleteTarget(null);
      toast.success('Backup deleted');
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      toast.error(err.message || 'Failed to delete backup');
    },
  });

  // -------------------- Render --------------------
  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Backups"
        subtitle="Platform-wide backup management. Restore, verify, and download backups across all customers and sites."
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Backup
          </Button>
        }
      />

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search backups by name..."
          value={searchInput}
          onChange={(e) => updateSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Backup History Table — same visual structure as the Client
          Backups page: bordered Card + plain Table with overflow-x-auto
          and the same 11 columns (Name / Scope / Type / Size / Storage /
          Encryption / Verification / Status / Duration / Created /
          Actions). */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        {isLoading ? (
          // Loading: 5 skeleton table rows matching the 11-column layout.
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-8 ml-auto" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="py-6">
            <ErrorState
              message="Unable to load platform backups. Make sure you are signed in as a platform admin."
              onRetry={() => refetch()}
            />
          </div>
        ) : isInitialEmpty ? (
          <EmptyState
            icon={DatabaseBackup}
            title="No backups recorded"
            description="When backups complete they will appear here. Create your first platform-wide backup to get started."
            action={{
              label: 'Create Backup',
              onClick: () => setDialogOpen(true),
              icon: <Plus className="h-4 w-4" />,
            }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Encryption</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isSearchEmpty ? (
                <TableRow>
                  <TableCell colSpan={11} className="p-0">
                    <NoSearchResultsEmpty onClear={handleClearSearch} />
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((b) => (
                  <TableRow key={b.id} className="group">
                    <TableCell className="pl-4">
                      <span className="font-medium text-sm" title={b.name}>
                        {b.name || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ScopeBadge scope={b.scope} />
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={b.type} />
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums text-sm text-muted-foreground">
                        {formatFileSize(b.size)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-xs text-muted-foreground"
                        title={labelize(b.storageProvider)}
                      >
                        {labelize(b.storageProvider)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <EncryptionBadge status={b.encryptionStatus} />
                    </TableCell>
                    <TableCell>
                      <VerificationBadge status={b.verificationStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatDurationMs(b.durationMs)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-xs text-muted-foreground"
                        title={formatRelativeTime(b.createdAt)}
                      >
                        {formatRelativeTime(b.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
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
                              window.open(`/api/backups/${b.id}/download`, '_blank')
                            }
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => verifyMutation.mutate(b.id)}
                            disabled={
                              b.status !== 'COMPLETED' || verifyMutation.isPending
                            }
                          >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Verify
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setRestoreTarget(b)}
                            disabled={b.status !== 'COMPLETED'}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(b)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Backup Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>
              Start a new platform-wide backup. The backup will be visible across all customers and sites.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="backup-name">Name</Label>
              <Input
                id="backup-name"
                placeholder="e.g., Daily platform backup"
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
              <Select
                value={form.backupScope}
                onValueChange={(v) => updateForm('backupScope', v)}
              >
                <SelectTrigger id="backup-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BACKUP_SCOPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-storage">Storage Destination</Label>
              <Select
                value={form.storageId}
                onValueChange={(v) => updateForm('storageId', v)}
              >
                <SelectTrigger id="backup-storage">
                  <SelectValue placeholder="Select a storage destination" />
                </SelectTrigger>
                <SelectContent>
                  {storageDestinations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {labelize(s.provider)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {storageDestinations.length === 0 && (
                <p className="text-xs text-amber-600">
                  No storage destinations configured. Add one in Storage first.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="backup-encryption">Encryption</Label>
                <p className="text-xs text-muted-foreground">
                  Encrypt backup with AES-256
                </p>
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
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !form.name.trim() ||
                !form.storageId
              }
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
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
        description="Restore this backup? The current database will be replaced."
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
        description="Delete this backup? The backup file will be permanently removed."
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
