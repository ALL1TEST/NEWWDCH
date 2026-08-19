'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Loader2,
  ArrowUpDown,
  Filter,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
  ConfirmDialog,
  StatusBadge,
} from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi, putApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { truncate } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaginatedResponse, RedirectType } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';

// ==================== Types ====================

interface RedirectRow {
  id: string;
  fromPath: string;
  toPath: string;
  type: RedirectType;
  hits: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RedirectFormData {
  fromPath: string;
  toPath: string;
  type: RedirectType;
  active: boolean;
}

// ==================== Constants ====================

const EMPTY_REDIRECT_FORM: RedirectFormData = {
  fromPath: '',
  toPath: '',
  type: 'PERMANENT_301',
  active: true,
};

const REDIRECT_TYPE_OPTIONS: {
  label: string;
  value: RedirectType;
  badge: string;
  statusKey: string;
}[] = [
  { label: '301 Permanent', value: 'PERMANENT_301', badge: '301', statusKey: 'PERMANENT_301' },
  { label: '302 Temporary', value: 'TEMPORARY_302', badge: '302', statusKey: 'TEMPORARY_302' },
  { label: '307 Temporary', value: 'TEMPORARY_307', badge: '307', statusKey: 'TEMPORARY_307' },
  { label: '308 Permanent', value: 'PERMANENT_308', badge: '308', statusKey: 'PERMANENT_308' },
];

// ==================== Validation ====================

function validateRedirectForm(form: RedirectFormData, isEdit: boolean): string | null {
  if (!form.fromPath.trim()) return 'From URL is required.';
  if (!form.fromPath.startsWith('/')) return 'From URL must start with "/".';
  if (!form.toPath.trim()) return 'To URL is required.';
  if (!form.toPath.startsWith('/')) return 'To URL must start with "/".';
  if (!isEdit && form.fromPath.trim() === form.toPath.trim()) {
    return 'From URL and To URL cannot be the same (self-redirect).';
  }
  if (form.fromPath.trim().toLowerCase() === form.toPath.trim().toLowerCase()) {
    return 'From URL and To URL cannot be the same (self-redirect).';
  }
  return null;
}

// ==================== Redirect Form Dialog ====================

interface RedirectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RedirectFormData;
  onChange: (data: RedirectFormData) => void;
  onSubmit: () => void;
  isPending: boolean;
  title: string;
  description: string;
  submitLabel: string;
  isEdit?: boolean;
}

