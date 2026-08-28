'use client';

// ============================================================
// PLATFORM EMAIL TEMPLATES — manage platform-level transactional
// email templates: welcome, payment, subscription, trial, invoice,
// account lifecycle. Mirrors the Client Email Templates page design
// system but adds the PLATFORM badge via PlatformPageHeader and
// queries system templates (siteId IS NULL) via ?scope=platform.
// REUSES the existing EmailTemplate Prisma model + /api/email-templates
// endpoints (the GET/POST routes were extended with a `scope=platform`
// query/body param guarded by requirePlatformAdmin). The per-id
// GET/PATCH/DELETE and duplicate/send-test/revert endpoints are
// scope-agnostic, so they work as-is.
// ============================================================

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
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { cn, formatRelativeTime, labelize } from '@/lib/utils';
import type {
  EmailTemplateStatus,
  EmailTemplateCategory,
  EmailProvider,
} from '@/shared/types';
import { STATUS_COLORS } from '@/shared/constants';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  PlatformPageHeader,
  ErrorState,
} from '@/modules/platform/shared';

// -------------------- Types --------------------

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  htmlBody: string;
  defaultBody?: string | null;
  category: EmailTemplateCategory;
  status: EmailTemplateStatus;
  provider: EmailProvider;
  language: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { versions: number };
}

interface ListResponse {
  data: EmailTemplate[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

interface TemplateDetail extends EmailTemplate {
  previewText: string | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
}

// -------------------- Category filter options --------------------

const CATEGORY_OPTIONS: { value: EmailTemplateCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'CUSTOMER_EMAILS', label: 'Customer Emails' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
  { value: 'NEWSLETTER', label: 'Newsletter' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'TRANSACTIONAL', label: 'Transactional' },
  { value: 'NOTIFICATIONS', label: 'Notifications' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'SYSTEM', label: 'System' },
];

// -------------------- Status filter options --------------------

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ENABLED', label: 'Enabled' },
  { value: 'DISABLED', label: 'Disabled' },
  { value: 'DRAFT', label: 'Draft' },
] as const;

// -------------------- Provider options --------------------

const SEND_TEST_PROVIDERS: { value: EmailProvider; label: string }[] = [
  { value: 'SMTP', label: 'SMTP' },
  { value: 'SES', label: 'Amazon SES' },
  { value: 'RESEND', label: 'Resend' },
  { value: 'MAILGUN', label: 'Mailgun' },
  { value: 'SENDGRID', label: 'SendGrid' },
  { value: 'POSTMARK', label: 'Postmark' },
  { value: 'BREVO', label: 'Brevo' },
];

const CATEGORY_CREATE_OPTIONS = CATEGORY_OPTIONS.filter(
  (c) => c.value !== 'ALL',
) as { value: EmailTemplateCategory; label: string }[];

const STATUS_CREATE_OPTIONS = [
  { value: 'ENABLED', label: 'Enabled' },
  { value: 'DISABLED', label: 'Disabled' },
  { value: 'DRAFT', label: 'Draft' },
] as const;

// -------------------- Status badge styling --------------------

const STATUS_KEY_MAP: Record<string, string> = {
  DRAFT: 'DRAFT_ET',
  ENABLED: 'ENABLED_ET',
  DISABLED: 'DISABLED_ET',
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

// -------------------- Create Template Dialog --------------------

interface CreateForm {
  name: string;
  slug: string;
  subject: string;
  category: EmailTemplateCategory;
  status: EmailTemplateStatus;
  language: string;
}

function CreateTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateForm>({
    name: '',
    slug: '',
    subject: '',
    category: 'SYSTEM',
    status: 'DRAFT',
    language: 'en',
  });

  const reset = useCallback(() => {
    setForm({
      name: '',
      slug: '',
      subject: '',
      category: 'SYSTEM',
      status: 'DRAFT',
      language: 'en',
    });
  }, []);

  const createMutation = useMutation({
    mutationFn: () =>
      postApi('/api/email-templates', {
        scope: 'platform',
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        subject: form.subject.trim(),
        htmlBody: '',
        language: form.language.trim() || 'en',
        category: form.category,
        status: form.status,
      } as Record<string, unknown>),
    onSuccess: () => {
      toast.success('Platform template created');
      queryClient.invalidateQueries({ queryKey: ['platform-email-templates'] });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create template');
    },
  });

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset],
  );

  const canSubmit = form.name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Platform Template</DialogTitle>
          <DialogDescription>
            Create a new system-level email template. It will be visible to all sites.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              placeholder="e.g. Welcome Email"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-slug">Slug (optional)</Label>
            <Input
              id="tpl-slug"
              placeholder="auto-generated from name"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-subject">Subject</Label>
            <Input
              id="tpl-subject"
              placeholder="Welcome to {{site.name}}"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v as EmailTemplateCategory }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_CREATE_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as EmailTemplateStatus }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_CREATE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-lang">Language</Label>
            <Input
              id="tpl-lang"
              placeholder="en"
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Edit Template Dialog --------------------

