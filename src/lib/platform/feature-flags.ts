// ============================================================
// FEATURE FLAGS — platform-level feature toggles.
// ============================================================
// Distinct from entitlements: an entitlement = whether a CUSTOMER is
// allowed to use something (plan-based). A feature flag = whether the
// PLATFORM has the feature enabled at all (rolled out). Both must be
// true for a gated capability to be available.
// ============================================================

import { db } from '@/lib/db';

export interface FeatureFlagRow {
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  targetType: string;
  targetValue: string | null;
}

const DEFAULT_FLAGS: FeatureFlagRow[] = [
  { key: 'ai_v2', name: 'AI v2 Engine', description: 'Next-generation AI content engine', isEnabled: false, targetType: 'ROLE', targetValue: null },
  { key: 'new_editor', name: 'New Block Editor', description: 'Redesigned content editor', isEnabled: false, targetType: 'ROLE', targetValue: null },
  { key: 'new_analytics', name: 'New Analytics Dashboard', description: 'Revamped analytics experience', isEnabled: false, targetType: 'ROLE', targetValue: null },
];

let _cache: Map<string, boolean> | null = null;
let _hydrated = false;

async function ensureCache(): Promise<Map<string, boolean>> {
  if (_cache && _hydrated) return _cache;
  _cache = new Map();
  try {
    const rows = await db.featureFlag.findMany();
    if (rows.length === 0) {
      // Self-seed defaults.
      await db.featureFlag.createMany({
        data: DEFAULT_FLAGS.map((f) => ({
          key: f.key,
          name: f.name,
          description: f.description,
          isEnabled: f.isEnabled,
          targetType: 'ROLE',
          targetValue: f.targetValue,
        })),
      });
      for (const f of DEFAULT_FLAGS) _cache.set(f.key, f.isEnabled);
    } else {
      for (const r of rows) _cache.set(r.key, r.isEnabled);
    }
  } catch {
    // ignore — flags default off
  }
  _hydrated = true;
  return _cache;
}

export async function isFlagEnabled(key: string): Promise<boolean> {
  const cache = await ensureCache();
  return cache.get(key) ?? false;
}

export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  await ensureCache();
  const rows = await db.featureFlag.findMany({ orderBy: { key: 'asc' } });
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description,
    isEnabled: r.isEnabled,
    targetType: r.targetType,
    targetValue: r.targetValue,
  }));
}

export async function setFeatureFlag(key: string, isEnabled: boolean): Promise<void> {
  await db.featureFlag.update({ where: { key }, data: { isEnabled } }).catch(() => undefined);
  if (_cache) _cache.set(key, isEnabled);
}
