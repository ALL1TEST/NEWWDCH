'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Plus,
  Search,
  Pencil,
  Eye,
  Copy,
  Send,
  MoreHorizontal,
  Trash2,
  RotateCcw,
  Mail,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Cpu,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { ScrollArea } from '@/components/ui/scroll-area';

import { PageHeader, StatusBadge, ConfirmDialog, EmptyState } from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime, labelize } from '@/lib/utils';
import type {
  EmailTemplateStatus,
  EmailTemplateCategory,
  EmailProvider,
  PaginationMeta,
} from '@/shared/types';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, STATUS_COLORS } from '@/shared/constants';
import { useNavigationStore } from '@/lib/stores/navigation-store';

// -------------------- Types --------------------

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  category: EmailTemplateCategory;
  status: EmailTemplateStatus;
  provider: EmailProvider;
  language: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { versions: number };
}

interface TemplateListProps {
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
}

// -------------------- Category Tabs --------------------

const CATEGORIES: { value: EmailTemplateCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CUSTOMER_EMAILS', label: 'Customer Emails' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
  { value: 'NEWSLETTER', label: 'Newsletter' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'TRANSACTIONAL', label: 'Transactional' },
  { value: 'NOTIFICATIONS', label: 'Notifications' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'SYSTEM', label: 'System' },
];

// -------------------- Status Options --------------------

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ENABLED', label: 'Enabled' },
  { value: 'DISABLED', label: 'Disabled' },
  { value: 'DRAFT', label: 'Draft' },
] as const;

// -------------------- Sort Options --------------------

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest' },
  { value: 'createdAt:asc', label: 'Oldest' },
  { value: 'name:asc', label: 'A-Z' },
  { value: 'name:desc', label: 'Z-A' },
] as const;

// -------------------- Provider Options --------------------

const SEND_TEST_PROVIDERS: { value: EmailProvider; label: string }[] = [
  { value: 'SMTP', label: 'SMTP' },
  { value: 'SES', label: 'Amazon SES' },
  { value: 'RESEND', label: 'Resend' },
  { value: 'MAILGUN', label: 'Mailgun' },
  { value: 'SENDGRID', label: 'SendGrid' },
  { value: 'POSTMARK', label: 'Postmark' },
  { value: 'BREVO', label: 'Brevo' },
];

// -------------------- Status badge for DRAFT --------------------

const STATUS_KEY_MAP: Record<string, string> = {
  DRAFT: 'DRAFT_ET',
  ENABLED: 'ENABLED',
  DISABLED: 'DISABLED',
};

function getStatusColor(status: EmailTemplateStatus): string {
  return STATUS_COLORS[STATUS_KEY_MAP[status] ?? status] ?? '';
}

function getStatusLabel(status: EmailTemplateStatus): string {
  if (status === 'DRAFT') return 'Draft';
  return labelize(status);
}

// -------------------- Provider Badge Color --------------------

const PROVIDER_COLORS: Record<string, string> = {
  SMTP: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  SES: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  RESEND: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  MAILGUN: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400',
  SENDGRID: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
  POSTMARK: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  BREVO: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
  ELASTIC_EMAIL: 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
};

// -------------------- Send Test Dialog --------------------

function SendTestDialog({
  open,
  onOpenChange,
  templateId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string | null;
}) {
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<EmailProvider>('SMTP');

  const sendTestMutation = useMutation({
    mutationFn: () =>
      postApi(`/api/email-templates/${templateId}/send-test`, { email, provider }),
    onSuccess: () => {
      toast.success('Test email sent successfully');
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to send test email');
    },
  });

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) {
        setEmail('');
        setProvider('SMTP');
      }
      onOpenChange(v);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Test Email</DialogTitle>
          <DialogDescription>
            Send a test email to verify how this template renders.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="test-email">Recipient Email</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as EmailProvider)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {SEND_TEST_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={sendTestMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => sendTestMutation.mutate()}
            disabled={!email.trim() || sendTestMutation.isPending}
          >
            {sendTestMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Send Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Category Count Query --------------------

function useCategoryCounts() {
  return useQuery({
    queryKey: ['email-templates', 'category-counts'],
    queryFn: async () => {
      const allCategories = CATEGORIES.filter((c) => c.value !== 'ALL');
      const results = await Promise.allSettled(
        allCategories.map(async (cat) => {
          const res = await getApi<{ data: EmailTemplate[]; meta: { pagination: { total: number } } }>(
            '/api/email-templates',
            { category: cat.value, page: 1, pageSize: 1 },
            { raw: true },
          );
          return { category: cat.value, count: res?.meta?.pagination?.total ?? 0 };
        }),
      );
      const counts: Record<string, number> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          counts[r.value.category] = r.value.count;
        }
      }
      return counts;
    },
    staleTime: 30_000,
  });
}

