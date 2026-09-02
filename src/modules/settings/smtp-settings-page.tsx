'use client';

// ============================================================
// SMTP SETTINGS PAGE
// Settings → Communications → SMTP Settings
// ============================================================
// Form sections:
//  1. Email Sending (isActive toggle)
//  2. SMTP Connection (host, port, encryption)
//  3. Authentication (username, password w/ AES-256-GCM note)
//  4. Sender Identity (fromName, fromEmail, replyTo)
//  5. Save button
//  6. Diagnostics (test connection + send test email)
//  7. Security note
// ============================================================

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  Eye,
  EyeOff,
  Send,
  ShieldCheck,
  Plug,
  Settings as SettingsIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApi, putApi, postApi } from '@/lib/api-client';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// -------------------- Types --------------------

type Encryption = 'none' | 'SSL' | 'STARTTLS';

interface SmtpSettingsResponse {
  id: string | null;
  provider: string;
  host: string;
  port: number;
  encryption: Encryption;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  timeout: number;
  isActive: boolean;
  isDefault: boolean;
}

interface TestResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

interface ApiErrorPayload {
  error: { code: string; message: string };
  meta: { requestId: string };
}

// -------------------- Constants --------------------

const PASSWORD_PLACEHOLDER = '••••••••';

const ENCRYPTION_OPTIONS: {
  value: Encryption;
  labelKey: string;
  hintKey: string;
  port: number;
}[] = [
  { value: 'STARTTLS', labelKey: 'smtp.encryptionStarttls', hintKey: 'smtp.hintStarttls', port: 587 },
  { value: 'SSL', labelKey: 'smtp.encryptionSsl', hintKey: 'smtp.hintSsl', port: 465 },
  { value: 'none', labelKey: 'smtp.encryptionNone', hintKey: 'smtp.hintNone', port: 25 },
];

// -------------------- Page --------------------

