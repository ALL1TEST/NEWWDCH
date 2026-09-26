import { NextRequest } from 'next/server';
import { requireAuth, isPlatformStaff, ok } from '@/lib/platform/platform-auth';
import { listEntitlementsForUser, getEffectivePlanIdAsync, type EntitlementUser } from '@/lib/platform/entitlements';
import { getPlanConfigSync } from '@/lib/platform/plan-config';
import { PLAN_EDITOR_FEATURE_KEYS } from '@/lib/platform/feature-config';

// ============================================================
// GET /api/entitlements — the CLIENT's plan Feature Access.
// ============================================================
// The client-side source of truth for Admin User dashboard feature
// visibility. Platform Admin → Plans & Pricing → Feature Access for
// the customer's ACTIVE plan is the SINGLE source of truth for what
// appears in the Admin User dashboard — never the plan's name:
//   entitlements — the granted plan feature keys (normalized; the
//                 legacy 'ai_content' alias is included for compat
//                 with server-side requireFeature gates)
//   features     — the 9 plan-editor Feature Access keys resolved to
//                 booleans (what the sidebar / command palette /
//                 route guard consume via MODULE_FEATURE_MAP)
//   plan         — { id, name } of the effective plan
//
// COSMETIC ONLY: hiding a nav item here is never security — every
// feature API route enforces requireFeature('...') server-side and
// denies with 403 FEATURE_NOT_AVAILABLE. A user manually entering a
// disabled feature's URL is additionally blocked by the client route
// guard (Access Denied), which reads the same entitlements.
//
// Platform staff (OWNER / PLATFORM_ADMIN) get every feature granted
// (owner billing bypass / staff access) — they see the platform nav
// anyway, but any client page they open renders normally.
// ============================================================

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const user: EntitlementUser = {
    id: auth.user.id,
    email: auth.user.email,
    role: auth.user.role,
    billingMode: auth.user.billingMode,
  };

  const staff = isPlatformStaff(auth.user);

  // Staff / owner bypass: full access (mirrors hasFeature's owner
  // bypass so the frontend and the server always agree).
  const entitlements = staff
    ? [...PLAN_EDITOR_FEATURE_KEYS, 'ai_content', 'audit_log']
    : await listEntitlementsForUser(user);

  const { planId } = await getEffectivePlanIdAsync(user);
  const planName = staff ? 'Internal' : getPlanConfigSync(planId).name;

  // Resolve the plan-editor Feature Access keys to booleans for the
  // frontend (never keyed off the plan name — always the actual saved
  // Feature Access configuration of the effective plan).
  const features: Record<string, boolean> = {};
  for (const key of PLAN_EDITOR_FEATURE_KEYS) {
    features[key] = entitlements.includes(key);
  }

  return ok({
    entitlements,
    features,
    plan: { id: planId, name: planName },
    billingMode: auth.user.billingMode,
  });
}
