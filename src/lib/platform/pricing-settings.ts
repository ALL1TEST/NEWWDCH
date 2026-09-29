import { db } from '@/lib/db';
import { SettingScope, SettingsCategory, SettingType } from '@prisma/client';
import { hydrate, savePlanConfig, getPlanConfigSync } from '@/lib/platform/plan-config';

export interface PricingPromotionSettings {
  yearlyDiscountBadge: string;
  yearlyDiscountCustom: boolean;
  trialEnabled: boolean;
  trialDays: number;
  trialCtaText: string;
}

const KEYS = {
  yearlyDiscountBadge: 'pricing_yearly_discount_badge',
  yearlyDiscountCustom: 'pricing_yearly_discount_custom',
  trialEnabled: 'pricing_trial_enabled',
  trialDays: 'pricing_trial_days',
  trialCtaText: 'pricing_trial_cta_text',
} as const;

export async function getPricingPromotionSettings(): Promise<PricingPromotionSettings> {
  const rows = await db.setting.findMany({
    where: {
      scope: SettingScope.GLOBAL,
      key: { in: Object.values(KEYS) },
    },
  });

  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.key, r.value);
  }

  // Check if a free plan already has freePlanDurationDays set in DB
  const freePlan = await db.planConfig.findFirst({
    where: { OR: [{ planId: 'free' }, { isFree: true }] },
    select: { freePlanDurationDays: true },
  });

  const trialDaysRaw = map.get(KEYS.trialDays);
  const trialDays = trialDaysRaw ? Math.max(1, parseInt(trialDaysRaw, 10) || 3) : (freePlan?.freePlanDurationDays ?? 3);

  const trialEnabledRaw = map.get(KEYS.trialEnabled);
  const trialEnabled = trialEnabledRaw !== undefined
    ? trialEnabledRaw === 'true'
    : Boolean(freePlan?.freePlanDurationDays && freePlan.freePlanDurationDays > 0);

  const yearlyDiscountBadge = map.get(KEYS.yearlyDiscountBadge) ?? '-79%';
  const yearlyDiscountCustom = map.get(KEYS.yearlyDiscountCustom) !== undefined
    ? map.get(KEYS.yearlyDiscountCustom) === 'true'
    : true;

  const trialCtaText = map.get(KEYS.trialCtaText) || `Start ${trialDays}-day free trial`;

  return {
    yearlyDiscountBadge,
    yearlyDiscountCustom,
    trialEnabled,
    trialDays,
    trialCtaText,
  };
}

export async function updatePricingPromotionSettings(
  patch: Partial<PricingPromotionSettings>,
): Promise<PricingPromotionSettings> {
  const current = await getPricingPromotionSettings();
  const next: PricingPromotionSettings = {
    yearlyDiscountBadge: patch.yearlyDiscountBadge !== undefined ? patch.yearlyDiscountBadge.trim() : current.yearlyDiscountBadge,
    yearlyDiscountCustom: patch.yearlyDiscountCustom !== undefined ? patch.yearlyDiscountCustom : current.yearlyDiscountCustom,
    trialEnabled: patch.trialEnabled !== undefined ? patch.trialEnabled : current.trialEnabled,
    trialDays: patch.trialDays !== undefined ? Math.max(1, Number(patch.trialDays) || 3) : current.trialDays,
    trialCtaText: patch.trialCtaText !== undefined ? patch.trialCtaText.trim() : current.trialCtaText,
  };

  // Upsert settings in DB
  const settingsToUpsert = [
    { key: KEYS.yearlyDiscountBadge, value: next.yearlyDiscountBadge, type: SettingType.STRING },
    { key: KEYS.yearlyDiscountCustom, value: String(next.yearlyDiscountCustom), type: SettingType.BOOLEAN },
    { key: KEYS.trialEnabled, value: String(next.trialEnabled), type: SettingType.BOOLEAN },
    { key: KEYS.trialDays, value: String(next.trialDays), type: SettingType.NUMBER },
    { key: KEYS.trialCtaText, value: next.trialCtaText, type: SettingType.STRING },
  ];

  for (const s of settingsToUpsert) {
    const existing = await db.setting.findFirst({
      where: { key: s.key, scope: SettingScope.GLOBAL },
    });
    if (existing) {
      await db.setting.update({
        where: { id: existing.id },
        data: { value: s.value },
      });
    } else {
      await db.setting.create({
        data: {
          key: s.key,
          value: s.value,
          scope: SettingScope.GLOBAL,
          type: s.type,
          category: SettingsCategory.GENERAL,
        },
      });
    }
  }

  // Sync to Free plan config (if trialEnabled, freePlanDurationDays = trialDays, else null for lifetime free)
  const freePlans = await db.planConfig.findMany({
    where: { planId: 'free' },
  });

  for (const fp of freePlans) {
    const duration = next.trialEnabled ? next.trialDays : null;
    await savePlanConfig(fp.planId, {
      freePlanDurationDays: duration,
    });
  }

  await hydrate();
  return next;
}
