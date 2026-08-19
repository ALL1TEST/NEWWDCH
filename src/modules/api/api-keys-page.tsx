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
  RefreshCw,
  Ban,
  Shield,
  Loader2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
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
import { STATUS_COLORS } from '@/shared/constants';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toast } from 'sonner';
import type {
  ApiKeyStatus,
  ApiKeyType,
  ApiKeyEnvironment,
  ApiKeySiteAccess,
  PaginationMeta,
} from '@/shared/types';

// -------------------- Types --------------------

interface ApiKeyRow {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  type: ApiKeyType;
  status: ApiKeyStatus;
  environment: ApiKeyEnvironment;
  scopes: string;
  userId: string;
  siteId: string | null;
  siteAccess: ApiKeySiteAccess;
  allowedSiteIds: string | null;
  allowedIps: string | null;
  allowedDomains: string | null;
  allowedOrigins: string | null;
  rateLimitPerMin: number;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  totalRequests: number;
  totalErrors: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; avatar: string | null };
  site: { id: string; name: string; slug: string } | null;
  _count: { apiLogs: number };
}

interface CreateForm {
  name: string;
  description: string;
  type: ApiKeyType;
  environment: ApiKeyEnvironment;
  scopes: string[];
  expiration: string;
  rateLimitPerMin: string;
  rateLimitPerHour: string;
  rateLimitPerDay: string;
  allowedIps: string;
  allowedDomains: string;
  allowedOrigins: string;
  siteAccess: ApiKeySiteAccess;
}

interface EditForm extends CreateForm {
  id: string;
}

