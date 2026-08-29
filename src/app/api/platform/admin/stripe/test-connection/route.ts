import { NextRequest } from 'next/server';
import { requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import { testStripeConnection, type StripeSettingsInput } from '@/lib/stripe';
import { logAdminAction } from '@/lib/platform/audit';

// ============================================================
// PLATFORM ADMIN → STRIPE TEST CONNECTION.
// ============================================================
// POST /api/platform/admin/stripe/test-connection
//   Body (optional): StripeSettingsInput (when testing UNSAVED
//   credentials the admin just typed into the form). When the
//   body is empty, tests the CURRENTLY SAVED credentials.
//
// Pings Stripe's read-only /v1/balance endpoint (and tries
// /v1/account for richer info) using a TEMPORARY Stripe client
// constructed from the supplied/stored secret key. NEVER
// affects the live account state. Records the outcome on the
// singleton StripeSettings row so the admin UI can show the
// last test result + timestamp.
//
// Returns:
//   { success: true, mode, accountInfo } on success.
//   { success: false, mode, code, message } on failure (Stripe
//   auth error, network error, malformed key, etc.).
//
// Never throws — all Stripe SDK errors are caught and surfaced
// as `{ success: false, code, message }` so the admin UI can
// show actionable feedback.
// ============================================================

export async function POST(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;

  // Body is optional — when empty, testStripeConnection uses the
  // stored credentials.
  const body = await request.json().catch(() => null);

  let input: StripeSettingsInput | undefined = undefined;
  if (body && typeof body === 'object' && (body.mode || body.secretKeyTest || body.secretKeyLive)) {
    input = {
      mode: body.mode === 'live' ? 'live' : 'test',
      secretKeyTest: body.secretKeyTest,
      secretKeyLive: body.secretKeyLive,
      // We don't need publishable/webhook/appUrl for a connection test —
      // only the secret key is used to authenticate to Stripe.
    };
  }

  const result = await testStripeConnection(input);

  await logAdminAction({
    userId: auth.user.id,
    action: 'stripe.test_connection',
    resourceType: 'StripeSettings',
    resourceId: 'singleton',
    details: result.success
      ? `mode=${result.mode}; success; account_id=${result.accountInfo.id}; country=${result.accountInfo.country || '?'}`
      : `mode=${result.mode}; failed; code=${result.code}; message=${result.message}`,
    ipAddress: getClientIp(request) ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  if (result.success) {
    return ok(result);
  }
  // 200 with success:false so the admin UI can read the error code/message
  // and show actionable feedback (instead of a generic 500).
  return ok(result);
}