export function SmtpSettingsPage() {
  const { t } = useT();
  const queryClient = useQueryClient();

  // ---------- Load saved settings ----------
  const { data, isLoading } = useQuery<SmtpSettingsResponse | null>({
    queryKey: ['settings', 'smtp'],
    queryFn: () => getApi<SmtpSettingsResponse | null>('/api/settings/smtp'),
    staleTime: 10_000,
  });

  // ---------- Draft state (local overrides on top of saved values) ----------
  // We never sync useEffect→state. Instead we derive "current display value"
  // from `saved + draft override`. Dirty = draft is non-empty.
  const [draft, setDraft] = useState<Partial<SmtpSettingsResponse>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Password UI state — separate so we can support the masked-placeholder pattern.
  const [passwordInput, setPasswordInput] = useState<string>(PASSWORD_PLACEHOLDER);

  // ---------- Derived values ----------
  const saved = data ?? null;
  const hasSavedPassword = (saved?.password ?? '').length > 0;

  const current: SmtpSettingsResponse = {
    id: saved?.id ?? null,
    provider: saved?.provider ?? 'SMTP',
    host: draft.host ?? saved?.host ?? '',
    port: draft.port ?? saved?.port ?? 587,
    encryption: draft.encryption ?? saved?.encryption ?? 'STARTTLS',
    username: draft.username ?? saved?.username ?? '',
    password: hasSavedPassword ? PASSWORD_PLACEHOLDER : '',
    fromName: draft.fromName ?? saved?.fromName ?? '',
    fromEmail: draft.fromEmail ?? saved?.fromEmail ?? '',
    replyTo: draft.replyTo ?? saved?.replyTo ?? '',
    timeout: draft.timeout ?? saved?.timeout ?? 10,
    isActive: draft.isActive ?? saved?.isActive ?? true,
    isDefault: saved?.isDefault ?? true,
  };

  const isDirty =
    Object.keys(draft).length > 0 || passwordInput !== PASSWORD_PLACEHOLDER;

  // ---------- Setters ----------
  const update = <K extends keyof SmtpSettingsResponse>(
    key: K,
    value: SmtpSettingsResponse[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  // When encryption changes, also auto-suggest the matching default port.
  const handleEncryptionChange = (value: Encryption) => {
    const option = ENCRYPTION_OPTIONS.find((o) => o.value === value);
    setDraft((prev) => ({
      ...prev,
      encryption: value,
      port: option ? option.port : prev.port,
    }));
  };

  // ---------- Save mutation ----------
  const saveMutation = useMutation({
    mutationFn: () =>
      putApi<SmtpSettingsResponse>('/api/settings/smtp', {
        provider: current.provider,
        host: current.host,
        port: current.port,
        encryption: current.encryption,
        username: current.username,
        // Send the masked placeholder when password is unchanged,
        // OR send the new password when user typed something else.
        password: passwordInput,
        fromName: current.fromName,
        fromEmail: current.fromEmail,
        replyTo: current.replyTo,
        timeout: current.timeout,
        isActive: current.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'smtp'] });
      setDraft({});
      setPasswordInput(PASSWORD_PLACEHOLDER);
      toast.success(t('smtp.savedSuccess'));
    },
    onError: (err: unknown) => {
      const message =
        (err as ApiErrorPayload)?.error?.message ??
        (err instanceof Error ? err.message : t('smtp.saveFailed'));
      toast.error(message);
    },
  });

  // ---------- Test connection mutation ----------
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  const testMutation = useMutation({
    mutationFn: () => {
      // If dirty, send current draft; otherwise let backend use saved settings.
      const payload = isDirty
        ? {
            settings: {
              provider: current.provider,
              host: current.host,
              port: current.port,
              encryption: current.encryption,
              username: current.username,
              password: passwordInput,
              fromName: current.fromName,
              fromEmail: current.fromEmail,
              replyTo: current.replyTo,
              timeout: current.timeout,
              isActive: current.isActive,
            },
          }
        : {};
      return postApi<TestResponse>('/api/settings/smtp/test', payload);
    },
    onSuccess: (data) => {
      setTestResult({ ok: true, message: data.message });
      toast.success(data.message);
    },
    onError: (err: unknown) => {
      const message =
        (err as ApiErrorPayload)?.error?.message ??
        (err instanceof Error ? err.message : t('smtp.testFailed'));
      setTestResult({ ok: false, message });
      toast.error(message);
    },
  });

  // ---------- Send test email mutation ----------
  const [testEmail, setTestEmail] = useState('');
  const [emailResult, setEmailResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  const sendEmailMutation = useMutation({
    mutationFn: () => {
      const payload = {
        email: testEmail,
        ...(isDirty
          ? {
              settings: {
                provider: current.provider,
                host: current.host,
                port: current.port,
                encryption: current.encryption,
                username: current.username,
                password: passwordInput,
                fromName: current.fromName,
                fromEmail: current.fromEmail,
                replyTo: current.replyTo,
                timeout: current.timeout,
                isActive: current.isActive,
              },
            }
          : {}),
      };
      return postApi<TestResponse>('/api/settings/smtp/test-email', payload);
    },
    onSuccess: (data) => {
      setEmailResult({ ok: true, message: data.message });
      toast.success(data.message);
    },
    onError: (err: unknown) => {
      const message =
        (err as ApiErrorPayload)?.error?.message ??
        (err instanceof Error ? err.message : t('smtp.sendTestFailed'));
      setEmailResult({ ok: false, message });
      toast.error(message);
    },
  });

  // ---------- Reset (discard local draft) ----------
  const handleDiscard = () => {
    setDraft({});
    setPasswordInput(PASSWORD_PLACEHOLDER);
    setTestResult(null);
    setEmailResult(null);
    toast.info(t('smtp.changesDiscarded'));
  };

  // ---------- Loading skeleton ----------
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse bg-muted rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-10 w-full animate-pulse bg-muted rounded" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const encryptionOption = ENCRYPTION_OPTIONS.find(
    (o) => o.value === current.encryption,
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t('smtp.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('smtp.description')}
        </p>
      </div>

      {/* 1. Email Sending */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{t('smtp.emailSending')}</CardTitle>
          </div>
          <CardDescription>
            {t('smtp.emailSendingDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isActive" className="text-sm font-medium">
                {t('smtp.enableEmailSending')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('smtp.enableEmailSendingHint')}
              </p>
            </div>
            <Switch
              id="isActive"
              checked={current.isActive}
              onCheckedChange={(v) => update('isActive', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. SMTP Connection */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{t('smtp.connection')}</CardTitle>
          </div>
          <CardDescription>
            {t('smtp.connectionDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="host" className="text-sm font-medium">
                {t('smtp.host')}
              </Label>
              <Input
                id="host"
                value={current.host}
                onChange={(e) => update('host', e.target.value)}
                placeholder="smtp.example.com"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                {t('smtp.hostHint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="port" className="text-sm font-medium">
                {t('smtp.port')}
              </Label>
              <Input
                id="port"
                type="number"
                value={current.port}
                onChange={(e) => update('port', Number(e.target.value))}
                placeholder="587"
                min={1}
                max={65535}
              />
              <p className="text-xs text-muted-foreground">
                {t('smtp.suggested')}{' '}<span className="font-medium">{encryptionOption?.port ?? 587}</span>{' '}{t('smtp.suggestedFor')}{' '}
                {encryptionOption ? t(encryptionOption.labelKey) : 'STARTTLS'}.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="encryption" className="text-sm font-medium">
                {t('smtp.encryption')}
              </Label>
              <Select
                value={current.encryption}
                onValueChange={(v) => handleEncryptionChange(v as Encryption)}
              >
                <SelectTrigger id="encryption">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENCRYPTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{t(opt.labelKey)}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(opt.hintKey)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('smtp.encryptionHint')}
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="timeout" className="text-sm font-medium">
                {t('smtp.timeout')}
              </Label>
              <Input
                id="timeout"
                type="number"
                value={current.timeout}
                onChange={(e) => update('timeout', Number(e.target.value))}
                min={1}
                max={120}
                className="sm:w-40"
              />
              <p className="text-xs text-muted-foreground">
                {t('smtp.timeoutHint')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Authentication */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{t('smtp.authentication')}</CardTitle>
          </div>
          <CardDescription>
            {t('smtp.authenticationDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">
                {t('smtp.username')}
              </Label>
              <Input
                id="username"
                value={current.username}
                onChange={(e) => update('username', e.target.value)}
                placeholder="user@example.com"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                {t('smtp.usernameHint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                {t('smtp.password')}
              </Label>
              {passwordInput === PASSWORD_PLACEHOLDER ? (
                // Saved password — show masked placeholder + "Change" button
                <div className="flex items-center gap-2">
                  <div
                    id="password"
                    className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground"
                  >
                    {PASSWORD_PLACEHOLDER}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPasswordInput('')}
                  >
                    {t('smtp.change')}
                  </Button>
                </div>
              ) : (
                // Editable password input with show/hide toggle
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      // If the user typed over the masked placeholder, stray bullets
                      // may be embedded in the new value. Strip them out.
                      if (val.includes('•')) {
                        setPasswordInput(val.replace(/•/g, ''));
                      } else {
                        setPasswordInput(val);
                      }
                    }}
                    placeholder={t('smtp.enterNewPassword')}
                    autoComplete="new-password"
                    spellCheck={false}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? t('smtp.hidePassword') : t('smtp.showPassword')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                {hasSavedPassword ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" />{t('smtp.saved')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t('smtp.noPasswordSaved')}</span>
                )}
                <span className="text-muted-foreground">
                  {t('smtp.encryptedAtRest')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Sender Identity */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{t('smtp.senderIdentity')}</CardTitle>
          </div>
          <CardDescription>
            {t('smtp.senderIdentityDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fromName" className="text-sm font-medium">
                {t('smtp.fromName')}
              </Label>
              <Input
                id="fromName"
                value={current.fromName}
                onChange={(e) => update('fromName', e.target.value)}
                placeholder="Acme Inc."
              />
              <p className="text-xs text-muted-foreground">
                {t('smtp.fromNameHint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fromEmail" className="text-sm font-medium">
                {t('smtp.fromEmail')}
              </Label>
              <Input
                id="fromEmail"
                type="email"
                value={current.fromEmail}
                onChange={(e) => update('fromEmail', e.target.value)}
                placeholder="noreply@example.com"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                {t('smtp.fromEmailHint')}
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="replyTo" className="text-sm font-medium">
                {t('smtp.replyTo')}
              </Label>
              <Input
                id="replyTo"
                type="email"
                value={current.replyTo}
                onChange={(e) => update('replyTo', e.target.value)}
                placeholder="support@example.com"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                {t('smtp.replyToHint')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Save */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleDiscard}
          disabled={!isDirty || saveMutation.isPending}
        >
          {t('smtp.discard')}
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !isDirty}
          className="gap-2"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('smtp.saveSettings')}
        </Button>
      </div>

      <Separator />

      {/* 6. Diagnostics */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{t('smtp.diagnostics')}</CardTitle>
          </div>
          <CardDescription>
            {t('smtp.diagnosticsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Connection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{t('smtp.testConnection')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('smtp.testConnectionHint')}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setTestResult(null);
                  testMutation.mutate();
                }}
                disabled={testMutation.isPending}
                className="gap-2"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}
                {t('smtp.testConnectionAction')}
              </Button>
            </div>
            {testResult && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg border p-3 text-sm',
                  testResult.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
                )}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <span className="leading-relaxed break-words">{testResult.message}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Send Test Email */}
          <div className="space-y-3">
            <div className="space-y-0.5">
              <Label htmlFor="testEmail" className="text-sm font-medium">
                {t('smtp.sendTestEmail')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('smtp.sendTestEmailHint')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 min-w-[220px]"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                onClick={() => {
                  setEmailResult(null);
                  sendEmailMutation.mutate();
                }}
                disabled={sendEmailMutation.isPending || !testEmail}
                className="gap-2"
              >
                {sendEmailMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t('smtp.sendTestEmail')}
              </Button>
            </div>
            {emailResult && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg border p-3 text-sm',
                  emailResult.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
                )}
              >
                {emailResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <span className="leading-relaxed break-words">{emailResult.message}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 7. Security Note */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed">
          <p className="font-medium">{t('smtp.securityNote')}</p>
          <p className="mt-1">
            {t('smtp.securityNotePrefix')} <strong>AES-256-GCM</strong>{t('smtp.securityNoteSuffix')}
          </p>
        </div>
      </div>
    </div>
  );
}