interface EditForm {
  name: string;
  subject: string;
  htmlBody: string;
  category: EmailTemplateCategory;
  status: EmailTemplateStatus;
}

function EditTemplateDialog({
  open,
  onOpenChange,
  templateId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditForm>({
    name: '',
    subject: '',
    htmlBody: '',
    category: 'SYSTEM',
    status: 'DRAFT',
  });
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Fetch full template (incl. htmlBody) when an edit is opened.
  const { data, isFetching } = useQuery({
    queryKey: ['platform-email-templates', 'detail', templateId],
    queryFn: () =>
      getApi<{ data: TemplateDetail }>(
        `/api/email-templates/${templateId}`,
        undefined,
        { raw: true },
      ).then((r) => r?.data ?? null),
    enabled: !!templateId && open,
    staleTime: 0,
  });

  // Populate the form once the requested template arrives.
  React.useEffect(() => {
    if (!open || !templateId) return;
    if (loadedId === templateId) return;
    if (!data) return;
    setForm({
      name: data.name ?? '',
      subject: data.subject ?? '',
      htmlBody: data.htmlBody ?? '',
      category: data.category ?? 'SYSTEM',
      status: data.status ?? 'DRAFT',
    });
    setLoadedId(templateId);
  }, [open, templateId, loadedId, data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      patchApi(`/api/email-templates/${templateId}`, {
        name: form.name.trim(),
        subject: form.subject.trim(),
        htmlBody: form.htmlBody,
        category: form.category,
        status: form.status,
      }),
    onSuccess: () => {
      toast.success('Template updated');
      queryClient.invalidateQueries({ queryKey: ['platform-email-templates'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update template');
    },
  });

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) {
        setLoadedId(null);
      }
      onOpenChange(v);
    },
    [onOpenChange],
  );

  const canSubmit = form.name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
          <DialogDescription>
            Update the template&apos;s content and metadata. Changes are saved as a version snapshot.
          </DialogDescription>
        </DialogHeader>
        {isFetching && !loadedId ? (
          <div className="py-6 space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-subject">Subject</Label>
                <Input
                  id="edit-subject"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-html">HTML Body</Label>
                <Textarea
                  id="edit-html"
                  rows={10}
                  className="font-mono text-xs"
                  value={form.htmlBody}
                  onChange={(e) => setForm((f) => ({ ...f, htmlBody: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, category: v as EmailTemplateCategory }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_CREATE_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, status: v as EmailTemplateStatus }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_CREATE_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={!canSubmit || updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Preview Template Dialog --------------------

function PreviewTemplateDialog({
  open,
  onOpenChange,
  templateId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-email-templates', 'preview', templateId],
    queryFn: () =>
      getApi<{ data: TemplateDetail }>(
        `/api/email-templates/${templateId}`,
        undefined,
        { raw: true },
      ).then((r) => r?.data ?? null),
    enabled: !!templateId && open,
    staleTime: 30_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preview Template</DialogTitle>
          <DialogDescription>
            {data ? `Subject: ${data.subject || '—'}` : 'Loading template…'}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-background overflow-hidden">
          {isLoading || !data ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          ) : (
            <iframe
              title="template-preview"
              srcDoc={data.htmlBody || ''}
              className="w-full h-[55vh] bg-white"
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      setEmail('');
      setProvider('SMTP');
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

// -------------------- Main Component --------------------

export function PlatformEmailTemplatesModule() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  // -------------------- Filter State --------------------
  const [category, setCategory] = useState<EmailTemplateCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // -------------------- Dialog State --------------------
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<string | null>(null);
  const [sendTestTarget, setSendTestTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [revertTarget, setRevertTarget] = useState<EmailTemplate | null>(null);

  // -------------------- Search debounce --------------------
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const updateSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearch(value);
      }, 300);
    },
    [],
  );

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value as EmailTemplateCategory | 'ALL');
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
  }, []);

  // -------------------- Build query params --------------------
  const queryParams = useMemo(
    () => ({
      scope: 'platform',
      pageSize: 50,
      ...(category !== 'ALL' ? { category } : {}),
      ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      ...(search ? { search } : {}),
    }),
    [category, statusFilter, search],
  );

  // -------------------- Data fetching --------------------
  const { data: raw, isLoading, isError, refetch } = useQuery({
    queryKey: ['platform-email-templates', queryParams],
    queryFn: () =>
      getApi<ListResponse>('/api/email-templates', queryParams, { raw: true }),
    staleTime: 10_000,
  });

  const templates = (Array.isArray(raw?.data) ? raw.data : []) as EmailTemplate[];

  // -------------------- Mutations --------------------
  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      postApi(`/api/email-templates/${id}/duplicate`, {
        ...(currentUserId ? { createdById: currentUserId } : {}),
      }),
    onSuccess: () => {
      toast.success('Template duplicated');
      queryClient.invalidateQueries({ queryKey: ['platform-email-templates'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to duplicate template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/email-templates/${id}`),
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['platform-email-templates'] });
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
      queryClient.invalidateQueries({ queryKey: ['platform-email-templates'] });
      setRevertTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to revert template');
    },
  });

  // -------------------- Render --------------------
  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Email Templates"
        subtitle="Platform-level transactional email templates: welcome, payment, subscription, trial, invoice, account lifecycle."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        }
      />

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
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-8 ml-auto" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="py-6">
            <ErrorState
              message="Unable to load platform templates. Make sure you are signed in as a platform admin."
              onRetry={() => refetch()}
            />
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No email templates yet"
            description="Create your first platform template, or seed defaults from the Email Templates module."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="pr-4 w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow
                  key={template.id}
                  className="cursor-pointer group"
                  onClick={() => setEditTarget(template.id)}
                >
                  {/* Name */}
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

                  {/* Subject */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground line-clamp-1 max-w-[220px]">
                      {template.subject || '—'}
                    </span>
                  </TableCell>

                  {/* Category */}
                  <TableCell>
                    <StatusBadge status={template.category} size="sm" />
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

                  {/* Language */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="shrink-0 px-1.5 py-0 text-[10px] font-bold uppercase"
                    >
                      {template.language || 'EN'}
                    </Badge>
                  </TableCell>

                  {/* Updated */}
                  <TableCell className="text-muted-foreground text-sm">
                    {formatRelativeTime(template.updatedAt)}
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
                        <DropdownMenuItem onClick={() => setEditTarget(template.id)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPreviewTarget(template.id)}>
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
                        <DropdownMenuItem onClick={() => setSendTestTarget(template.id)}>
                          <Send className="h-4 w-4 mr-2" />
                          Send Test
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(template)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Template Dialog */}
      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit Template Dialog */}
      <EditTemplateDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        templateId={editTarget}
      />

      {/* Preview Template Dialog */}
      <PreviewTemplateDialog
        open={!!previewTarget}
        onOpenChange={(v) => !v && setPreviewTarget(null)}
        templateId={previewTarget}
      />

      {/* Send Test Dialog */}
      <SendTestDialog
        open={!!sendTestTarget}
        onOpenChange={(v) => !v && setSendTestTarget(null)}
        templateId={sendTestTarget}
      />

      {/* Delete Confirm */}
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

      {/* Revert Confirm */}
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
    </div>
  );
}