// -------------------- Main Component --------------------

export function TemplateList({ onEdit, onPreview }: TemplateListProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigationStore((s) => s.navigate);

  // -------------------- Filter State --------------------
  const [category, setCategory] = useState<EmailTemplateCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortValue, setSortValue] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // -------------------- Dialog State --------------------
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [revertTarget, setRevertTarget] = useState<EmailTemplate | null>(null);
  const [sendTestTarget, setSendTestTarget] = useState<string | null>(null);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);

  // -------------------- Derived Sort Values --------------------
  const [sortField, sortOrder] = useMemo(() => {
    const [f, o] = sortValue.split(':');
    return [f, o as 'asc' | 'desc'];
  }, [sortValue]);

  // -------------------- Search Debounce --------------------
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const updateSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearch(value);
        setPage(1);
      }, 300);
    },
    [],
  );

  // -------------------- Filter Change Handlers --------------------
  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value as EmailTemplateCategory | 'ALL');
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortValue(value);
    setPage(1);
  }, []);

  // -------------------- Build Query Params --------------------
  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      sort: sortField,
      order: sortOrder,
      ...(category !== 'ALL' ? { category } : {}),
      ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      ...(search ? { search } : {}),
    }),
    [page, pageSize, sortField, sortOrder, category, statusFilter, search],
  );

  // -------------------- Data Fetching --------------------
  const { data: raw, isLoading } = useQuery({
    queryKey: queryKeys.emailTemplates.list(queryParams),
    queryFn: () =>
      getApi<{ data: EmailTemplate[]; meta: { pagination: { page: number; pageSize: number; total: number; totalPages: number } } }>('/api/email-templates', queryParams, { raw: true }),
    staleTime: 10_000,
  });

  const templates = (Array.isArray(raw?.data) ? raw.data : []) as EmailTemplate[];
  const pagination = raw?.meta?.pagination;

  // -------------------- Category Counts --------------------
  const { data: categoryCounts } = useCategoryCounts();
  const totalCount = categoryCounts
    ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
    : 0;

  // -------------------- Mutations --------------------
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/email-templates/${id}/duplicate`),
    onSuccess: () => {
      toast.success('Template duplicated successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to duplicate template');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EmailTemplateStatus }) =>
      patchApi(`/api/email-templates/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update template status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/email-templates/${id}`),
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete template');
    },
  });

  const revertMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/email-templates/${id}/revert`),
    onSuccess: () => {
      toast.success('Template reverted to default');
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      setRevertTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to revert template');
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => postApi<{ seeded: number; skipped: number; total: number }>('/api/email-templates/seed'),
    onSuccess: (res: any) => {
      const data = res?.data ?? res ?? { seeded: 0, skipped: 0, total: 0 };
      const { seeded, skipped } = data;
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      if (seeded > 0) {
        toast.success(`${seeded} default template${seeded > 1 ? 's' : ''} created${skipped > 0 ? `, ${skipped} already existed` : ''}`);
      } else if (skipped > 0) {
        toast.info('All default email templates are already available.');
      } else {
        toast.info('No default templates to seed.');
      }
      setSeedDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to seed templates');
    },
  });

  // -------------------- Navigation Handlers --------------------
  const handleCreate = useCallback(() => {
    navigate('email-templates', 'new');
  }, [navigate]);

  // -------------------- Render --------------------
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Email Templates"
        description="Manage email templates for all system notifications, newsletters, and transactional emails."
        action={
          <div className="flex flex-col items-end gap-2">
            <Button size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSeedDialogOpen(true)}
              disabled={seedMutation.isPending}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
            >
              {seedMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Cpu className="h-3.5 w-3.5 mr-1.5" />
              )}
              Seed Defaults
            </Button>
          </div>
        }
      />

      {/* Category Tabs */}
      <div className="border-b">
        <ScrollArea className="w-full">
          <div className="flex items-center gap-1 pb-px overflow-x-auto">
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.value;
              const count =
                cat.value === 'ALL'
                  ? totalCount
                  : (categoryCounts?.[cat.value] ?? 0);

              return (
                <button
                  key={cat.value}
                  onClick={() => handleCategoryChange(cat.value)}
                  className={cn(
                    'relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                  )}
                >
                  {cat.label}
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium leading-none',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchInput}
            onChange={(e) => updateSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortValue} onValueChange={handleSortChange}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="Newest" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-8 w-8 ml-auto" />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No templates found"
            description={
              search || statusFilter !== 'ALL' || category !== 'ALL'
                ? 'Try adjusting your filters to find what you\'re looking for.'
                : 'Create your first email template or seed the defaults to get started.'
            }
            action={
              !search && statusFilter === 'ALL' && category === 'ALL'
                ? {
                    label: 'Seed Default Templates',
                    onClick: () => seedMutation.mutate(),
                  }
                : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Template Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead className="pr-4 w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow
                    key={template.id}
                    className="cursor-pointer group"
                    onClick={() => onEdit(template.id)}
                  >
                    {/* Template Name */}
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate font-medium text-foreground">
                          {template.name}
                        </span>
                        {template.isSystem && (
                          <Badge
                            variant="outline"
                            className="shrink-0 px-1.5 py-0 text-[10px] font-medium text-muted-foreground border-dashed"
                          >
                            System
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell>
                      <StatusBadge
                        status={template.category}
                        size="sm"
                      />
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent font-medium shrink-0 px-2 py-0.5 text-xs',
                          getStatusColor(template.status),
                        )}
                      >
                        {getStatusLabel(template.status)}
                      </Badge>
                    </TableCell>

                    {/* Provider */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent shrink-0 px-2 py-0.5 text-xs font-medium',
                          PROVIDER_COLORS[template.provider] ??
                            'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
                        )}
                      >
                        {template.provider}
                      </Badge>
                    </TableCell>

                    {/* Last Updated */}
                    <TableCell className="text-muted-foreground text-sm">
                      {formatRelativeTime(template.updatedAt)}
                    </TableCell>

                    {/* Language */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="shrink-0 px-1.5 py-0 text-[10px] font-bold uppercase"
                      >
                        {template.language || 'EN'}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onEdit(template.id)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onPreview(template.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => duplicateMutation.mutate(template.id)}
                            disabled={duplicateMutation.isPending}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setSendTestTarget(template.id)}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Test
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: template.id,
                                status:
                                  template.status === 'ENABLED'
                                    ? 'DISABLED'
                                    : 'ENABLED',
                              })
                            }
                            disabled={toggleStatusMutation.isPending}
                          >
                            {template.status === 'ENABLED' ? (
                              <>
                                <span className="h-4 w-4 mr-2 inline-flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                                  <span className="h-2 w-2 rounded-full" />
                                </span>
                                Disable
                              </>
                            ) : (
                              <>
                                <span className="h-4 w-4 mr-2 inline-flex items-center justify-center rounded-full bg-emerald-200 dark:bg-emerald-800">
                                  <span className="h-2 w-2 rounded-full" />
                                </span>
                                Enable
                              </>
                            )}
                          </DropdownMenuItem>
                          {template.isSystem && (
                            <DropdownMenuItem
                              onClick={() => setRevertTarget(template)}
                              className="text-amber-600 dark:text-amber-400"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Revert to Default
                            </DropdownMenuItem>
                          )}
                          {!template.isSystem && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(template)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{pagination.total} total</span>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger size="sm" className="w-[80px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Send Test Dialog */}
      <SendTestDialog
        open={!!sendTestTarget}
        onOpenChange={(v) => !v && setSendTestTarget(null)}
        templateId={sendTestTarget}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete Template"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isLoading={deleteMutation.isPending}
      />

      {/* Revert Confirm Dialog */}
      <ConfirmDialog
        open={!!revertTarget}
        onOpenChange={(v) => !v && setRevertTarget(null)}
        title="Revert to Default"
        description={
          revertTarget
            ? `This will reset "${revertTarget.name}" to its original default content. Your current changes will be saved as a version before reverting.`
            : undefined
        }
        confirmLabel="Revert"
        onConfirm={() => {
          if (revertTarget) revertMutation.mutate(revertTarget.id);
        }}
        isLoading={revertMutation.isPending}
      />

      {/* Seed Defaults Confirm Dialog */}
      <ConfirmDialog
        open={seedDialogOpen}
        onOpenChange={setSeedDialogOpen}
        title="Seed Default Templates"
        description="This will add any missing default system email templates. Existing templates (including your custom ones) will not be modified."
        confirmLabel="Seed Defaults"
        onConfirm={() => seedMutation.mutate()}
        isLoading={seedMutation.isPending}
      />
    </div>
  );
}
