'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Mail,
  Server,
  Loader2,
  Star,
  ShieldCheck,
  Zap,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
  PageHeader,
  ConfirmDialog,
  EmptyState,
} from '@/components/patterns';

import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatRelativeTime, labelize } from '@/lib/utils';
import type { EmailProvider, PaginatedResponse } from '@/shared/types';
import { useT } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

interface SmtpSetting {
  id: string;
  name: string;
  provider: EmailProvider;
  host: string;
  port: number;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  isDefault: boolean;
  isActive: boolean;
  siteId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Provider Options
// ============================================================

const PROVIDER_OPTIONS: { value: EmailProvider; label: string; icon: React.ReactNode }[] = [
  { value: 'SMTP', label: 'SMTP', icon: <Server className="h-4 w-4" /> },
  { value: 'SES', label: 'Amazon SES', icon: <ShieldCheck className="h-4 w-4" /> },
  { value: 'RESEND', label: 'Resend', icon: <Zap className="h-4 w-4" /> },
  { value: 'MAILGUN', label: 'Mailgun', icon: <Globe className="h-4 w-4" /> },
  { value: 'SENDGRID', label: 'SendGrid', icon: <Mail className="h-4 w-4" /> },
  { value: 'POSTMARK', label: 'Postmark', icon: <Mail className="h-4 w-4" /> },
  { value: 'BREVO', label: 'Brevo', icon: <Mail className="h-4 w-4" /> },
  { value: 'ELASTIC_EMAIL', label: 'Elastic Email', icon: <Mail className="h-4 w-4" /> },
];

const API_BASED_PROVIDERS = new Set<EmailProvider>([
  'SES', 'RESEND', 'MAILGUN', 'SENDGRID', 'POSTMARK', 'BREVO', 'ELASTIC_EMAIL',
]);

// ============================================================
// Provider Badge Colors
// ============================================================

const PROVIDER_COLORS: Record<string, string> = {
  SMTP: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  SES: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  RESEND: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  MAILGUN: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  SENDGRID: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border-sky-200 dark:border-sky-800',
  POSTMARK: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400 border-teal-200 dark:border-teal-800',
  BREVO: 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400 border-pink-200 dark:border-pink-800',
  ELASTIC_EMAIL: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800',
};

function ProviderBadge({ provider }: { provider: EmailProvider }) {
  const opt = PROVIDER_OPTIONS.find((p) => p.value === provider);
  return (
    <Badge variant="outline" className={cn('font-medium gap-1.5', PROVIDER_COLORS[provider])}>
      {opt?.icon}
      {opt?.label ?? provider}
    </Badge>
  );
}

// ============================================================
// SES Region Options
// ============================================================

const SES_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
] as const;

// ============================================================
// Provider Dialog
// ============================================================

interface ProviderFormData {
  id?: string;
  name: string;
  provider: EmailProvider;
  host: string;
  port: number;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  isDefault: boolean;
  isActive: boolean;
  region: string;
}

const EMPTY_FORM: ProviderFormData = {
  name: '',
  provider: 'SMTP',
  host: '',
  port: 587,
  username: '',
  password: '',
  fromName: '',
  fromEmail: '',
  replyTo: '',
  isDefault: false,
  isActive: true,
  region: 'us-east-1',
};

