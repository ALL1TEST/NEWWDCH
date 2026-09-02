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
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GitBranch,
  Search,
  ExternalLink,
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
  ConfirmDialog,
} from '@/components/patterns';
import { EmptyState } from '@/components/patterns/empty-state';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { truncate, cn } from '@/lib/utils';
import { useSiteStore } from '@/lib/stores/site-store';
import { useT } from '@/lib/i18n';
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

type ListResponse = PaginatedResponse<RedirectRow>;

// ==================== Constants ====================

const EMPTY_REDIRECT_FORM: RedirectFormData = {
  fromPath: '',
  toPath: '',
  type: 'PERMANENT_301',
  active: true,
};

interface TypeOption {
  labelKey: string;
  shortKey: string;
  value: RedirectType;
  code: string;
  tone: 'permanent' | 'temporary';
}

// labelKey/shortKey values are resolved via t() at render time (display-only
// fields; the value/code still drive selection and filtering).
const REDIRECT_TYPE_OPTIONS: TypeOption[] = [
  { labelKey: 'seo.type301Permanent', shortKey: 'seo.permanent', value: 'PERMANENT_301', code: '301', tone: 'permanent' },
  { labelKey: 'seo.type302Temporary', shortKey: 'seo.temporary', value: 'TEMPORARY_302', code: '302', tone: 'temporary' },
  { labelKey: 'seo.type307Temporary', shortKey: 'seo.temporary', value: 'TEMPORARY_307', code: '307', tone: 'temporary' },
  { labelKey: 'seo.type308Permanent', shortKey: 'seo.permanent', value: 'PERMANENT_308', code: '308', tone: 'permanent' },
];

function getTypeOption(type: RedirectType): TypeOption {
  return REDIRECT_TYPE_OPTIONS.find((o) => o.value === type) ?? REDIRECT_TYPE_OPTIONS[0];
}

// ==================== Helpers ====================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatRelative(dateStr: string | null | undefined, t: (key: string) => string): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 30) return formatDate(dateStr);
    if (days > 0) return `${days}${t('seo.daysAgo')}`;
    if (hours > 0) return `${hours}${t('seo.hoursAgo')}`;
    if (minutes > 0) return `${minutes}${t('seo.minutesAgo')}`;
    return t('seo.justNow');
  } catch {
    return '—';
  }
}

// ==================== Type Badge ====================

function RedirectTypeBadge({ type }: { type: RedirectType }) {
  const { t } = useT();
  const opt = getTypeOption(type);
  const toneClasses =
    opt.tone === 'permanent'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50';
  return (
    <Badge
      variant="outline"
      className={cn('font-medium gap-1 px-2 py-0.5 whitespace-nowrap', toneClasses)}
    >
      <span className="font-mono text-[10px] font-bold opacity-80">{opt.code}</span>
      <span className="opacity-40">·</span>
      <span>{t(opt.shortKey)}</span>
    </Badge>
  );
}

// ==================== Path Link (external) ====================

/**
 * Builds an absolute URL for a redirect path. Absolute URLs (http/https) are
 * used as-is; bare paths are resolved against the active site's domain (or
 * the current window origin as a fallback) so clicking opens the real source
 * or destination URL in a new tab.
 */
function buildRedirectUrl(path: string, domain: string | null | undefined): string {
  if (/^https?:\/\//i.test(path)) return path;
  let origin = '';
  if (domain) {
    origin = domain.startsWith('http') ? domain : `https://${domain}`;
  } else if (typeof window !== 'undefined') {
    origin = window.location.origin;
  } else {
    return path;
  }
  if (origin.endsWith('/')) origin = origin.slice(0, -1);
  return origin + (path.startsWith('/') ? path : `/${path}`);
}

function PathLink({ path }: { path: string }) {
  const { t } = useT();
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const href = useMemo(
    () => buildRedirectUrl(path, activeSite?.domain),
    [path, activeSite?.domain],
  );
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 font-mono text-sm text-foreground/80 hover:text-primary hover:underline underline-offset-2 max-w-[260px] min-w-0 transition-colors"
      title={`${t('seo.openInNewTabPrefix')} ${path} ${t('seo.openInNewTabSuffix')}`}
    >
      <span className="truncate">{path}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
    </a>
  );
}