function RedirectFormDialog({
  open,
  onOpenChange,
  data,
  onChange,
  onSubmit,
  isPending,
  title,
  description,
  submitLabel,
  isEdit = false,
}: RedirectFormDialogProps) {
  const validationError = validateRedirectForm(data, isEdit);
  const isFormValid = !validationError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="redirect-from">From URL *</Label>
            <Input
              id="redirect-from"
              value={data.fromPath}
              onChange={(e) =>
                onChange({ ...data, fromPath: e.target.value })
              }
              placeholder="/old-page"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              The original URL path. Must start with &quot;/&quot;.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="redirect-to">To URL *</Label>
            <Input
              id="redirect-to"
              value={data.toPath}
              onChange={(e) =>
                onChange({ ...data, toPath: e.target.value })
              }
              placeholder="/new-page"
            />
            <p className="text-xs text-muted-foreground">
              The destination URL path. Must start with &quot;/&quot;.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="redirect-type">Redirect Type *</Label>
            <Select
              value={data.type}
              onValueChange={(v) =>
                onChange({ ...data, type: v as RedirectType })
              }
            >
              <SelectTrigger id="redirect-type">
                <SelectValue placeholder="Select redirect type" />
              </SelectTrigger>
              <SelectContent>
                {REDIRECT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="redirect-active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Enable this redirect rule
              </p>
            </div>
            <Switch
              id="redirect-active"
              checked={data.active}
              onCheckedChange={(checked) =>
                onChange({ ...data, active: checked })
              }
            />
          </div>

          {validationError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {validationError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || !isFormValid}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== CSV Import Dialog ====================

interface CsvValidationResult {
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; message: string }>;
}

interface CsvImportResult {
  imported: number;
  skipped: number;
  errorsDuringImport: number;
}

function CsvImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [csvContent, setCsvContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<CsvValidationResult | null>(null);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');

  const validateMutation = useMutation({
    mutationFn: (csv: string) => postApi<CsvValidationResult>('/api/redirects/bulk?action=import', { csvContent: csv }),
    onSuccess: (data) => { setValidation(data as unknown as CsvValidationResult); setStep('preview'); },
    onError: () => toast.error('Failed to validate CSV'),
  });

  const importMutation = useMutation({
    mutationFn: () => postApi<CsvImportResult>('/api/redirects/bulk?action=import&confirm=true', { csvContent }),
    onSuccess: (data) => { setImportResult(data as unknown as CsvImportResult); setStep('done'); queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all }); },
    onError: () => toast.error('Import failed'),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; setCsvContent(text); setValidation(null); setImportResult(null); setStep('upload'); };
    reader.readAsText(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; setCsvContent(text); setValidation(null); setImportResult(null); setStep('upload'); };
    reader.readAsText(f);
  };

  const handleValidate = () => { if (csvContent.trim()) validateMutation.mutate(csvContent); };
  const handleImport = () => { importMutation.mutate(); };
  const handleClose = () => { onOpenChange(false); setTimeout(() => { setCsvContent(''); setFile(null); setValidation(null); setImportResult(null); setStep('upload'); }, 200); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import Redirects CSV</DialogTitle><DialogDescription>Upload a CSV file with columns: from, to, type (301, 302, 307, 308)</DialogDescription></DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-2">
            <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => document.getElementById('csv-file-input')?.click()}>
              <input id="csv-file-input" type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
              {file && <p className="text-xs text-muted-foreground mt-1">{file.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Or paste CSV content:</Label>
              <textarea className="w-full min-h-[120px] rounded-md border border-border bg-transparent px-3 py-2 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" placeholder="from,to,type
/old-page,/new-page,301" value={csvContent} onChange={(e) => setCsvContent(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleValidate} disabled={!csvContent.trim() || validateMutation.isPending}>{validateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Validate & Preview</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && validation && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center"><p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">{validation.validRows}</p><p className="text-xs text-muted-foreground">Valid</p></div>
              <div className="rounded-lg border p-3 text-center"><p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{validation.invalidRows}</p><p className="text-xs text-muted-foreground">Invalid</p></div>
              <div className="rounded-lg border p-3 text-center"><p className="text-lg font-bold tabular-nums">{validation.errors.length}</p><p className="text-xs text-muted-foreground">Errors</p></div>
            </div>
            {validation.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border p-3 space-y-1">
                {validation.errors.map((err, i) => (<div key={i} className="flex items-start gap-2 text-xs"><XCircle className="h-3 w-3 mt-0.5 text-red-500 shrink-0" /><span>Row {err.row}: {err.message}</span></div>))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleImport} disabled={validation.validRows === 0 || importMutation.isPending}>{importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{importMutation.isPending ? 'Importing...' : `Import ${validation.validRows} Redirects`}</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
            <p className="font-semibold">Import Complete</p>
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              <div><p className="text-lg font-bold tabular-nums text-green-600">{importResult.imported}</p><p className="text-xs text-muted-foreground">Imported</p></div>
              <div><p className="text-lg font-bold tabular-nums text-amber-600">{importResult.skipped}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
              <div><p className="text-lg font-bold tabular-nums text-red-600">{importResult.errorsDuringImport}</p><p className="text-xs text-muted-foreground">Errors</p></div>
            </div>
            <DialogFooter className="justify-center"><Button onClick={handleClose}>Done</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== Main Page ====================

export function SeoRedirectsPage() {
  const queryClient = useQueryClient();

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RedirectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RedirectRow | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createForm, setCreateForm] =
    useState<RedirectFormData>(EMPTY_REDIRECT_FORM);
  const [editForm, setEditForm] =
    useState<RedirectFormData>(EMPTY_REDIRECT_FORM);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Table state
  const table = useDataTable({
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
    initialPageSize: DEFAULT_PAGE_SIZE,
  });

  const queryParams = useMemo(
    () => ({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      search: table.searchValue || undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      active:
        statusFilter !== 'all'
          ? statusFilter === 'active'
          : undefined,
    }),
    [
      table.currentPage,
      table.pageSize,
      table.sortField,
      table.sortOrder,
      table.searchValue,
      typeFilter,
      statusFilter,
    ],
  );

  // Query
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.redirects.list(queryParams),
    queryFn: () =>
      getApi<PaginatedResponse<RedirectRow>>(
        '/api/redirects',
        queryParams,
      ),
    staleTime: 10_000,
  });

  const redirects = data?.data ?? [];
  const totalItems = data?.pagination?.total ?? 0;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (formData: RedirectFormData) =>
      postApi<RedirectRow>('/api/redirects', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
      setIsCreateOpen(false);
      setCreateForm(EMPTY_REDIRECT_FORM);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: RedirectFormData }) =>
      patchApi<RedirectRow>(`/api/redirects/${id}`, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
      setEditTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/redirects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
      setDeleteTarget(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      patchApi(`/api/redirects/${id}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/redirects/bulk?action=export');
      if (!resp.ok) throw new Error('Export failed');
      const text = await resp.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'redirects.csv'; a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Redirects exported'),
    onError: () => toast.error('Export failed'),
  });

  const handleExport = useCallback(() => exportMutation.mutate(), [exportMutation]);

  // Handlers
  const handleOpenEdit = useCallback((row: RedirectRow) => {
    setEditTarget(row);
    setEditForm({
      fromPath: row.fromPath,
      toPath: row.toPath,
      type: row.type,
      active: row.active,
    });
  }, []);

  const handleCreate = useCallback(() => {
    const error = validateRedirectForm(createForm, false);
    if (error) return;
    createMutation.mutate(createForm);
  }, [createForm, createMutation]);

  const handleUpdate = useCallback(() => {
    if (!editTarget) return;
    const error = validateRedirectForm(editForm, true);
    if (error) return;
    updateMutation.mutate({ id: editTarget.id, formData: editForm });
  }, [editTarget, editForm, updateMutation]);

  // Columns
  const columns = useMemo<ColumnDef<RedirectRow>[]>(
    () => [
      ColumnDefHelper.textColumn<RedirectRow>({
        id: 'fromPath',
        header: 'From Path',
        accessorKey: 'fromPath',
        className: 'font-mono text-sm',
        truncate: 60,
      }),
      ColumnDefHelper.textColumn<RedirectRow>({
        id: 'toPath',
        header: 'To Path',
        accessorKey: 'toPath',
        className: 'font-mono text-sm',
        truncate: 60,
      }),
      {
        id: 'type',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            <span className="font-medium">Type</span>
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          </button>
        ),
        accessorKey: 'type',
        enableSorting: true,
        cell: ({ row }) => {
          const t = row.original.type;
          const found = REDIRECT_TYPE_OPTIONS.find((o) => o.value === t);
          return (
            <StatusBadge
              status={found?.statusKey ?? t}
              size="sm"
            />
          );
        },
      },
      {
        id: 'hits',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            <span className="font-medium">Hits</span>
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          </button>
        ),
        accessorKey: 'hits',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.hits.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            <span className="font-medium">Created</span>
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          </button>
        ),
        accessorKey: 'createdAt',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            <span className="font-medium">Updated</span>
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          </button>
        ),
        accessorKey: 'updatedAt',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.updatedAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'active',
        header: 'Status',
        accessorKey: 'active',
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.active}
              onCheckedChange={(checked) =>
                toggleActiveMutation.mutate({
                  id: row.original.id,
                  active: checked,
                })
              }
            />
            <Badge
              variant="outline"
              className={
                row.original.active
                  ? 'border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'border-transparent bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
              }
            >
              {row.original.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        ),
      },
      ColumnDefHelper.actionColumn<RedirectRow>({
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
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenEdit(row)}>
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
    [handleOpenEdit, toggleActiveMutation],
  );

  // Filter content for DataTable
  const filterContent = (
    <div className="flex items-center gap-2">
      <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {REDIRECT_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); table.setCurrentPage(1); }}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Redirects"
        description="Manage URL redirect rules for your site"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button
              onClick={() => {
                setCreateForm(EMPTY_REDIRECT_FORM);
                setIsCreateOpen(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Redirect
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={redirects}
        isLoading={isLoading}
        totalItems={totalItems}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(field, order) => table.setSortField(field, order)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        searchPlaceholder="Search redirects by path..."
        searchValue={table.searchValue}
        onSearch={(v) => {
          table.setSearchValue(v);
          table.setCurrentPage(1);
        }}
        getRowId={(row) => row.id}
        emptyMessage="No redirects found. Create your first redirect rule."
        filterContent={filterContent}
      />

      {/* Create Dialog */}
      <RedirectFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        data={createForm}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
        title="Create Redirect"
        description="Set up a new URL redirect rule"
        submitLabel="Create Redirect"
      />

      {/* Edit Dialog */}
      <RedirectFormDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        data={editForm}
        onChange={setEditForm}
        onSubmit={handleUpdate}
        isPending={updateMutation.isPending}
        title="Edit Redirect"
        description={`Update redirect from "${truncate(editTarget?.fromPath ?? '', 40)}"`}
        submitLabel="Save Changes"
        isEdit
      />

      {/* CSV Import Dialog */}
      <CsvImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Redirect"
        description={
          deleteTarget
            ? `Are you sure you want to delete the redirect from "${truncate(deleteTarget.fromPath, 40)}" to "${truncate(deleteTarget.toPath, 40)}"? This action cannot be undone.`
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