function ProviderDialog({
  data,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ProviderFormData | null;
  onSubmit: (form: ProviderFormData) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<ProviderFormData>(() => data ?? EMPTY_FORM);
  const isApiProvider = API_BASED_PROVIDERS.has(form.provider);
  const { t } = useT();

  const update = (patch: Partial<ProviderFormData>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('emailTemplates.providerNameRequired'));
      return;
    }
    if (!isApiProvider && !form.host.trim()) {
      toast.error(t('emailTemplates.hostRequired'));
      return;
    }
    if (!form.fromEmail.trim()) {
      toast.error(t('emailTemplates.fromEmailRequired'));
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data ? t('emailTemplates.editProvider') : t('emailTemplates.addProvider')}</DialogTitle>
          <DialogDescription>
            {t('emailTemplates.providerDialogDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="provider-name">{t('common.name')}</Label>
            <Input
              id="provider-name"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder={t('emailTemplates.providerNamePlaceholder')}
            />
          </div>

          {/* Provider Select */}
          <div className="grid gap-2">
            <Label htmlFor="provider-type">{t('emailTemplates.provider')}</Label>
            <Select
              value={form.provider}
              onValueChange={(v) => update({ provider: v as EmailProvider })}
            >
              <SelectTrigger id="provider-type">
                <SelectValue placeholder={t('emailTemplates.selectProvider')} />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      {opt.icon}
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SMTP Fields (conditional) */}
          {!isApiProvider && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 grid gap-2">
                  <Label htmlFor="smtp-host">{t('emailTemplates.host')}</Label>
                  <Input
                    id="smtp-host"
                    value={form.host}
                    onChange={(e) => update({ host: e.target.value })}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtp-port">{t('smtp.port')}</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={form.port}
                    onChange={(e) => update({ port: parseInt(e.target.value) || 587 })}
                    placeholder="587"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp-username">{t('smtp.username')}</Label>
                <Input
                  id="smtp-username"
                  value={form.username}
                  onChange={(e) => update({ username: e.target.value })}
                  placeholder={t('emailTemplates.usernameOrApiKey')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp-password">{t('smtp.password')}</Label>
                <Input
                  id="smtp-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update({ password: e.target.value })}
                  placeholder={data ? t('emailTemplates.leaveBlankKeepCurrent') : t('emailTemplates.passwordOrSecret')}
                />
              </div>
            </>
          )}

          {/* API-based Fields (conditional) */}
          {isApiProvider && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="api-key">{t('emailTemplates.apiKey')}</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={form.password}
                  onChange={(e) => update({ password: e.target.value })}
                  placeholder={data ? t('emailTemplates.leaveBlankKeepCurrent') : t('emailTemplates.enterApiKey')}
                />
              </div>
              {form.provider === 'SES' && (
                <div className="grid gap-2">
                  <Label htmlFor="ses-region">{t('emailTemplates.awsRegion')}</Label>
                  <Select
                    value={form.region}
                    onValueChange={(v) => update({ region: v })}
                  >
                    <SelectTrigger id="ses-region">
                      <SelectValue placeholder={t('emailTemplates.selectRegion')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SES_REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Separator */}
          <div className="border-t pt-4 mt-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {t('emailTemplates.senderInformation')}
            </p>
          </div>

          {/* From Name + From Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="from-name">{t('smtp.fromName')}</Label>
              <Input
                id="from-name"
                value={form.fromName}
                onChange={(e) => update({ fromName: e.target.value })}
                placeholder={t('emailTemplates.fromNamePlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="from-email">{t('smtp.fromEmail')}</Label>
              <Input
                id="from-email"
                type="email"
                value={form.fromEmail}
                onChange={(e) => update({ fromEmail: e.target.value })}
                placeholder="noreply@travelblog.com"
              />
            </div>
          </div>

          {/* Reply-To */}
          <div className="grid gap-2">
            <Label htmlFor="reply-to">{t('emailTemplates.replyTo')}</Label>
            <Input
              id="reply-to"
              type="email"
              value={form.replyTo}
              onChange={(e) => update({ replyTo: e.target.value })}
              placeholder="support@travelblog.com (optional)"
            />
          </div>

          {/* Separator */}
          <div className="border-t pt-4 mt-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {t('title.settings')}
            </p>
          </div>

          {/* Is Default Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('emailTemplates.defaultProvider')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('emailTemplates.defaultProviderHint')}
              </p>
            </div>
            <Switch
              checked={form.isDefault}
              onCheckedChange={(checked) => update({ isDefault: checked })}
            />
          </div>

          {/* Is Active Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('common.active')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('emailTemplates.activeProviderHint')}
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => update({ isActive: checked })}
            />
          </div>

          {/* Footer */}
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {data ? t('common.saveChanges') : t('emailTemplates.addProvider')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// SMTP Settings Page
// ============================================================

export function SmtpSettingsPage() {
  const queryClient = useQueryClient();
  const { t } = useT();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProviderFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SmtpSetting | null>(null);

  // -------------------- Fetch --------------------

  const {
    data: response,
    isLoading,
    isError,
  } = useQuery<PaginatedResponse<SmtpSetting>>({
    queryKey: queryKeys.smtpSettings.list(),
    queryFn: () => getApi<PaginatedResponse<SmtpSetting>>('/api/smtp-settings', { pageSize: 100 }),
  });

  const settings = response?.data ?? [];

  // -------------------- Create/Update Mutation --------------------

  const upsertMutation = useMutation({
    mutationFn: async (form: ProviderFormData) => {
      if (form.id) {
        const payload: Record<string, unknown> = {
          name: form.name,
          provider: form.provider,
          host: form.host,
          port: form.port,
          username: form.username,
          fromName: form.fromName,
          fromEmail: form.fromEmail,
          replyTo: form.replyTo,
          isDefault: form.isDefault,
          isActive: form.isActive,
        };
        // Only send password if changed (non-empty)
        if (form.password) payload.password = form.password;
        return patchApi<SmtpSetting>(`/api/smtp-settings/${form.id}`, payload);
      }
      return postApi<SmtpSetting>('/api/smtp-settings', {
        name: form.name,
        provider: form.provider,
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
        fromName: form.fromName,
        fromEmail: form.fromEmail,
        replyTo: form.replyTo,
        isDefault: form.isDefault,
        isActive: form.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.smtpSettings.all });
      setDialogOpen(false);
      setEditingItem(null);
      toast.success(editingItem ? t('emailTemplates.providerUpdated') : t('emailTemplates.providerAdded'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('emailTemplates.saveProviderFailed'));
    },
  });

  // -------------------- Delete Mutation --------------------

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/smtp-settings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.smtpSettings.all });
      setDeleteTarget(null);
      toast.success(t('emailTemplates.providerDeleted'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('emailTemplates.deleteProviderFailed'));
    },
  });

  // -------------------- Handlers --------------------

  const handleOpenCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (setting: SmtpSetting) => {
    setEditingItem({
      id: setting.id,
      name: setting.name,
      provider: setting.provider,
      host: setting.host,
      port: setting.port,
      username: setting.username,
      password: '',
      fromName: setting.fromName,
      fromEmail: setting.fromEmail,
      replyTo: setting.replyTo,
      isDefault: setting.isDefault,
      isActive: setting.isActive,
      region: 'us-east-1',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (form: ProviderFormData) => {
    upsertMutation.mutate(form);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  // -------------------- Render --------------------

  return (
    <div className="space-y-6">
      {/* ==================== Page Header ==================== */}
      <PageHeader
        title={t('smtp.title')}
        description={t('emailTemplates.smtpDescription')}
        action={
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4" />
            {t('emailTemplates.addProvider')}
          </Button>
        }
      />

      {/* ==================== Content ==================== */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-muted-foreground">{t('emailTemplates.smtpLoadFailed')}</p>
        </div>
      ) : settings.length === 0 ? (
        <EmptyState
          icon={Server}
          title={t('emailTemplates.noProviders')}
          description={t('emailTemplates.noProvidersDesc')}
          action={{
            label: t('emailTemplates.addProvider'),
            onClick: handleOpenCreate,
            icon: <Plus className="h-4 w-4" />,
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settings.map((setting) => (
            <ProviderCard
              key={setting.id}
              setting={setting}
              onEdit={() => handleOpenEdit(setting)}
              onDelete={() => setDeleteTarget(setting)}
            />
          ))}
        </div>
      )}

      {/* ==================== Add/Edit Dialog ==================== */}
      <ProviderDialog
        key={editingItem?.id ?? 'create'}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        data={editingItem}
        onSubmit={handleSubmit}
        isLoading={upsertMutation.isPending}
      />

      {/* ==================== Delete Confirmation ==================== */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('emailTemplates.deleteProvider')}
        description={
          deleteTarget
            ? `${t('emailTemplates.deleteProviderConfirmPrefix')}${deleteTarget.name}${t('emailTemplates.deleteProviderConfirmSuffix')}`
            : ''
        }
        confirmLabel={t('common.delete')}
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ============================================================
// Provider Card
// ============================================================

function ProviderCard({
  setting,
  onEdit,
  onDelete,
}: {
  setting: SmtpSetting;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isApiProvider = API_BASED_PROVIDERS.has(setting.provider);
  const { t } = useT();

  return (
    <div
      className={cn(
        'relative group rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md',
        !setting.isActive && 'opacity-60',
      )}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-lg shrink-0',
              PROVIDER_COLORS[setting.provider]?.split(' ')[0] ?? 'bg-muted',
            )}
          >
            {PROVIDER_OPTIONS.find((p) => p.value === setting.provider)?.icon ?? (
              <Server className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {setting.name}
              </h3>
              {setting.isDefault && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 shrink-0">
                  <Star className="h-3 w-3" />
                  {t('emailTemplates.defaultBadge')}
                </Badge>
              )}
            </div>
            <ProviderBadge provider={setting.provider} />
          </div>
        </div>

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              {t('common.edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Card Body */}
      <div className="px-4 pb-4 space-y-2.5">
        {/* Host/Endpoint info */}
        {isApiProvider ? (
          <InfoRow label={t('emailTemplates.apiKey')}>
            <span className="font-mono text-xs">
              {setting.username
                ? `${setting.username.slice(0, 8)}${'•'.repeat(16)}`
                : '•'.repeat(24)}
            </span>
          </InfoRow>
        ) : (
          <InfoRow label={t('emailTemplates.host')}>
            <span className="font-mono text-xs truncate">
              {setting.host || '—'}
            </span>
            {setting.host && (
              <span className="text-muted-foreground">:{setting.port}</span>
            )}
          </InfoRow>
        )}

        {/* From Email */}
        {setting.fromEmail && (
          <InfoRow label={t('emailTemplates.fromLabel')}>
            <span className="text-xs text-muted-foreground truncate">
              {setting.fromName && `${setting.fromName} <`}{setting.fromEmail}{setting.fromName && '>'}
            </span>
          </InfoRow>
        )}

        {/* Status & Updated */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Badge
            variant="outline"
            className={cn(
              'font-medium border-transparent text-[10px] leading-4 px-1.5',
              setting.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
            )}
          >
            {setting.isActive ? t('common.active') : t('common.inactive')}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {t('emailTemplates.updated')} {formatRelativeTime(setting.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Info Row Helper
// ============================================================

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] font-medium text-muted-foreground w-12 shrink-0 pt-0.5">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-foreground">{children}</div>
    </div>
  );
}