const DEFAULT_CREATE_FORM: CreateForm = {
  name: '',
  description: '',
  type: 'LIVE',
  environment: 'DEVELOPMENT',
  scopes: [],
  expiration: '30d',
  rateLimitPerMin: '100',
  rateLimitPerHour: '1000',
  rateLimitPerDay: '10000',
  allowedIps: '',
  allowedDomains: '',
  allowedOrigins: '',
  siteAccess: 'CURRENT',
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

function parseStringList(str: string | null | undefined): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringListToText(arr: string[]): string {
  return arr.join('\n');
}

function textToStringList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// -------------------- Status Badge --------------------

function DynamicBadge({
  value,
  fallback = 'border-transparent',
}: {
  value: string;
  fallback?: string;
}) {
  const colorClass = STATUS_COLORS[value] ?? fallback;
  const label = value.replace(/_/g, ' ');
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', colorClass)}>
      {label}
    </Badge>
  );
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

  const canSubmit =
    form.name.trim() !== '' &&
    form.scopes.length > 0 &&
    !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Generate a new API key for programmatic access. The raw key will
            only be shown once.
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
              placeholder="e.g. Mobile App Key"
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="create-desc">Description</Label>
            <Textarea
              id="create-desc"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="What is this key used for?"
              rows={2}
            />
          </div>

          {/* Type + Environment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="create-type">Key Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => update({ type: v as ApiKeyType })}
              >
                <SelectTrigger id="create-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIVE">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </SelectItem>
                  <SelectItem value="TEST">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Test
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-env">Environment *</Label>
              <Select
                value={form.environment}
                onValueChange={(v) =>
                  update({ environment: v as ApiKeyEnvironment })
                }
              >
                <SelectTrigger id="create-env">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEVELOPMENT">Development</SelectItem>
                  <SelectItem value="TESTING">Testing</SelectItem>
                  <SelectItem value="PRODUCTION">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

          <Separator />

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

          <Separator />

          {/* Rate Limits */}
          <div className="grid gap-2">
            <Label>Rate Limits</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rate-min" className="text-xs text-muted-foreground">
                  Per Minute
                </Label>
                <Input
                  id="rate-min"
                  type="number"
                  min="0"
                  value={form.rateLimitPerMin}
                  onChange={(e) => update({ rateLimitPerMin: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rate-hour" className="text-xs text-muted-foreground">
                  Per Hour
                </Label>
                <Input
                  id="rate-hour"
                  type="number"
                  min="0"
                  value={form.rateLimitPerHour}
                  onChange={(e) => update({ rateLimitPerHour: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rate-day" className="text-xs text-muted-foreground">
                  Per Day
                </Label>
                <Input
                  id="rate-day"
                  type="number"
                  min="0"
                  value={form.rateLimitPerDay}
                  onChange={(e) => update({ rateLimitPerDay: e.target.value })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Allowed IPs */}
          <div className="grid gap-2">
            <Label htmlFor="create-ips">Allowed IPs</Label>
            <Textarea
              id="create-ips"
              value={form.allowedIps}
              onChange={(e) => update({ allowedIps: e.target.value })}
              placeholder="One IP per line (e.g. 192.168.1.1)&#10;Use * as wildcard (e.g. 192.168.*.*)"
              rows={3}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to allow all IPs
            </p>
          </div>

          {/* Allowed Domains */}
          <div className="grid gap-2">
            <Label htmlFor="create-domains">Allowed Domains</Label>
            <Textarea
              id="create-domains"
              value={form.allowedDomains}
              onChange={(e) => update({ allowedDomains: e.target.value })}
              placeholder="One domain per line (e.g. example.com)"
              rows={3}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to allow all domains
            </p>
          </div>

          {/* Allowed Origins */}
          <div className="grid gap-2">
            <Label htmlFor="create-origins">Allowed Origins</Label>
            <Textarea
              id="create-origins"
              value={form.allowedOrigins}
              onChange={(e) => update({ allowedOrigins: e.target.value })}
              placeholder="One origin per line (e.g. https://app.example.com)"
              rows={3}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to allow all origins
            </p>
          </div>

          <Separator />

          {/* Site Access */}
          <div className="grid gap-2">
            <Label>Site Access</Label>
            <div className="flex items-center gap-4">
              {(
                [
                  ['CURRENT', 'Current Site'],
                  ['SELECTED', 'Selected Sites'],
                  ['ALL', 'All Sites'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="create-site-access"
                    value={value}
                    checked={form.siteAccess === value}
                    onChange={() => update({ siteAccess: value as ApiKeySiteAccess })}
                    className="accent-primary"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
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
            Create Key
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
          <DialogTitle>Edit API Key</DialogTitle>
          <DialogDescription>Update API key configuration.</DialogDescription>
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

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Environment (no type in edit) */}
          <div className="grid gap-2">
            <Label htmlFor="edit-env">Environment</Label>
            <Select
              value={form.environment}
              onValueChange={(v) =>
                update({ environment: v as ApiKeyEnvironment })
              }
            >
              <SelectTrigger id="edit-env">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEVELOPMENT">Development</SelectItem>
                <SelectItem value="TESTING">Testing</SelectItem>
                <SelectItem value="PRODUCTION">Production</SelectItem>
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

          <Separator />

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

          <Separator />

          {/* Rate Limits */}
          <div className="grid gap-2">
            <Label>Rate Limits</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-rate-min" className="text-xs text-muted-foreground">
                  Per Minute
                </Label>
                <Input
                  id="edit-rate-min"
                  type="number"
                  min="0"
                  value={form.rateLimitPerMin}
                  onChange={(e) => update({ rateLimitPerMin: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-rate-hour" className="text-xs text-muted-foreground">
                  Per Hour
                </Label>
                <Input
                  id="edit-rate-hour"
                  type="number"
                  min="0"
                  value={form.rateLimitPerHour}
                  onChange={(e) => update({ rateLimitPerHour: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-rate-day" className="text-xs text-muted-foreground">
                  Per Day
                </Label>
                <Input
                  id="edit-rate-day"
                  type="number"
                  min="0"
                  value={form.rateLimitPerDay}
                  onChange={(e) => update({ rateLimitPerDay: e.target.value })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Allowed IPs */}
          <div className="grid gap-2">
            <Label htmlFor="edit-ips">Allowed IPs</Label>
            <Textarea
              id="edit-ips"
              value={form.allowedIps}
              onChange={(e) => update({ allowedIps: e.target.value })}
              placeholder="One IP per line"
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          {/* Allowed Domains */}
          <div className="grid gap-2">
            <Label htmlFor="edit-domains">Allowed Domains</Label>
            <Textarea
              id="edit-domains"
              value={form.allowedDomains}
              onChange={(e) => update({ allowedDomains: e.target.value })}
              placeholder="One domain per line"
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          {/* Allowed Origins */}
          <div className="grid gap-2">
            <Label htmlFor="edit-origins">Allowed Origins</Label>
            <Textarea
              id="edit-origins"
              value={form.allowedOrigins}
              onChange={(e) => update({ allowedOrigins: e.target.value })}
              placeholder="One origin per line"
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          <Separator />

          {/* Site Access */}
          <div className="grid gap-2">
            <Label>Site Access</Label>
            <div className="flex items-center gap-4">
              {(
                [
                  ['CURRENT', 'Current Site'],
                  ['SELECTED', 'Selected Sites'],
                  ['ALL', 'All Sites'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="edit-site-access"
                    value={value}
                    checked={form.siteAccess === value}
                    onChange={() => update({ siteAccess: value as ApiKeySiteAccess })}
                    className="accent-primary"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
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

// -------------------- Show Key Dialog --------------------

function ShowKeyDialog({
  open,
  onOpenChange,
  rawKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rawKey: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      toast.success('API key copied to clipboard');
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
            API Key Created Successfully
          </DialogTitle>
          <DialogDescription>
            Save this key now. You won&apos;t be able to see it again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 p-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            For security purposes, the full API key is only displayed once. Make
            sure to copy and store it in a secure location before closing this
            dialog.
          </p>
        </div>

        <div className="grid gap-2 py-2">
          <Label>Your API Key</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-mono break-all select-all leading-relaxed">
              {rawKey}
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

// -------------------- Rotate Key Dialog --------------------

function RotateKeyDialog({
  open,
  onOpenChange,
  keyName,
  rawKey,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  keyName: string;
  rawKey: string | null;
  isLoading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      toast.success('New API key copied to clipboard');
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
            Key Rotated
          </DialogTitle>
          <DialogDescription>
            The API key &quot;{keyName}&quot; has been rotated. The old key is no
            longer valid.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 p-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            The new key is shown below. Save it now — it cannot be displayed
            again. Update all integrations immediately.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rawKey ? (
          <div className="grid gap-2 py-2">
            <Label>New API Key</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-mono break-all select-all leading-relaxed">
                {rawKey}
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

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // ---- Dialog state ----
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    data: EditForm | null;
  }>({ open: false, data: null });
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [rotateDialog, setRotateDialog] = useState<{
    open: boolean;
    keyName: string;
    rawKey: string | null;
  }>({ open: false, keyName: '', rawKey: null });
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ApiKeyRow | null>(null);

  // ---- Filter state ----
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchValue, setSearchValue] = useState('');

  const table = useDataTable({
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
  });

  // ---- Query ----
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.apiKeys.list({
      page: table.currentPage,
      pageSize: table.pageSize,
      sort: table.sortField,
      order: table.sortOrder,
      status: statusFilter,
      type: typeFilter,
      search: searchValue,
    }),
    queryFn: () =>
      getApi<{ data: ApiKeyRow[]; meta: { requestId: string; pagination: PaginationMeta } }>('/api/api-keys', {
        page: table.currentPage,
        pageSize: table.pageSize,
        sort: table.sortField,
        order: table.sortOrder,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        search: searchValue || undefined,
      }, { raw: true }),
    staleTime: 10_000,
  });

  const apiKeys = data?.data ?? [];
  const pagination = data?.meta?.pagination;

  // ---- Mutations ----
  const createMutation = useMutation({
    mutationFn: (form: CreateForm) => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        environment: form.environment,
        scopes: form.scopes,
        expiration: form.expiration,
        rateLimitPerMin: parseInt(form.rateLimitPerMin, 10) || 100,
        rateLimitPerHour: parseInt(form.rateLimitPerHour, 10) || 1000,
        rateLimitPerDay: parseInt(form.rateLimitPerDay, 10) || 10000,
        allowedIps: textToStringList(form.allowedIps),
        allowedDomains: textToStringList(form.allowedDomains),
        allowedOrigins: textToStringList(form.allowedOrigins),
        siteAccess: form.siteAccess,
        userId: user?.id,
      };
      return postApi<ApiKeyRow & { rawKey: string }>('/api/api-keys', body);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      setCreateDialogOpen(false);
      if (res?.rawKey) {
        setNewRawKey(res.rawKey);
      }
      toast.success('API key created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create API key');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (form: EditForm) => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        environment: form.environment,
        scopes: form.scopes,
        expiration: form.expiration,
        rateLimitPerMin: parseInt(form.rateLimitPerMin, 10) || 100,
        rateLimitPerHour: parseInt(form.rateLimitPerHour, 10) || 1000,
        rateLimitPerDay: parseInt(form.rateLimitPerDay, 10) || 10000,
        allowedIps: textToStringList(form.allowedIps),
        allowedDomains: textToStringList(form.allowedDomains),
        allowedOrigins: textToStringList(form.allowedOrigins),
        siteAccess: form.siteAccess,
      };
      return patchApi(`/api/api-keys/${form.id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      setEditDialog({ open: false, data: null });
      toast.success('API key updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update API key');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      setDeleteTarget(null);
      toast.success('API key deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete API key');
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) =>
      postApi<ApiKeyRow & { rawKey: string }>(`/api/api-keys/rotate/${id}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      const name = rotateTarget?.name ?? 'API key';
      setRotateTarget(null);
      setRotateDialog({ open: true, keyName: name, rawKey: res?.rawKey ?? null });
      toast.success('API key rotated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to rotate API key');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      postApi(`/api/api-keys/revoke/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      setRevokeTarget(null);
      toast.success('API key revoked');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to revoke API key');
    },
  });

  // ---- Copy prefix handler ----
  const handleCopyPrefix = async (prefix: string) => {
    try {
      await navigator.clipboard.writeText(prefix);
      toast.success('Key prefix copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  // ---- Row to edit form converter ----
  const rowToEditForm = (row: ApiKeyRow): EditForm => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    type: row.type,
    environment: row.environment,
    scopes: parseScopes(row.scopes),
    expiration: row.expiresAt ? 'custom' : 'never',
    rateLimitPerMin: String(row.rateLimitPerMin ?? 100),
    rateLimitPerHour: String(row.rateLimitPerHour ?? 1000),
    rateLimitPerDay: String(row.rateLimitPerDay ?? 10000),
    allowedIps: stringListToText(parseStringList(row.allowedIps)),
    allowedDomains: stringListToText(parseStringList(row.allowedDomains)),
    allowedOrigins: stringListToText(parseStringList(row.allowedOrigins)),
    siteAccess: row.siteAccess,
  });

  // ---- Columns ----
  const columns = useMemo<ColumnDef<ApiKeyRow>[]>(
    () => [
      ColumnDefHelper.textColumn<ApiKeyRow>({
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        className: 'font-medium min-w-[140px]',
      }),

      {
        id: 'keyPrefix',
        header: 'Key',
        accessorKey: 'keyPrefix',
        enableSorting: false,
        size: 200,
        cell: ({ row }) => {
          const prefix = row.original.keyPrefix;
          return (
            <div className="flex items-center gap-1.5">
              <code className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
                {prefix}...
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyPrefix(prefix);
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },

      {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        enableSorting: false,
        size: 80,
        cell: ({ getValue }) => <DynamicBadge value={getValue() as string} />,
      },

      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        size: 100,
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return <DynamicBadge value={val} />;
        },
      },

      {
        id: 'environment',
        header: 'Environment',
        accessorKey: 'environment',
        size: 120,
        cell: ({ getValue }) => <DynamicBadge value={getValue() as string} />,
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
        id: 'totalRequests',
        header: 'Requests',
        accessorKey: 'totalRequests',
        size: 100,
        cell: ({ row }) => (
          <div className="text-sm">
            <span className="font-medium">
              {formatNumber(row.original.totalRequests)}
            </span>
            {row.original.totalErrors > 0 && (
              <span className="text-red-500 text-xs ml-1">
                ({formatNumber(row.original.totalErrors)} err)
              </span>
            )}
          </div>
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
        id: 'expiresAt',
        header: 'Expires',
        accessorKey: 'expiresAt',
        size: 120,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
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

      ColumnDefHelper.actionColumn<ApiKeyRow>({
        id: 'actions',
        render: (row) => {
          const isRevokedOrExpired =
            row.status === 'REVOKED' || row.status === 'EXPIRED';
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

                {!isRevokedOrExpired && (
                  <DropdownMenuItem
                    onClick={() => setRotateTarget(row)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Rotate Key
                  </DropdownMenuItem>
                )}

                {!isRevokedOrExpired && (
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

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    table.setCurrentPage(1);
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    table.setCurrentPage(1);
  };

  // ---- Render ----
  return (
    <div className="space-y-4">
      <PageHeader
        title="API Keys"
        description="Manage API keys for programmatic access to your CMS"
        action={
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create API Key
          </Button>
        }
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search API keys..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="REVOKED">Revoked</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="LIVE">Live</SelectItem>
              <SelectItem value="TEST">Test</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={apiKeys}
        isLoading={isLoading}
        totalItems={pagination?.total ?? 0}
        pageSize={table.pageSize}
        currentPage={table.currentPage}
        onPageChange={(p) => table.setCurrentPage(p)}
        onSortChange={(f, o) => table.setSortField(f, o)}
        sortField={table.sortField}
        sortOrder={table.sortOrder}
        getRowId={(row) => row.id}
        emptyMessage="No API keys found. Create one to get started."
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

      {/* Show New Key Dialog */}
      <ShowKeyDialog
        open={!!newRawKey}
        onOpenChange={(v) => !v && setNewRawKey(null)}
        rawKey={newRawKey}
      />

      {/* Rotate Key Dialog */}
      <RotateKeyDialog
        open={rotateDialog.open}
        onOpenChange={(v) =>
          setRotateDialog((p) => ({ ...p, open: v }))
        }
        keyName={rotateDialog.keyName}
        rawKey={rotateDialog.rawKey}
        isLoading={false}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete API Key"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? Any integrations using this key will immediately lose access.`
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
        title="Revoke API Key"
        description={
          revokeTarget
            ? `Are you sure you want to revoke "${revokeTarget.name}"? The key will be immediately disabled and cannot be used again.`
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
        title="Rotate API Key"
        description={
          rotateTarget
            ? `Are you sure you want to rotate "${rotateTarget.name}"? A new key will be generated and the old key will stop working immediately.`
            : undefined
        }
        confirmLabel="Rotate Key"
        onConfirm={() => {
          if (rotateTarget) rotateMutation.mutate(rotateTarget.id);
        }}
        isLoading={rotateMutation.isPending}
      />
    </div>
  );
}
