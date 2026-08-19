'use client';

// Webhooks Module - manage webhook endpoints
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Eye,
  Zap,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DataTable,
  useDataTable,
  ColumnDefHelper,
  PageHeader,
  ConfirmDialog,
  StatusBadge,
} from '@/components/patterns';

import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { PaginatedResponse, WebhookDeliveryStatus } from '@/shared/types';
import type { ColumnDef } from '@tanstack/react-table';

// -------------------- Types ------------------------

interface Webhook {
  id: string;
  name: string;
  url: string;
  hasSecret: boolean;
  events: string[];
  isActive: boolean;
  lastDeliveryAt?: string;
  lastError?: string | null;
  lastStatusCode?: number | null;
  successCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
  site?: { id: string; name: string } | null;
  siteId?: string | null;
  _count?: { deliveries: number };
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  webhookName: string;
  event: string;
  status: WebhookDeliveryStatus;
  statusCode: number | null;
  response: string | null;
  attempts: number;
  maxRetries: number;
  duration: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

// -------------------- Event Types -------------------

const EVENT_TYPES = [
  'content.created',
  'content.updated',
  'content.deleted',
  'media.uploaded',
  'user.created',
  'comment.created',
  'form.submitted',
] as const;

// -------------------- Validation ---------------------

interface FormErrors {
  name?: string;
  url?: string;
  secret?: string;
  events?: string;
}

function validateForm(form: WebhookFormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  else if (form.name.trim().length > 200) errors.name = 'Name must be 200 characters or less';

  if (!form.url.trim()) errors.url = 'URL is required';
  else {
    try {
      const u = new URL(form.url.trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        errors.url = 'URL must be HTTP or HTTPS';
      }
    } catch {
      errors.url = 'Must be a valid URL (e.g. https://example.com/webhook)';
    }
  }

  if (!form.isEdit && !form.secret.trim()) {
    errors.secret = 'Secret is required for new webhooks';
  }

  if (form.events.length === 0) errors.events = 'At least one event must be selected';

  return errors;
}

// -------------------- Form Data --------------------

interface WebhookFormData {
  id?: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  isEdit?: boolean;
}

// -------------------- Webhook Dialog -----------------

function WebhookDialog({
  open,
  onOpenChange,
  data,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: WebhookFormData | null;
  onSubmit: (data: WebhookFormData) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<WebhookFormData>(
    data ?? { name: '', url: '', secret: '', events: [], isActive: true },
  );
  const [errors, setErrors] = useState<FormErrors>({});

  React.useEffect(() => {
    if (open) {
      setForm(data ?? { name: '', url: '', secret: '', events: [], isActive: true, isEdit: false });
      setErrors({});
    }
  }, [open, data]);

  const update = (patch: Partial<WebhookFormData>) =>
    setForm((p) => ({ ...p, ...patch }));

  const toggleEvent = (event: string) => {
    setForm((p) => ({
      ...p,
      events: p.events.includes(event)
        ? p.events.filter((e) => e !== event)
        : [...p.events, event],
    }));
  };

  const handleSubmit = () => {
    const formWithEdit = { ...form, isEdit: !!data?.id };
    const validationErrors = validateForm(formWithEdit);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(formWithEdit);
  };

  const isEdit = !!data?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update webhook configuration. Leave secret blank to keep the existing one.'
              : 'Configure a webhook endpoint to receive real-time event notifications.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Content Published Hook"
              className={cn(errors.name && 'border-red-500')}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          {/* URL */}
          <div className="grid gap-2">
            <Label htmlFor="webhook-url">URL</Label>
            <Input
              id="webhook-url"
              value={form.url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://webhook.site/your-unique-id"
              className={cn(errors.url && 'border-red-500')}
            />
            {errors.url && <p className="text-sm text-red-500">{errors.url}</p>}
          </div>

          {/* Secret */}
          <div className="grid gap-2">
            <Label htmlFor="webhook-secret">
              Secret
              {isEdit && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  Leave blank to keep current
                </span>
              )}
            </Label>
            <Input
              id="webhook-secret"
              type="password"
              value={form.secret}
              onChange={(e) => update({ secret: e.target.value })}
              placeholder={isEdit ? '••••••••••••' : 'whsec_...'}
              className={cn(errors.secret && 'border-red-500')}
            />
            {errors.secret && <p className="text-sm text-red-500">{errors.secret}</p>}
          </div>

          {/* Events */}
          <div className="grid gap-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map((event) => (
                <label
                  key={event}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors',
                    errors.events && form.events.length === 0 && 'border-red-500',
                  )}
                >
                  <Checkbox
                    checked={form.events.includes(event)}
                    onCheckedChange={() => toggleEvent(event)}
                  />
                  <span className="text-sm font-mono">{event}</span>
                </label>
              ))}
            </div>
            {errors.events && <p className="text-sm text-red-500">{errors.events}</p>}
          </div>

          {/* Active */}
          <div className="flex items-center justify-between">
            <Label htmlFor="webhook-active">Active</Label>
            <Switch
              id="webhook-active"
              checked={form.isActive}
              onCheckedChange={(v) => update({ isActive: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Delivery Detail Dialog -----

function DeliveryDetailDialog({
  delivery,
  open,
  onOpenChange,
}: {
  delivery: WebhookDelivery | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!delivery) return null;

  let parsedResponse: unknown = null;
  if (delivery.response) {
    try { parsedResponse = JSON.parse(delivery.response); } catch { /* keep as string */ }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Delivery Detail</DialogTitle>
          <DialogDescription>
            {delivery.event} — {formatRelativeTime(delivery.createdAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Status & Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <StatusBadge status={delivery.status} size="md" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status Code</p>
              <p className="text-sm font-mono">
                {delivery.statusCode ?? 'N/A'}
              </p>
            </div>
          </div>

          {/* Attempts & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Attempts</p>
              <p className="text-sm">{delivery.attempts} / {delivery.maxRetries}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-sm">{delivery.duration != null ? `${delivery.duration}ms` : 'N/A'}</p>
            </div>
          </div>

          {/* Error */}
          {delivery.errorMessage && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Error</p>
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded p-2 font-mono text-xs">
                {delivery.errorMessage}
              </p>
            </div>
          )}

          {/* Response */}
          {delivery.response && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Response Body</p>
              <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
                {typeof parsedResponse === 'object'
                  ? JSON.stringify(parsedResponse, null, 2)
                  : delivery.response}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Deliveries Sub-View ----------

function DeliveriesSubview({ webhookId, onBack }: { webhookId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [detailDelivery, setDetailDelivery] = useState<WebhookDelivery | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.webhookDeliveries.list(webhookId, { page, pageSize: 20 }),
    queryFn: () =>
      getApi<PaginatedResponse<WebhookDelivery>>('/api/webhook-deliveries', { webhookId, page, pageSize: 20 }, { raw: true }),
    staleTime: 5_000,
  });

  const deliveries = data?.data ?? [];
  const pagination = data?.pagination;

  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) =>
      postApi(`/api/webhook-deliveries/${deliveryId}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhookDeliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
      toast({ title: 'Delivery retry initiated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Retry failed', description: err.message, variant: 'destructive' });
    },
  });

  const columns = useMemo<ColumnDef<WebhookDelivery>[]>(
    () => [
      ColumnDefHelper.dateColumn<WebhookDelivery>({
        id: 'createdAt',
        header: 'Timestamp',
        accessorKey: 'createdAt',
        format: (d) => formatRelativeTime(d),
      }),
      {
        id: 'event',
        header: 'Event',
        accessorKey: 'event',
        enableSorting: false,
        cell: ({ getValue }) => (
          <Badge variant="secondary" className="text-xs font-mono">
            {getValue() as string}
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        enableSorting: false,
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} size="sm" />,
      },
      ColumnDefHelper.textColumn<WebhookDelivery>({
        id: 'statusCode',
        header: 'Code',
        accessorKey: 'statusCode',
        enableSorting: false,
        className: 'tabular-nums',
        cell: ({ getValue }) => {
          const code = getValue() as number | null;
          if (!code) return <span className="text-muted-foreground">—</span>;
          const color = code >= 200 && code < 300 ? 'text-green-600' : 'text-red-600';
          return <span className={cn('font-mono', color)}>{code}</span>;
        },
      }),
      ColumnDefHelper.textColumn<WebhookDelivery>({
        id: 'duration',
        header: 'Duration',
        accessorKey: 'duration',
        enableSorting: false,
        className: 'tabular-nums',
        cell: ({ getValue }) => {
          const d = getValue() as number | null;
          return <span>{d != null ? `${d}ms` : '—'}</span>;
        },
      }),
      {
        id: 'attempts',
        header: 'Attempts',
        accessorKey: 'attempts',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.attempts}/{row.original.maxRetries}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        size: 80,
        cell: ({ row }) => {
          const d = row.original;
          const canRetry = d.status === 'FAILED' && d.attempts < d.maxRetries;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); setDetailDelivery(d); }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {canRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={retryMutation.isPending}
                  onClick={(e) => { e.stopPropagation(); retryMutation.mutate(d.id); }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [retryMutation.isPending],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Webhooks
        </Button>
        <h2 className="text-lg font-semibold">Delivery Log</h2>
      </div>

      <DataTable
        columns={columns}
        data={deliveries}
        isLoading={isLoading}
        totalItems={pagination?.total ?? 0}
        pageSize={20}
        currentPage={page}
        onPageChange={setPage}
        onSortChange={() => {}}
        getRowId={(row) => row.id}
        emptyMessage="No deliveries recorded yet. Create a webhook and test it."
      />

      <DeliveryDetailDialog
        delivery={detailDelivery}
        open={!!detailDelivery}
        onOpenChange={(v) => !v && setDetailDelivery(null)}
      />
    </div>
  );
}

// -------------------- Events Badge Group ----------

function EventsBadgeGroup({ events }: { events: string[] }) {
  const maxShow = 2;
  const shown = events.slice(0, maxShow);
  const remaining = events.length - maxShow;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map((ev) => (
        <Badge key={ev} variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
          {ev.split('.')[1]}
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

// -------------------- Status Icon -------------------

function DeliveryStatusIcon({ webhook }: { webhook: Webhook }) {
  if (webhook.lastError) return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  if (webhook.lastStatusCode && webhook.lastStatusCode >= 200 && webhook.lastStatusCode < 300) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  }
  if (webhook.lastDeliveryAt) return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

// -------------------- Main Component ---------------

export function WebhooksPage() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; data: WebhookFormData | null }>({ open: false, data: null });
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [deliveryWebhookId, setDeliveryWebhookId] = useState<string | null>(null);

  const table = useDataTable({ initialSortField: 'createdAt', initialSortOrder: 'desc' });

  // -------------------- Queries --------------------

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.webhooks.list({
      page: table.currentPage, pageSize: table.pageSize, sort: table.sortField, order: table.sortOrder,
    }),
    queryFn: () =>
      getApi<PaginatedResponse<Webhook>>('/api/webhooks', {
        page: table.currentPage,
        pageSize: table.pageSize,
        sort: table.sortField,
        order: table.sortOrder,
        search: table.searchValue || undefined,
      }, { raw: true }),
    staleTime: 5_000,
  });

  const webhooks = data?.data ?? [];
  const pagination = data?.pagination;

  // -------------------- Mutations ------------------

  const createMutation = useMutation({
    mutationFn: (body: WebhookFormData) => {
      const payload = {
        name: body.name.trim(),
        url: body.url.trim(),
        secret: body.secret || undefined,
        events: body.events,
        isActive: body.isActive,
      };
      if (body.id) {
        // For edit, only send fields that changed
        const updatePayload: Record<string, unknown> = { ...payload };
        if (!body.secret) delete updatePayload.secret; // Don't overwrite with empty
        return patchApi(`/api/webhooks/${body.id}`, updatePayload);
      }
      return postApi('/api/webhooks', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
      setDialog({ open: false, data: null });
      toast({ title: dialog.data?.id ? 'Webhook updated' : 'Webhook created successfully' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save webhook';
      toast({ title: 'Failed to save webhook', description: msg, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
      setDeleteTarget(null);
      toast({ title: 'Webhook deleted' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete webhook';
      toast({ title: 'Failed to delete webhook', description: msg, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      patchApi(`/api/webhooks/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to toggle webhook';
      toast({ title: 'Failed to toggle webhook', description: msg, variant: 'destructive' });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/webhooks/${id}/test`),
    onSuccess: (result: unknown) => {
      const r = result as { success: boolean; message: string; statusCode?: number; duration?: number };
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.webhookDeliveries.all });
      if (r.success) {
        toast({
          title: 'Test webhook sent successfully',
          description: r.statusCode ? `Status ${r.statusCode} in ${r.duration}ms` : undefined,
        });
      } else {
        toast({
          title: 'Webhook test failed',
          description: r.message || 'The endpoint returned an error',
          variant: 'destructive',
        });
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Test failed';
      toast({ title: 'Webhook test failed', description: msg, variant: 'destructive' });
    },
  });

  // -------------------- Columns --------------------

  const columns: ColumnDef<Webhook>[] = [
    ColumnDefHelper.textColumn<Webhook>({
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      className: 'font-medium',
    }),
    ColumnDefHelper.textColumn<Webhook>({
      id: 'url',
      header: 'URL',
      accessorKey: 'url',
      truncate: 40,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{row.original.url}</span>
          <a
            href={row.original.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ),
    }),
    {
      id: 'events',
      header: 'Events',
      accessorFn: (row) => (Array.isArray(row.events) ? row.events.join(',') : String(row.events)),
      enableSorting: false,
      cell: ({ row }) => <EventsBadgeGroup events={Array.isArray(row.original.events) ? row.original.events : []} />,
    },
    {
      id: 'isActive',
      header: 'Active',
      accessorKey: 'isActive',
      enableSorting: false,
      cell: ({ row }) => (
        <Switch
          checked={row.original.isActive}
          onCheckedChange={(v) => toggleMutation.mutate({ id: row.original.id, isActive: v })}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      id: 'lastDelivery',
      header: 'Last Delivery',
      enableSorting: false,
      cell: ({ row }) => {
        const w = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <DeliveryStatusIcon webhook={w} />
            <span className="text-sm">
              {w.lastDeliveryAt ? formatRelativeTime(w.lastDeliveryAt) : '—'}
            </span>
          </div>
        );
      },
    },
    {
      id: 'deliveryCount',
      header: 'Deliveries',
      enableSorting: false,
      cell: ({ row }) => {
        const w = row.original;
        const total = (w._count?.deliveries ?? 0) || w.successCount + w.failureCount;
        return (
          <div className="flex items-center gap-2 text-sm">
            <span className="tabular-nums">{total}</span>
            {total > 0 && (
              <span className="text-xs text-muted-foreground">
                <span className="text-green-600">{w.successCount}</span>
                {'/'}
                <span className="text-red-600">{w.failureCount}</span>
              </span>
            )}
          </div>
        );
      },
    },
    ColumnDefHelper.actionColumn<Webhook>({
      id: 'actions',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                setDialog({
                  open: true,
                  data: {
                    id: row.id,
                    name: row.name,
                    url: row.url,
                    secret: '', // Don't expose existing secret
                    events: Array.isArray(row.events) ? row.events : [],
                    isActive: row.isActive,
                    isEdit: true,
                  },
                })
              }
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => testMutation.mutate(row.id)}
              disabled={testMutation.isPending}
            >
              <Zap className="h-4 w-4 mr-2" />
              Test
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeliveryWebhookId(row.id)}>
              <Eye className="h-4 w-4 mr-2" />
              View Deliveries
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
  ];

  // -------------------- Render --------------------

  if (deliveryWebhookId) {
    return (
      <DeliveriesSubview
        webhookId={deliveryWebhookId}
        onBack={() => setDeliveryWebhookId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Webhooks"
        description="Manage webhook endpoints for real-time event notifications"
        action={
          <Button
            size="sm"
            onClick={() => setDialog({ open: true, data: null })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Webhook
          </Button>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Webhooks</p>
          <p className="text-2xl font-bold">{webhooks.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {webhooks.filter((w) => w.isActive).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Successful Deliveries</p>
          <p className="text-2xl font-bold text-green-600">
            {webhooks.reduce((sum, w) => sum + w.successCount, 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Failed Deliveries</p>
          <p className="text-2xl font-bold text-red-600">
            {webhooks.reduce((sum, w) => sum + w.failureCount, 0)}
          </p>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={webhooks}
        isLoading={isLoading}
        totalItems={pagination?.total ?? 0}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        searchPlaceholder="Search webhooks..."
        searchValue={table.searchValue}
        onSearch={(v) => {
          table.setSearchValue(v);
          table.setCurrentPage(1);
        }}
        getRowId={(row) => row.id}
        emptyMessage={'No webhooks configured. Click "Create Webhook" to add one.'}
      />

      {/* Create/Edit Dialog */}
      <WebhookDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((p) => ({ ...p, open: v }))}
        data={dialog.data}
        onSubmit={(d) => createMutation.mutate(d)}
        isLoading={createMutation.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete Webhook"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? Future events will no longer be delivered to this endpoint. This cannot be undone.`
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
