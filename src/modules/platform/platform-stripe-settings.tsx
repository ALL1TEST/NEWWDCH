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
          title="Stripe Settings"
          subtitle="Connect your Stripe account to enable real subscription billing."
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
          title="Stripe Settings"
          subtitle="Connect your Stripe account to enable real subscription billing."
        />
        <Card>
          <CardContent className="p-6">
            <ErrorState message="Could not load Stripe settings. Please retry." onRetry={() => refetch()} />
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
      toast.success('Stripe settings saved.');
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
      toast.error(e?.message || 'Unable to save Stripe settings.');
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
          `Stripe ${res.mode.toUpperCase()} connection successful. Account: ${res.accountInfo?.id ?? 'unknown'} (${res.accountInfo?.country ?? '?'})`,
        );
      } else {
        toast.error(`Connection failed (${res.code}): ${res.message}`);
      }
      queryClient.invalidateQueries({ queryKey: ['platform', 'stripe-settings'] });
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; message?: string };
      toast.error(e?.message || 'Unable to test Stripe connection.');
    },
  });

  // ---------- Copy webhook URL ----------
  const copyWebhookUrl = async () => {
    if (!data.webhookUrlHint) return;
    try {
      await navigator.clipboard.writeText(data.webhookUrlHint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Webhook URL copied to clipboard.');
    } catch {
      toast.error('Could not copy. Select and copy manually.');
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
            Test Connection
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
                    ? `Stripe is connected (${data.mode.toUpperCase()} mode)`
                    : 'Stripe is not connected'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.isConfigured
                    ? `Credentials source: ${data.activeSource === 'db' ? 'Admin Settings' : '.env'}`
                    : 'Configure credentials below or set them in .env to enable checkout.'}
                </p>
              </div>
            </div>
            {/* Last test result */}
            <div className="flex items-center gap-3">
              {data.lastTestStatus === 'success' && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Last test: OK
                </Badge>
              )}
              {data.lastTestStatus === 'error' && (
                <Badge className="bg-rose-50 text-rose-700 border-rose-200">
                  <XCircle className="h-3 w-3 mr-1" />
                  Last test: Failed
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
            Account Credentials
          </CardTitle>
          <CardDescription>
            Enter your Stripe keys for each mode. Secret keys are AES-256-GCM encrypted at rest and never
            sent back to the frontend in plaintext. Leave a secret field empty to keep the existing value;
            enter a new value to rotate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Mode toggle */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Test mode uses your Stripe sandbox keys (sk_test_…). Live mode uses real production keys
                (sk_live_…). Switch modes any time — credentials are stored separately per mode.
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
                Test Mode Credentials
              </h4>
              {data.hasSecretKeyTest && (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                  Configured
                </Badge>
              )}
            </div>
            <SecretKeyInput
              label="Secret Key"
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
              <Label className="text-xs">Publishable Key</Label>
              <Input
                value={publishableKeyTest}
                onChange={(e) => setPublishableKeyTest(e.target.value)}
                className="h-9 font-mono text-xs"
                placeholder="pk_test_…"
              />
              <p className="text-[11px] text-muted-foreground">
                Non-secret — safe to expose to the client for Stripe.js.
              </p>
            </div>
            <SecretKeyInput
              label="Webhook Signing Secret"
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
                Live Mode Credentials
              </h4>
              {data.hasSecretKeyLive && (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                  Configured
                </Badge>
              )}
            </div>
            <SecretKeyInput
              label="Secret Key"
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
              <Label className="text-xs">Publishable Key</Label>
              <Input
                value={publishableKeyLive}
                onChange={(e) => setPublishableKeyLive(e.target.value)}
                className="h-9 font-mono text-xs"
                placeholder="pk_live_…"
              />
              <p className="text-[11px] text-muted-foreground">
                Non-secret — safe to expose to the client for Stripe.js.
              </p>
            </div>
            <SecretKeyInput
              label="Webhook Signing Secret"
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
            <Label className="text-xs">Public App URL</Label>
            <Input
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              className="h-9"
              placeholder="https://your-platform.com"
            />
            <p className="text-[11px] text-muted-foreground">
              Base URL for Stripe Checkout success / cancel redirects. Falls back to STRIPE_APP_URL env
              var or http://localhost:3000.
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
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* -------------------- Webhook endpoint -------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhook Endpoint
          </CardTitle>
          <CardDescription>
            Add this URL to your Stripe Dashboard → Developers → Webhooks. Stripe will fire events
            here when subscriptions change, invoices are paid, payments fail, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs font-mono break-all">
              {data.webhookUrlHint}
            </code>
            <Button variant="outline" size="icon" onClick={copyWebhookUrl} title="Copy">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>Important:</strong> Use the Webhook Signing Secret (<code className="font-mono">whsec_…</code>)
              that Stripe generates for THIS endpoint — paste it into the {mode === 'live' ? 'Live' : 'Test'} Mode Webhook Signing Secret field above.
              Never use the same signing secret across environments.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>
              Events handled: <code className="font-mono">checkout.session.completed</code>,{' '}
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
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">1. Connect Stripe</strong> — enter your Test or Live
            keys above and click Test Connection. Stripe is the source of truth for paid subscription
            state; this platform mirrors it via webhooks.
          </p>
          <p>
            <strong className="text-foreground">2. Plans & Pricing auto-sync</strong> — when you create
            or edit a paid plan, the backend automatically creates the corresponding Stripe Product and
            monthly + yearly Prices and stores the resolved Stripe Price IDs on the plan row. You can
            also manually trigger <em>Sync to Stripe</em> from the Edit Plan dialog.
          </p>
          <p>
            <strong className="text-foreground">3. Checkout is server-side</strong> — the client
            redirects to a Stripe-hosted Checkout Session created by the backend. The frontend and
            backend never touch raw card data.
          </p>
          <p>
            <strong className="text-foreground">4. Webhooks keep everything in sync</strong> — every
            checkout, payment, subscription update, refund, and cancellation is reflected in the local
            DB (Customers, Payments, Dashboard) via idempotent webhook handlers. No mock data — your
            real Stripe state is the only source.
          </p>
          <p>
            <strong className="text-foreground">5. Free plans never touch Stripe</strong> — free
            subscriptions are recorded directly in the DB; no Stripe charges or objects are created.
            Configurable trial periods apply only to paid plans.
          </p>
          <div className="pt-2">
            <a
              href="https://dashboard.stripe.com/apikeys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open Stripe API Keys dashboard
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
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {isSet && masked && (
          <span className="text-[11px] text-muted-foreground font-mono">
            Current: {masked}
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
            placeholder={isSet ? '•••••••• (leave empty to keep current)' : placeholder}
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
        Starts with <code className="font-mono">{prefix}</code>. Encrypted at rest; never returned in
        plaintext.
      </p>
    </div>
  );
}
