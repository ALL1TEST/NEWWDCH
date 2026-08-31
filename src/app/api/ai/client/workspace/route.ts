import { NextRequest } from 'next/server';
import { requireAuth, ok, isPlatformStaff } from '@/lib/platform/platform-auth';
import { listEntitlementsForUser, getEffectivePlanIdAsync } from '@/lib/platform/entitlements';
import { getAiMonthlyUsage, getEffectiveLimitsAsync } from '@/lib/platform/usage-limits';
import { getPlanConfigSync } from '@/lib/platform/plan-config';

// ============================================================
// GET /api/ai/client/workspace — the CLIENT AI experience state.
// ============================================================
// Server-side source of truth for the client-facing AI page:
//   mode          'unlimited' | 'platform' | 'client' | 'none'
//   entitlements  { aiPlatform, aiClient } — from the user's plan
//   plan          { id, name } — the effective plan
//   limits        { aiArticlesPerMonth, aiImagesPerMonth } — the
//                 Platform AI usage limits (only enforced while the
//                 plan includes Platform AI)
//   usage         { articles, images } — this month's Platform AI
//                 consumption from the AiLog tracker
//
// This endpoint NEVER exposes platform AI configuration (providers,
// API keys, models, settings or prompt templates) — those are
// Platform Admin only (/api/ai/providers, /api/ai/models,
// /api/ai/prompts, /api/ai/settings are gated to platform staff).
// A client without Platform AI sees mode 'client'/'none' here and
// the generation endpoints deny them server-side.
// ============================================================

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const user = auth.user;

  let aiPlatform: boolean;
  let aiClient: boolean;
  let mode: 'unlimited' | 'platform' | 'client' | 'none';
  let plan: { id: string; name: string };

  if (isPlatformStaff(user)) {
    // Platform staff manage/configure the platform AI stack — the
    // workspace opens unlocked (unlimited) for them.
    aiPlatform = true;
    aiClient = true;
    mode = 'unlimited';
    plan = { id: 'internal', name: 'Internal' };
  } else {
    const entitlements = await listEntitlementsForUser(user);
    aiPlatform = entitlements.includes('ai_platform');
    aiClient = entitlements.includes('ai_client');
    mode = aiPlatform ? 'platform' : aiClient ? 'client' : 'none';
    const { planId } = await getEffectivePlanIdAsync(user);
    plan = { id: planId, name: getPlanConfigSync(planId).name };
  }

  const [usage, limits] = await Promise.all([
    getAiMonthlyUsage(user.id),
    getEffectiveLimitsAsync(user),
  ]);

  return ok({
    mode,
    entitlements: { aiPlatform, aiClient },
    plan,
    limits: {
      aiArticlesPerMonth: limits.aiArticlesPerMonth,
      aiImagesPerMonth: limits.aiImagesPerMonth,
    },
    usage,
  });
}
