'use client';

// ============================================================
// PLATFORM STRIPE SETTINGS — connect the platform's Stripe
// account from the admin UI.
// ============================================================
// Owner-only. Lets the Platform Owner:
//   - Switch between Test and Live mode (separate credentials per mode).
//   - Enter the Stripe Secret Key, Publishable Key, and Webhook
//     Signing Secret for each mode. Secret keys are AES-256-GCM
//     encrypted in the DB and NEVER returned to the frontend in
//     plaintext — only the masked form is shown (sk_...xxxx).
//   - Set the public app URL (for Stripe Checkout success/cancel
//     redirects).
//   - "Test Connection" pings Stripe's /v1/balance + /v1/account
//     endpoints with a temporary client (read-only — no side
//     effects) and records the outcome on the singleton row.
//   - See the Webhook Endpoint URL to copy into the Stripe
//     dashboard so Stripe fires events to this platform.
//   - See the last Test Connection outcome + timestamp.
//
// Backend: /api/platform/admin/stripe/settings (GET+PUT),
//          /api/platform/admin/stripe/test-connection (POST).
//
// This page is FINANCIAL SETTINGS ONLY. Customer / payment /
// subscription / refund management lives on the Customers /
// Payments pages — not duplicated here.
// ============================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Plug,
  ShieldCheck,
  ShieldAlert,
  Webhook,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
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
import { Badge } from '@/components/ui/badge';
import { getApi, putApi, postApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  PlatformPageHeader,
  ErrorState,
} from '@/modules/platform/shared';
import { useT } from '@/lib/i18n';

// -------------------- Types --------------------

interface StripeSettingsView {
  mode: 'test' | 'live';
  secretKeyTestMasked: string;
  secretKeyLiveMasked: string;
  publishableKeyTest: string;
  publishableKeyLive: string;
  webhookSecretTestMasked: string;
  webhookSecretLiveMasked: string;
  appUrl: string;
  lastTestStatus: 'success' | 'error' | null;
  lastTestedAt: string | null;
  lastTestErrorMessage: string | null;
  hasSecretKeyTest: boolean;
  hasSecretKeyLive: boolean;
  hasWebhookSecretTest: boolean;
  hasWebhookSecretLive: boolean;
  hasPublishableKeyTest: boolean;
  hasPublishableKeyLive: boolean;
  activeSource: 'db' | 'env' | 'none';
  isConfigured: boolean;
  webhookUrlHint: string;
}

interface TestResult {
  success: boolean;
  mode: 'test' | 'live';
  accountInfo?: {
    id: string;
    type: string;
    country: string;
    email: string | null;
    displayName: string | null;
  };
  code?: string;
  message?: string;
}

// -------------------- Page (loader shell) --------------------

