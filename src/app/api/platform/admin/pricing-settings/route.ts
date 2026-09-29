import { NextRequest } from 'next/server';
import { requirePlatformAdmin, requireOwner, ok, fail, getClientIp } from '@/lib/platform/platform-auth';
import {
  getPricingPromotionSettings,
  updatePricingPromotionSettings,
} from '@/lib/platform/pricing-settings';
import { logAdminAction } from '@/lib/platform/audit';

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  try {
    const settings = await getPricingPromotionSettings();
    return ok(settings);
  } catch (err) {
    return fail('INTERNAL_ERROR', 'Failed to load pricing promotion settings.', 500);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('response' in auth) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const updated = await updatePricingPromotionSettings(body);

    await logAdminAction({
      userId: auth.user.id,
      action: 'pricing.promotions_update',
      resourceType: 'PricingSettings',
      resourceId: 'promotions',
      details: `Yearly badge: "${updated.yearlyDiscountBadge}" (custom: ${updated.yearlyDiscountCustom}), Free trial: ${updated.trialEnabled} (${updated.trialDays} days, cta: "${updated.trialCtaText}")`,
      ipAddress: getClientIp(request) ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return ok(updated);
  } catch (err) {
    return fail('INTERNAL_ERROR', 'Failed to update pricing promotion settings.', 500);
  }
}
