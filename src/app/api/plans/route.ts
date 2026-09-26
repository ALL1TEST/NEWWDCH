import { db } from '@/lib/db';
import { ok, fail } from '@/lib/platform/platform-auth';
import { aiModeOfEntitlements } from '@/lib/platform/feature-config';

// ============================================================
// GET /api/plans — PUBLIC pricing data for the marketing site.
// ============================================================
// Read-only, unauthenticated. Returns the ACTIVE PlanConfigs with
// exactly the fields the public pricing page needs — no Stripe
// price IDs, no per-currency tables, no internal entitlement keys.
//
// Shape (ApiResponse envelope, `data` unwrapped by getApi):
//   {
//     currency: 'CHF',
//     plans: Array<{
//       planId, name, description, priceMonthly, priceYearly,
//       isFree, badgeVariant, sortOrder,
//       limits: { maxSites, storageBytes, aiArticlesPerMonth, aiImagesPerMonth },
//       features: {
//         ai: 'none' | 'platform' | 'client',
//         newsletter, comments, automation, backups,
//         emailTemplates, advancedAnalytics, advancedSeo, auditLog
//       }
//     }>
//   }
//
// `features` is the PUBLIC-SAFE projection of the plan's internal
// entitlement list — booleans plus the AI mode — so the pricing
// page's comparison table renders from the product's own
// configuration. Prices, limits AND feature flags all stay
// database-driven; nothing is hardcoded on the client.
//
// The marketing pricing page MUST render from THIS endpoint (the
// product's own configuration) — never hardcoded prices.
// ============================================================

interface PublicPlanFeatures {
  /** AI availability: 'none' = no AI, 'platform' = metered
   *  Platform AI, 'client' = bring-your-own provider keys
   *  (unlimited through the client's own API, never metered). */
  ai: 'none' | 'platform' | 'client';
  newsletter: boolean;
  comments: boolean;
  automation: boolean;
  backups: boolean;
  emailTemplates: boolean;
  advancedAnalytics: boolean;
  advancedSeo: boolean;
  auditLog: boolean;
}

interface PublicPlan {
  planId: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  isFree: boolean;
  badgeVariant: string;
  sortOrder: number;
  limits: {
    maxSites: number;
    storageBytes: number;
    aiArticlesPerMonth: number;
    aiImagesPerMonth: number;
  };
  features: PublicPlanFeatures;
}

export async function GET() {
  try {
    const rows = await db.planConfig.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        planId: true,
        name: true,
        features: true,
        entitlements: true,
        priceMonthly: true,
        priceYearly: true,
        currency: true,
        isFree: true,
        badgeVariant: true,
        sortOrder: true,
        limits: true,
      },
    });

    // Group currency from the first row (single default currency for
    // the public page; per-currency regional pricing is a checkout
    // concern, not a marketing one).
    const currency = rows[0]?.currency ?? 'CHF';

    const plans: PublicPlan[] = rows.map((r) => {
      let limits: PublicPlan['limits'] = {
        maxSites: 0,
        storageBytes: 0,
        aiArticlesPerMonth: 0,
        aiImagesPerMonth: 0,
      };
      try {
        const parsed = typeof r.limits === 'string' ? JSON.parse(r.limits) : r.limits;
        if (parsed && typeof parsed === 'object') {
          limits = {
            maxSites: Number(parsed.maxSites ?? 0),
            storageBytes: Number(parsed.storageBytes ?? 0),
            aiArticlesPerMonth: Number(parsed.aiArticlesPerMonth ?? 0),
            aiImagesPerMonth: Number(parsed.aiImagesPerMonth ?? 0),
          };
        }
      } catch {
        // limits stays the zero-default; pricing page renders '—'
      }

      // Entitlements (JSON string[]) → public-safe feature map.
      let entitlements: string[] = [];
      try {
        const parsed = typeof r.entitlements === 'string' ? JSON.parse(r.entitlements) : r.entitlements;
        if (Array.isArray(parsed)) entitlements = parsed.map(String);
      } catch {
        // entitlements stays []; features render as 'not included'
      }
      const has = (key: string) => entitlements.includes(key);
      const features: PublicPlanFeatures = {
        ai: aiModeOfEntitlements(entitlements),
        newsletter: has('newsletter'),
        comments: has('comments'),
        automation: has('automation'),
        backups: has('backups'),
        emailTemplates: has('email_templates'),
        advancedAnalytics: has('advanced_analytics'),
        advancedSeo: has('advanced_seo'),
        auditLog: has('audit_log'),
      };

      // `features` (JSON string[]) holds the derived marketing copy
      // lines configured in Platform Admin → Plans & Pricing.
      let description = '';
      try {
        const feats = typeof r.features === 'string' ? JSON.parse(r.features) : r.features;
        if (Array.isArray(feats) && feats.length > 0) {
          description = String(feats[0]);
        }
      } catch {
        // description stays ''
      }

      return {
        planId: r.planId,
        name: r.name,
        description,
        priceMonthly: r.priceMonthly,
        priceYearly: r.priceYearly,
        isFree: r.isFree,
        badgeVariant: r.badgeVariant,
        sortOrder: r.sortOrder,
        limits,
        features,
      };
    });

    return ok({ currency, plans });
  } catch {
    return fail('PLANS_UNAVAILABLE', 'Pricing is temporarily unavailable', 503);
  }
}