// ==================== Status Cell ====================

interface StatusCellProps {
  row: RedirectRow;
  onToggle: (id: string, nextActive: boolean) => void;
  isPending: boolean;
}

function StatusToggleCell({ row, onToggle, isPending }: StatusCellProps) {
  const { t } = useT();
  const active = row.active;
  // The Status column contains ONLY the functional toggle. The switch's
  // checked/unchecked state communicates active/inactive; no text label.
  return (
    <div className="flex items-center">
      <Switch
        checked={active}
        disabled={isPending}
        onCheckedChange={(checked) => {
          // Only fire when the value actually changes — Switch fires on user
          // interaction, but we guard against spurious re-fires.
          if (checked !== active) {
            onToggle(row.id, checked);
          }
        }}
        aria-label={active ? t('seo.deactivateRedirect') : t('seo.activateRedirect')}
        className={cn(
          'cursor-pointer',
          // Active/on color = BLACK (was emerald).
          // Light mode: black track + default white thumb (bg-background) = clear.
          // Dark mode: black track + forced white thumb — the Switch's default
          // dark-mode checked thumb (bg-primary-foreground) is dark and would
          // be invisible on a pure-black track, so we override it to white.
          'data-[state=checked]:bg-black dark:data-[state=checked]:bg-black',
          'dark:[&[data-state=checked]>span]:bg-white',
          // Inactive/off state — keep visually clear (unchanged).
          'data-[state=unchecked]:bg-zinc-300 dark:data-[state=unchecked]:bg-zinc-700',
        )}
      />
    </div>
  );
}

// ==================== Sortable Header ====================

function SortableHeader({
  label,
  column,
  align = 'left',
}: {
  label: string;
  column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void };
  align?: 'left' | 'right' | 'center';
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      className={cn(
        'flex items-center gap-1 hover:text-foreground transition-colors',
        align === 'right' && 'flex-row-reverse ml-auto',
        align === 'center' && 'justify-center',
      )}
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      <span className="font-medium">{label}</span>
      <ArrowUpDown
        className={cn(
          'h-3.5 w-3.5 transition-opacity',
          sorted ? 'opacity-100 text-foreground' : 'opacity-40',
        )}
      />
    </button>
  );
}

// ==================== Validation ====================

function validateRedirectForm(form: RedirectFormData, isEdit: boolean, t: (key: string) => string): string | null {
  if (!form.fromPath.trim()) return t('seo.fromPathRequired');
  if (!form.fromPath.startsWith('/')) return t('seo.fromPathMustStart');
  if (!form.toPath.trim()) return t('seo.toPathRequired');
  if (!form.toPath.startsWith('/')) return t('seo.toPathMustStart');
  // Self-redirect check (case-insensitive — /About and /about are the same URL).
  if (form.fromPath.trim().toLowerCase() === form.toPath.trim().toLowerCase()) {
    return t('seo.selfRedirect');
  }
  // Basic path validity — no spaces, no illegal chars.
  const pathRe = /^\/[^\s]*$/;
  if (!pathRe.test(form.fromPath.trim())) return t('seo.fromPathInvalid');
  if (!pathRe.test(form.toPath.trim())) return t('seo.toPathInvalid');
  return null;
}