export function PlatformStripeSettingsModule() {
  const { t } = useT();
  const queryClient = useQueryClient();

  // ---------- Load saved settings ----------
  const { data, isLoading, isError, refetch } = useQuery<StripeSettingsView>({
    queryKey: ['platform', 'stripe-settings'],
    queryFn: () => getApi<StripeSettingsView>('/api/platform/admin/stripe/settings'),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader
          title={t('title.platformStripe')}
          subtitle={t('platformStripe.subtitle')}
        />
        <Card>
          <CardContent className="p-6 flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PlatformPageHeader
          title={t('title.platformStripe')}
          subtitle={t('platformStripe.subtitle')}
        />
        <Card>
          <CardContent className="p-6">
            <ErrorState message={t('platformStripe.couldNotLoad')} onRetry={() => refetch()} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the form once data is available — `key` ensures the form
  // remounts (re-initializing useState) when the saved settings change
  // after a save / test-connection / external mutation. This avoids the
  // setState-in-effect anti-pattern.
  return (
    <StripeSettingsForm
      key={data.lastTestedAt ?? 'fresh'}
      data={data}
      queryClient={queryClient}
    />
  );
}

// -------------------- Form (mounted when data is available) --------------------

function StripeSettingsForm({
  data,
  queryClient,
}: {
  data: StripeSettingsView;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { t } = useT();
  // ---------- Local form state (initialized ONCE from data on mount) ----------
  const [mode, setMode] = useState<'test' | 'live'>(data.mode);
  const [secretKeyTest, setSecretKeyTest] = useState(''); // never pre-fill secret keys
  const [secretKeyLive, setSecretKeyLive] = useState('');
  const [publishableKeyTest, setPublishableKeyTest] = useState(data.publishableKeyTest || '');
  const [publishableKeyLive, setPublishableKeyLive] = useState(data.publishableKeyLive || '');
  const [webhookSecretTest, setWebhookSecretTest] = useState('');
  const [webhookSecretLive, setWebhookSecretLive] = useState('');
  const [appUrl, setAppUrl] = useState(data.appUrl || '');
  const [showSecretTest, setShowSecretTest] = useState(false);
  const [showSecretLive, setShowSecretLive] = useState(false);
  const [showWebhookTest, setShowWebhookTest] = useState(false);
  const [showWebhookLive, setShowWebhookLive] = useState(false);
  const [copied, setCopied] = useState(false);

  // ---------- Save mutation ----------
  const saveMutation = useMutation({
    mutationFn: async () => {
      // IMPORTANT: send the actual field values (which may be empty
      // string). The backend distinguishes:
      //   - undefined (field omitted from JSON body) → "preserve" (keep existing)
      //   - null → "clear" (set to null)
      //   - '' (empty string) → "preserve" (matches the form's "leave empty
      //     to keep current" placeholder semantics)
      //   - non-empty string → encrypt + store
      // We used to convert '' → undefined via `|| undefined`, which made
      // the backend "clear" the saved secret every time the admin saved
      // without retyping the key → "Invalid API Key" on the next Test
      // Connection. Sending the explicit empty string fixes that.
      // Publishable keys are plaintext and visible — empty string also
      // means "preserve" (the field is pre-populated with the current
      // value so the admin can see + edit it directly).
      return putApi<StripeSettingsView>('/api/platform/admin/stripe/settings', {
        mode,
        secretKeyTest,
        secretKeyLive,
        publishableKeyTest,
        publishableKeyLive,
        webhookSecretTest,
        webhookSecretLive,
        appUrl,
      });
    },
    onSuccess: () => {
      toast.success(t('platformStripe.settingsSaved'));
      queryClient.invalidateQueries({ queryKey: ['platform', 'stripe-settings'] });
      // Clear the secret-key inputs after a successful save — the admin
      // must re-enter the key to view/modify it (defensive: prevents
      // stale plaintext from lingering in the form).
      setSecretKeyTest('');
      setSecretKeyLive('');
      setWebhookSecretTest('');
      setWebhookSecretLive('');
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; message?: string };
      toast.error(e?.message || t('platformStripe.unableToSave'));
    },
  });

  // ---------- Test connection mutation ----------
  // Tests the UNSAVED credentials when secret-key fields are populated
  // (admin just typed a new key); falls back to the saved/stored
  // credentials when they're empty. Sends the actual field values (not
  // `|| undefined`) so the backend can distinguish "field omitted"
  // (fall back to stored) from "field cleared" (use no key). An empty
  // string is treated the same as omitted for Test Connection (the
  // backend falls back to the stored value for the selected mode).
  const testMutation = useMutation({
    mutationFn: async () => {
      return postApi<TestResult>('/api/platform/admin/stripe/test-connection', {
        mode,
        secretKeyTest,
        secretKeyLive,
      });
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(
          `${t('platformStripe.connOkPrefix')} ${res.mode.toUpperCase()} ${t('platformStripe.connOkSuffix')}. ${t('platformStripe.account')}: ${res.accountInfo?.id ?? t('platformStripe.unknown')} (${res.accountInfo?.country ?? '?'})`,
        );
      } else {
        toast.error(`${t('platformStripe.connectionFailed')} (${res.code}): ${res.message}`);
      }
      queryClient.invalidateQueries({ queryKey: ['platform', 'stripe-settings'] });
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; message?: string };
      toast.error(e?.message || t('platformStripe.unableToTest'));
    },
  });

  // ---------- Copy webhook URL ----------
  const copyWebhookUrl = async () => {
    if (!data.webhookUrlHint) return;
    try {
      await navigator.clipboard.writeText(data.webhookUrlHint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t('platformStripe.webhookCopied'));
    } catch {
      toast.error(t('platformStripe.copyFailed'));
    }
  };

  // -------------------- Render --------------------

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Stripe Settings"
        subtitle="Connect your Stripe account to enable real subscription billing."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plug className="h-4 w-4 mr-2" />
            )}
            {t('platformStripe.testConnection')}
          </Button>
        }
      />

      {/* -------------------- Status banner -------------------- */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              {data.isConfigured ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {data.isConfigured
                    ? `${t('platformStripe.connected')} (${data.mode === 'live' ? t('platformStripe.liveModeBanner') : t('platformStripe.testModeBanner')})`
                    : t('platformStripe.notConnected')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.isConfigured
                    ? `${t('platformStripe.credentialsSource')}: ${data.activeSource === 'db' ? t('platformStripe.sourceAdminSettings') : '.env'}`
                    : t('platformStripe.configureHint')}
                </p>
              </div>
            </div>
            {/* Last test result */}
            <div className="flex items-center gap-3">
              {data.lastTestStatus === 'success' && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {t('platformStripe.lastTestOk')}
                </Badge>
              )}
              {data.lastTestStatus === 'error' && (
                <Badge className="bg-rose-50 text-rose-700 border-rose-200">
                  <XCircle className="h-3 w-3 mr-1" />
                  {t('platformStripe.lastTestFailed')}
                </Badge>
              )}
              {data.lastTestedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(data.lastTestedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          {data.lastTestStatus === 'error' && data.lastTestErrorMessage && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-mono text-rose-700 break-all">{data.lastTestErrorMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* -------------------- Mode + credentials -------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('platformStripe.accountCredentials')}
          </CardTitle>
          <CardDescription>
            {t('platformStripe.credentialsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Mode toggle */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{t('platformStripe.mode')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('platformStripe.modeDescription')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('text-xs font-medium', mode === 'test' ? 'text-amber-700' : 'text-muted-foreground')}>
                TEST
              </span>
              <Switch
                checked={mode === 'live'}
                onCheckedChange={(v) => setMode(v ? 'live' : 'test')}
              />
              <span className={cn('text-xs font-medium', mode === 'live' ? 'text-emerald-700' : 'text-muted-foreground')}>
                LIVE
              </span>
            </div>
          </div>

          <Separator />

          {/* Test mode credentials */}
          <div className={cn('space-y-4', mode === 'live' && 'opacity-50 pointer-events-none')}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  'bg-amber-50 text-amber-700 border border-amber-200',
                )}>
                  TEST
                </span>
                {t('platformStripe.testModeCredentials')}
              </h4>
              {data.hasSecretKeyTest && (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                  {t('platformStripe.configured')}
                </Badge>
              )}
            </div>
            <SecretKeyInput
              label={t('platformStripe.secretKey')}
              prefix="sk_test_"
              value={secretKeyTest}
              onChange={setSecretKeyTest}
              show={showSecretTest}
              onToggleShow={() => setShowSecretTest((v) => !v)}
              masked={data.secretKeyTestMasked}
              isSet={data.hasSecretKeyTest}
              placeholder="sk_test_…"
            />
            <div className="space-y-1.5">
              <Label className="text-xs">{t('platformStripe.publishableKey')}</Label>
              <Input
                value={publishableKeyTest}
                onChange={(e) => setPublishableKeyTest(e.target.value)}
                className="h-9 font-mono text-xs"
                placeholder="pk_test_…"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('platformStripe.publishableHint')}
              </p>
            </div>
            <SecretKeyInput
              label={t('platformStripe.webhookSigningSecret')}
              prefix="whsec_"
              value={webhookSecretTest}
              onChange={setWebhookSecretTest}
              show={showWebhookTest}
              onToggleShow={() => setShowWebhookTest((v) => !v)}
              masked={data.webhookSecretTestMasked}
              isSet={data.hasWebhookSecretTest}
              placeholder="whsec_…"
            />
          </div>

          <Separator />

          {/* Live mode credentials */}
          <div className={cn('space-y-4', mode === 'test' && 'opacity-50 pointer-events-none')}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  'bg-emerald-50 text-emerald-700 border border-emerald-200',
                )}>
                  LIVE
                </span>
                {t('platformStripe.liveModeCredentials')}
              </h4>
              {data.hasSecretKeyLive && (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                  {t('platformStripe.configured')}
                </Badge>
              )}
            </div>
            <SecretKeyInput
              label={t('platformStripe.secretKey')}
              prefix="sk_live_"
              value={secretKeyLive}
              onChange={setSecretKeyLive}
              show={showSecretLive}
              onToggleShow={() => setShowSecretLive((v) => !v)}
              masked={data.secretKeyLiveMasked}
              isSet={data.hasSecretKeyLive}
              placeholder="sk_live_…"
            />
            <div className="space-y-1.5">
              <Label className="text-xs">{t('platformStripe.publishableKey')}</Label>
              <Input
                value={publishableKeyLive}
                onChange={(e) => setPublishableKeyLive(e.target.value)}
                className="h-9 font-mono text-xs"
                placeholder="pk_live_…"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('platformStripe.publishableHint')}
              </p>
            </div>
            <SecretKeyInput
              label={t('platformStripe.webhookSigningSecret')}
              prefix="whsec_"
              value={webhookSecretLive}
              onChange={setWebhookSecretLive}
              show={showWebhookLive}
              onToggleShow={() => setShowWebhookLive((v) => !v)}
              masked={data.webhookSecretLiveMasked}
              isSet={data.hasWebhookSecretLive}
              placeholder="whsec_…"
            />
          </div>

          <Separator />

          {/* App URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('platformStripe.publicAppUrl')}</Label>
            <Input
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              className="h-9"
              placeholder="https://your-platform.com"
            />
            <p className="text-[11px] text-muted-foreground">
              {t('platformStripe.appUrlHint')}
            </p>
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t('platformStripe.saveSettings')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* -------------------- Webhook endpoint -------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            {t('platformStripe.webhookEndpoint')}
          </CardTitle>
          <CardDescription>
            {t('platformStripe.webhookDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs font-mono break-all">
              {data.webhookUrlHint}
            </code>
            <Button variant="outline" size="icon" onClick={copyWebhookUrl} title={t('common.copy')}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>{t('platformStripe.important')}</strong>{' '}
              {t('platformStripe.webhookSecretUse')} (<code className="font-mono">whsec_…</code>){' '}
              {t('platformStripe.webhookSecretLead')}{' '}
              {mode === 'live' ? t('platformStripe.liveModeWord') : t('platformStripe.testModeWord')}{' '}
              {t('platformStripe.webhookSecretField')} {t('platformStripe.webhookNeverReuse')}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>
              {t('platformStripe.eventsHandled')} <code className="font-mono">checkout.session.completed</code>,{' '}
              <code className="font-mono">customer.subscription.created/updated/deleted</code>,{' '}
              <code className="font-mono">invoice.paid</code>,{' '}
              <code className="font-mono">invoice.payment_failed</code>,{' '}
              <code className="font-mono">payment_intent.succeeded/payment_failed</code>,{' '}
              <code className="font-mono">charge.refunded</code>.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* -------------------- How it works -------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('platformStripe.howItWorks')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">{t('platformStripe.howTitle1')}</strong>{' '}
            {t('platformStripe.howBody1')}
          </p>
          <p>
            <strong className="text-foreground">{t('platformStripe.howTitle2')}</strong>{' '}
            {t('platformStripe.howBody2a')} <em>{t('platformStripe.syncToStripe')}</em>{' '}
            {t('platformStripe.howBody2b')}
          </p>
          <p>
            <strong className="text-foreground">{t('platformStripe.howTitle3')}</strong>{' '}
            {t('platformStripe.howBody3')}
          </p>
          <p>
            <strong className="text-foreground">{t('platformStripe.howTitle4')}</strong>{' '}
            {t('platformStripe.howBody4')}
          </p>
          <p>
            <strong className="text-foreground">{t('platformStripe.howTitle5')}</strong>{' '}
            {t('platformStripe.howBody5')}
          </p>
          <div className="pt-2">
            <a
              href="https://dashboard.stripe.com/apikeys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t('platformStripe.openApiKeysDashboard')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- SecretKeyInput --------------------

function SecretKeyInput({
  label,
  prefix,
  value,
  onChange,
  show,
  onToggleShow,
  masked,
  isSet,
  placeholder,
}: {
  label: string;
  prefix: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  masked: string;
  isSet: boolean;
  placeholder: string;
}) {
  const { t } = useT();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {isSet && masked && (
          <span className="text-[11px] text-muted-foreground font-mono">
            {t('platformStripe.current')}: {masked}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 font-mono text-xs pr-9"
            placeholder={isSet ? t('platformStripe.keepCurrentPlaceholder') : placeholder}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t('platformStripe.startsWith')} <code className="font-mono">{prefix}</code>
        {t('platformStripe.encryptedAtRest')}
      </p>
    </div>
  );
}
