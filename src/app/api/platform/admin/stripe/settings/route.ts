import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import {
  getStripeSettingsForAdmin,
  saveStripeSettings,
  isStripeConfiguredAsync,
  isMaskedSecretValue,
  type StripeSettingsInput,
} from '@/lib/stripe';
import { logAdminAction } from '@/lib/platform/audit';

// ============================================================
// PLATFORM ADMIN → STRIPE SETTINGS (singleton credentials).
// ============================================================
// GET  /api/platform/admin/stripe/settings
//   Returns the masked view of the current Stripe credentials +
//   the last Test Connection outcome + webhook URL hint. NEVER
//   returns raw secret keys (the masked form is safe for the
//   admin UI to render; secret keys are AES-256-GCM encrypted
//   in the DB and only ever decrypted server-side inside
//   /lib/stripe.ts when constructing the Stripe SDK client).
//
// PUT  /api/platform/admin/stripe/settings
//   Owner-only. Body: {
//     mode: 'test' | 'live',
//     secretKeyTest?: string,    // empty = leave unchanged, null = clear
//     secretKeyLive?: string,    // empty = leave unchanged, null = clear
//     publishableKeyTest?: string,
//     publishableKeyLive?: string,
//     webhookSecretTest?: string,
//     webhookSecretLive?: string,
//     appUrl?: string,
//   }
//   Encrypts secret keys (sk_test_, sk_live_, whsec_) via
//   /lib/encryption and upserts the singleton row. Publishable
//   keys (pk_test_, pk_live_) are non-secret and stored as
//   plaintext. After save, invalidates the in-memory cache so
//   the next getStripeClient() reads the new credentials. Returns
//   the masked view (same shape as GET).
// ============================================================

export async function GET(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const settings = await getStripeSettingsForAdmin();
  const configured = await isStripeConfiguredAsync();
  return ok({
    ...settings,
    isConfigured: configured,
    // Construct the public webhook URL hint so the admin can copy
    // it into the Stripe dashboard. Uses the request's host so it
    // works in any deployment.
    webhookUrlHint: buildWebhookUrlHint(request),
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;
  const body = await request.json().catch(() => ({}));

  const mode = body.mode === 'live' ? 'live' : 'test';
  // Validate the shapes of provided keys (only when non-empty — empty
  // means "leave unchanged"). Surface clear errors for malformed
  // secret/publishable keys so the admin knows what to fix BEFORE
  // the credentials are persisted + cached.
  const checks: Array<{ value: string | undefined; label: string; prefix: string[]; required: boolean }> = [
    { value: body.secretKeyTest, label: 'Secret Key (Test)', prefix: ['sk_test_', 'rk_test_'], required: false },
    { value: body.secretKeyLive, label: 'Secret Key (Live)', prefix: ['sk_live_', 'rk_live_'], required: false },
    { value: body.publishableKeyTest, label: 'Publishable Key (Test)', prefix: ['pk_test_'], required: false },
    { value: body.publishableKeyLive, label: 'Publishable Key (Live)', prefix: ['pk_live_'], required: false },
    { value: body.webhookSecretTest, label: 'Webhook Secret (Test)', prefix: ['whsec_'], required: false },
    { value: body.webhookSecretLive, label: 'Webhook Secret (Live)', prefix: ['whsec_'], required: false },
  ];
  for (const c of checks) {
    if (c.value === undefined || c.value === null) continue; // null = clear, allowed
    if (c.value === '') continue; // empty = leave unchanged, allowed
    // Reject masked values (admin copy-pasted the masked display form
    // back into the input). The masked form contains the bullet char
    // (•, U+2022) used by `maskSecret` — it would be encrypted as the
    // masked string and silently break every subsequent Stripe API
    // call with "Invalid API Key provided". Surface a clear error.
    if (isMaskedSecretValue(c.value)) {
      return fail(
        'VALIDATION_ERROR',
        `${c.label} looks like a masked value (contains the • character). Re-enter the full, real Stripe key — do not copy the masked form.`,
        400,
      );
    }
    if (!c.prefix.some((p) => c.value!.startsWith(p))) {
      return fail(
        'VALIDATION_ERROR',
        `${c.label} must start with ${c.prefix.join(' or ')}.`,
        400,
      );
    }
  }

  const input: StripeSettingsInput = {
    mode,
    secretKeyTest: body.secretKeyTest,
    secretKeyLive: body.secretKeyLive,
    publishableKeyTest: body.publishableKeyTest,
    publishableKeyLive: body.publishableKeyLive,
    webhookSecretTest: body.webhookSecretTest,
    webhookSecretLive: body.webhookSecretLive,
    appUrl: body.appUrl,
  };

  try {
    const view = await saveStripeSettings(input, auth.user.id);
    await logAdminAction({
      userId: auth.user.id,
      action: 'stripe.settings_updated',
      resourceType: 'StripeSettings',
      resourceId: 'singleton',
      // Never log raw secrets — only the mode + which credentials were set.
      // "set" means a non-empty value was provided for that field. The
      // masked form is in `view` and is safe to log.
      details: `mode=${mode}; test: sk=${view.hasSecretKeyTest ? 'set' : 'unset'} pk=${view.hasPublishableKeyTest ? 'set' : 'unset'} whsec=${view.hasWebhookSecretTest ? 'set' : 'unset'}; live: sk=${view.hasSecretKeyLive ? 'set' : 'unset'} pk=${view.hasPublishableKeyLive ? 'set' : 'unset'} whsec=${view.hasWebhookSecretLive ? 'set' : 'unset'}`,
      ipAddress: getClientIp(request) ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return ok(view);
  } catch (err) {
    return fail(
      'SERVER_ERROR',
      err instanceof Error ? err.message : 'Unable to save Stripe settings.',
      500,
    );
  }
}

/** Build the public webhook URL hint for the admin UI to display.
 *  Uses the request's host header so it works in any deployment
 *  (localhost, custom domain, etc.). */
function buildWebhookUrlHint(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}/api/webhooks/stripe`;
}