// ==================== Per-field validation ====================
//
// Returns per-field error strings (empty = valid). Used by the form dialog to
// show inline errors only after a field is touched — never on modal open.
function getFieldErrors(form: RedirectFormData, t: (key: string) => string): { from: string; to: string } {
  const from = form.fromPath.trim();
  const to = form.toPath.trim();
  let fromErr = '';
  let toErr = '';
  if (!from) fromErr = t('seo.fromPathRequired');
  else if (!form.fromPath.startsWith('/')) fromErr = t('seo.fromPathMustStart');
  else if (!/^\/[^\s]*$/.test(form.fromPath.trim())) fromErr = t('seo.fromPathInvalid');
  if (!to) toErr = t('seo.toPathRequired');
  else if (!form.toPath.startsWith('/')) toErr = t('seo.toPathMustStart');
  else if (!/^\/[^\s]*$/.test(form.toPath.trim())) toErr = t('seo.toPathInvalid');
  // Self-redirect — surface on the From field (cross-field check).
  if (!fromErr && !toErr && from.toLowerCase() === to.toLowerCase()) {
    fromErr = t('seo.selfRedirect');
  }
  return { from: fromErr, to: toErr };
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
  // Track which fields the user has interacted with (blurred). Validation
  // errors are only revealed after a field is touched — never on modal open.
  const [touched, setTouched] = useState({ from: false, to: false });
  const { t } = useT();
  // Reset touched whenever the dialog opens (render-phase sync, not an effect —
  // mirrors the key-based pattern used elsewhere so stale errors from a prior
  // session never carry over into a freshly opened modal).
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setTouched({ from: false, to: false });
  }

  const errs = getFieldErrors(data, t);
  const hasError = Boolean(errs.from) || Boolean(errs.to);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="redirect-from">{t('seo.fromPath')} *</Label>
            <Input
              id="redirect-from"
              value={data.fromPath}
              onChange={(e) => onChange({ ...data, fromPath: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, from: true }))}
              placeholder="/old-page"
              autoFocus
              className="font-mono"
              aria-invalid={touched.from && !!errs.from}
            />
            <p className="text-xs text-muted-foreground">
              {t('seo.fromPathHint')}
            </p>
            {touched.from && errs.from && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {errs.from}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="redirect-to">{t('seo.toPath')} *</Label>
            <Input
              id="redirect-to"
              value={data.toPath}
              onChange={(e) => onChange({ ...data, toPath: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, to: true }))}
              placeholder="/new-page"
              className="font-mono"
              aria-invalid={touched.to && !!errs.to}
            />
            <p className="text-xs text-muted-foreground">
              {t('seo.toPathHint')}
            </p>
            {touched.to && errs.to && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {errs.to}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="redirect-type">{t('seo.redirectType')} *</Label>
            <Select
              value={data.type}
              onValueChange={(v) => onChange({ ...data, type: v as RedirectType })}
            >
              <SelectTrigger id="redirect-type">
                <SelectValue placeholder={t('seo.selectRedirectType')} />
              </SelectTrigger>
              <SelectContent>
                {REDIRECT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="font-mono text-xs font-bold mr-2 opacity-70">
                      {opt.code}
                    </span>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">301/308</span> {t('seo.typePermHint')}
              <span className="font-medium"> 302/307</span> {t('seo.typeTempHint')}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="redirect-active" className="text-sm font-medium">
                {t('common.active')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('seo.activeHint')}
              </p>
            </div>
            <Switch
              id="redirect-active"
              checked={data.active}
              onCheckedChange={(checked) => onChange({ ...data, active: checked })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || hasError}
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

const CSV_TEMPLATE = `fromPath,toPath,type,status
/old-page,/new-page,301,active
/legacy-product,/products,302,inactive`;

function CsvImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [csvContent, setCsvContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<CsvValidationResult | null>(null);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');

  const validateMutation = useMutation({
    mutationFn: (csv: string) =>
      postApi<CsvValidationResult>('/api/redirects/bulk?action=import', { csvContent: csv }),
    onSuccess: (data) => {
      setValidation(data as unknown as CsvValidationResult);
      setStep('preview');
    },
    onError: (err: Error) => toast.error(err.message || t('seo.csvValidateFailed')),
  });

  const importMutation = useMutation({
    mutationFn: () =>
      postApi<CsvImportResult>(
        '/api/redirects/bulk?action=import&confirm=true',
        { csvContent },
      ),
    onSuccess: (data) => {
      const result = data as unknown as CsvImportResult;
      setImportResult(result);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
      if (result.imported > 0) {
        toast.success(`${t('seo.importedPrefix')} ${result.imported} ${result.imported === 1 ? t('seo.redirectSingular') : t('seo.redirects')}`);
      }
      if (result.errorsDuringImport > 0) {
        toast.error(`${result.errorsDuringImport} ${t('seo.rowsFailedToImport')}`);
      }
    },
    onError: (err: Error) => toast.error(err.message || t('seo.importFailedToast')),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvContent(text);
      setValidation(null);
      setImportResult(null);
      setStep('upload');
    };
    reader.readAsText(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvContent(text);
      setValidation(null);
      setImportResult(null);
      setStep('upload');
    };
    reader.readAsText(f);
  };

  const handleValidate = () => {
    if (csvContent.trim()) validateMutation.mutate(csvContent);
  };
  const handleImport = () => importMutation.mutate();
  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setCsvContent('');
      setFile(null);
      setValidation(null);
      setImportResult(null);
      setStep('upload');
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('seo.importCsvTitle')}</DialogTitle>
          <DialogDescription>
            {t('seo.csvDescPrefix')}{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">fromPath</code>,{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">toPath</code>,{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">type</code>{' '}
            {t('seo.csvDescTypeSuffix')}{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">status</code>{' '}
            {t('seo.csvDescStatusSuffix')}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-2">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById('csv-file-input')?.click()}
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">
                {t('seo.dropCsvHere')}
              </p>
              {file && (
                <p className="text-xs text-muted-foreground mt-1">{file.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('seo.pasteCsvContent')}</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-border bg-transparent px-3 py-2 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                placeholder={CSV_TEMPLATE}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleValidate}
                disabled={!csvContent.trim() || validateMutation.isPending}
              >
                {validateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {t('seo.validatePreview')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && validation && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {validation.validRows}
                </p>
                <p className="text-xs text-muted-foreground">{t('seo.valid')}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                  {validation.invalidRows}
                </p>
                <p className="text-xs text-muted-foreground">{t('seo.invalid')}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-bold tabular-nums">
                  {validation.errors.length}
                </p>
                <p className="text-xs text-muted-foreground">{t('seo.errors')}</p>
              </div>
            </div>
            {validation.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border p-3 space-y-1">
                {validation.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <XCircle className="h-3 w-3 mt-0.5 text-red-500 shrink-0" />
                    <span>
                      <span className="font-medium">{t('seo.row')} {err.row}:</span> {err.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>
                {t('common.back')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={validation.validRows === 0 || importMutation.isPending}
              >
                {importMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {importMutation.isPending
                  ? t('seo.importing')
                  : `${t('seo.importPrefix')} ${validation.validRows} ${validation.validRows === 1 ? t('seo.redirectSingular') : t('seo.redirects')}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="space-y-4 py-2 text-center">
            {importResult.errorsDuringImport > 0 && importResult.imported === 0 ? (
              <XCircle className="h-10 w-10 mx-auto text-red-500" />
            ) : (
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            )}
            <p className="font-semibold">
              {importResult.imported > 0 ? t('seo.importComplete') : t('seo.importFailed')}
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              <div>
                <p className="text-lg font-bold tabular-nums text-emerald-600">
                  {importResult.imported}
                </p>
                <p className="text-xs text-muted-foreground">{t('seo.imported')}</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-amber-600">
                  {importResult.skipped}
                </p>
                <p className="text-xs text-muted-foreground">{t('seo.skipped')}</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-red-600">
                  {importResult.errorsDuringImport}
                </p>
                <p className="text-xs text-muted-foreground">{t('seo.errors')}</p>
              </div>
            </div>
            <DialogFooter className="justify-center">
              <Button onClick={handleClose}>{t('seo.done')}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== Main Page ====================

export function SeoRedirectsPage() {
  const { t } = useT();
  const queryClient = useQueryClient();

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RedirectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RedirectRow | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<RedirectFormData>(EMPTY_REDIRECT_FORM);
  const [editForm, setEditForm] = useState<RedirectFormData>(EMPTY_REDIRECT_FORM);

  // Track which redirect is currently being toggled — for per-row loading state.
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      // Send `isActive` so the backend filter works regardless of alias support.
      isActive:
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

  const queryKey = queryKeys.redirects.list(queryParams);

  // Query
  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey,
    queryFn: () => getApi<ListResponse>('/api/redirects', queryParams),
    staleTime: 10_000,
  });

  const redirects = data?.data ?? [];
  const totalItems = data?.pagination?.total ?? 0;

  // ---- Helpers for optimistic cache updates -----------------------------

  const updateCachedRow = useCallback(
    (id: string, patch: Partial<RedirectRow>) => {
      queryClient.setQueryData<ListResponse>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        };
      });
    },
    [queryClient, queryKey],
  );

  const removeCachedRow = useCallback(
    (id: string) => {
      queryClient.setQueryData<ListResponse>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.filter((r) => r.id !== id),
          pagination: {
            ...prev.pagination,
            total: Math.max(0, prev.pagination.total - 1),
          },
        };
      });
    },
    [queryClient, queryKey],
  );

  // ---- Mutations -------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (formData: RedirectFormData) =>
      postApi<RedirectRow>('/api/redirects', {
        fromPath: formData.fromPath,
        toPath: formData.toPath,
        type: formData.type,
        isActive: formData.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
      setIsCreateOpen(false);
      setCreateForm(EMPTY_REDIRECT_FORM);
      toast.success(t('seo.redirectCreated'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('seo.redirectCreateFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: RedirectFormData }) =>
      patchApi<RedirectRow>(`/api/redirects/${id}`, {
        fromPath: formData.fromPath,
        toPath: formData.toPath,
        type: formData.type,
        isActive: formData.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
      setEditTarget(null);
      toast.success(t('seo.redirectUpdated'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('seo.redirectUpdateFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/redirects/${id}`),
    onSuccess: (_data, id) => {
      // Optimistically remove from current page's cache so the UI updates
      // instantly. The invalidation refetches in the background to reconcile
      // pagination/counts.
      removeCachedRow(id);
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
      setDeleteTarget(null);
      toast.success(t('seo.redirectDeleted'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('seo.redirectDeleteFailed'));
    },
  });

  // The toggle mutation uses an optimistic update with rollback. This is the
  // core of the "status toggle must actually work" requirement: the switch
  // flips immediately, the backend persists `isActive`, and on failure the
  // switch reverts to its previous position with a clear error toast.
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      patchApi<RedirectRow>(`/api/redirects/${id}`, { isActive: active }),
    onMutate: async ({ id, active }) => {
      setTogglingId(id);
      // Cancel outgoing refetches so they don't clobber the optimistic update.
      await queryClient.cancelQueries({ queryKey: queryKeys.redirects.all });
      // Snapshot the previous cache for rollback.
      const prev = queryClient.getQueryData<ListResponse>(queryKey);
      updateCachedRow(id, { active });
      return { prev };
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.active ? t('seo.redirectEnabled') : t('seo.redirectDisabled'),
      );
      // Refetch to pick up the server-side updatedAt + any hit-count changes.
      queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all });
    },
    onError: (err: Error, _vars, context) => {
      // Rollback to the snapshot so the switch visually reverts.
      if (context?.prev) {
        queryClient.setQueryData(queryKey, context.prev);
      }
      toast.error(err.message || t('seo.redirectStatusFailed'));
    },
    onSettled: () => {
      setTogglingId(null);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/redirects/bulk?action=export');
      if (!resp.ok) {
        let message = t('seo.exportFailed');
        try {
          const j = await resp.json();
          message = j?.error?.message ?? message;
        } catch {
          // ignore — non-JSON error
        }
        throw new Error(message);
      }
      const text = await resp.text();
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'redirects.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success(t('seo.redirectsExported')),
    onError: (err: Error) => toast.error(err.message || t('seo.exportFailed')),
  });

  const handleExport = useCallback(() => exportMutation.mutate(), [exportMutation]);

  // ---- Handlers --------------------------------------------------------

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
    const error = validateRedirectForm(createForm, false, t);
    if (error) {
      toast.error(error);
      return;
    }
    createMutation.mutate(createForm);
  }, [createForm, createMutation, t]);

  const handleUpdate = useCallback(() => {
    if (!editTarget) return;
    const error = validateRedirectForm(editForm, true, t);
    if (error) {
      toast.error(error);
      return;
    }
    updateMutation.mutate({ id: editTarget.id, formData: editForm });
  }, [editTarget, editForm, updateMutation, t]);

  const handleToggle = useCallback(
    (id: string, nextActive: boolean) => {
      toggleActiveMutation.mutate({ id, active: nextActive });
    },
    [toggleActiveMutation],
  );

  // ---- Empty states ----------------------------------------------------

  const hasFiltersOrSearch = !!(
    table.searchValue ||
    typeFilter !== 'all' ||
    statusFilter !== 'all'
  );

  const emptyState = useMemo(() => {
    if (hasFiltersOrSearch) {
      return (
        <EmptyState
          icon={Search}
          title={t('seo.noRedirectsFoundTitle')}
          description={t('seo.tryChangingSearch')}
        />
      );
    }
    return (
      <EmptyState
        icon={GitBranch}
        title={t('seo.noRedirectsConfigured')}
        description={t('seo.createFirstRedirectHint')}
        action={{
          label: t('seo.createRedirect'),
          onClick: () => {
            setCreateForm(EMPTY_REDIRECT_FORM);
            setIsCreateOpen(true);
          },
          icon: <Plus className="h-4 w-4" />,
        }}
      />
    );
  }, [hasFiltersOrSearch, t]);

  // ---- Columns ---------------------------------------------------------

  const columns = useMemo<ColumnDef<RedirectRow>[]>(
    () => [
      {
        id: 'fromPath',
        accessorKey: 'fromPath',
        enableSorting: true,
        size: 220,
        header: ({ column }) => <SortableHeader label={t('seo.fromPath')} column={column} />,
        cell: ({ row }) => <PathLink path={row.original.fromPath} />,
      },
      {
        id: 'toPath',
        accessorKey: 'toPath',
        enableSorting: true,
        size: 220,
        header: ({ column }) => <SortableHeader label={t('seo.toPath')} column={column} />,
        cell: ({ row }) => <PathLink path={row.original.toPath} />,
      },
      {
        id: 'type',
        accessorKey: 'type',
        enableSorting: true,
        size: 150,
        header: ({ column }) => <SortableHeader label={t('seo.type')} column={column} />,
        cell: ({ row }) => <RedirectTypeBadge type={row.original.type} />,
      },
      {
        id: 'hits',
        accessorKey: 'hits',
        enableSorting: true,
        size: 90,
        header: ({ column }) => (
          <SortableHeader label={t('seo.hits')} column={column} align="right" />
        ),
        cell: ({ row }) => (
          <span
            className="tabular-nums text-sm font-medium text-foreground/80 block text-right"
            title={`${row.original.hits.toLocaleString()} ${t('seo.totalHits')}`}
          >
            {row.original.hits.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        enableSorting: true,
        size: 120,
        header: ({ column }) => <SortableHeader label={t('seo.created')} column={column} />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground" title={row.original.createdAt}>
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        accessorKey: 'updatedAt',
        enableSorting: true,
        size: 120,
        header: ({ column }) => <SortableHeader label={t('seo.updated')} column={column} />,
        cell: ({ row }) => (
          <span
            className="text-sm text-muted-foreground"
            title={new Date(row.original.updatedAt).toLocaleString()}
          >
            {formatRelative(row.original.updatedAt, t)}
          </span>
        ),
      },
      {
        id: 'active',
        accessorKey: 'active',
        enableSorting: true,
        size: 150,
        header: ({ column }) => <SortableHeader label={t('common.status')} column={column} />,
        cell: ({ row }) => (
          <StatusToggleCell
            row={row.original}
            onToggle={handleToggle}
            isPending={togglingId === row.original.id}
          />
        ),
      },
      ColumnDefHelper.actionColumn<RedirectRow>({
        id: 'actions',
        size: 56,
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
                <span className="sr-only">{t('common.actions')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleOpenEdit(row)}>
                <Pencil className="h-4 w-4 mr-2" />
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteTarget(row)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ],
    [handleOpenEdit, handleToggle, togglingId, t],
  );

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {t('seo.redirectsLoadFailed')}
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
              {(error as Error)?.message || t('seo.tryAgainLater')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: queryKeys.redirects.all })
            }
          >
            <Loader2 className="h-3.5 w-3.5 mr-1.5" />
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Single controls row: search + filters on the left, action buttons on the right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: search input + type/status filters */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('seo.searchRedirects')}
              value={table.searchValue}
              onChange={(e) => {
                table.setSearchValue(e.target.value);
                table.setCurrentPage(1);
              }}
              className="pl-9 h-8"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v);
              table.setCurrentPage(1);
            }}
          >
            <SelectTrigger size="sm" className="w-[150px] text-xs">
              <SelectValue placeholder={t('seo.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('seo.allTypes')}</SelectItem>
              {REDIRECT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
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
            <SelectTrigger size="sm" className="w-[130px] text-xs">
              <SelectValue placeholder={t('seo.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('seo.allStatus')}</SelectItem>
              <SelectItem value="active">{t('common.active')}</SelectItem>
              <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Right: action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportMutation.isPending || totalItems === 0}
          >
            {exportMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {t('seo.exportCsv')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            {t('seo.importCsv')}
          </Button>
          <Button
            onClick={() => {
              setCreateForm(EMPTY_REDIRECT_FORM);
              setIsCreateOpen(true);
            }}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('seo.createRedirect')}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={redirects}
        isLoading={isLoading}
        totalItems={totalItems}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onPageSizeChange={(size) => table.setPageSize(size)}
        onSortChange={(field, order) => table.setSortField(field, order)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        getRowId={(row) => row.id}
        emptyMessage={t('seo.noRedirectsFound')}
        emptyState={emptyState}
      />

      {/* Create Dialog */}
      <RedirectFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        data={createForm}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
        title={t('seo.createRedirect')}
        description={t('seo.createRedirectDesc')}
        submitLabel={t('seo.createRedirect')}
      />

      {/* Edit Dialog */}
      <RedirectFormDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        data={editForm}
        onChange={setEditForm}
        onSubmit={handleUpdate}
        isPending={updateMutation.isPending}
        title={t('seo.editRedirect')}
        description={
          editTarget
            ? `${t('seo.updateRedirectPrefix')}${truncate(editTarget.fromPath, 40)}${t('seo.updateRedirectSuffix')}`
            : t('seo.updateRedirect')
        }
        submitLabel={t('common.saveChanges')}
        isEdit
      />

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('seo.deleteRedirect')}
        description={
          deleteTarget
            ? `${t('seo.deleteRedirectPrefix')}${truncate(deleteTarget.fromPath, 50)}${t('seo.deleteRedirectMid')}${truncate(deleteTarget.toPath, 50)}${t('seo.deleteRedirectSuffix')}`
            : undefined
        }
        confirmLabel={t('common.delete')}
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
