// ============================================================
// MAINTENANCE MODE — platform-wide toggle.
// ============================================================
// When enabled, CLIENT users see a maintenance page while OWNER /
// PLATFORM_ADMIN remain able to access the admin area. Enforced
// server-side via middleware.ts + the API guards. Configuration is
// persisted in the Setting table (key 'platform.maintenance') so it
// survives restarts.
// ============================================================

import { db } from '@/lib/db';
import { hasBillingBypass } from './entitlements';

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  /** Allow admin access during maintenance (always true for owner). */
  allowAdminAccess: boolean;
  scheduledEnd: string | null;
}

const DEFAULT_CONFIG: MaintenanceConfig = {
  enabled: false,
  message: 'We are performing scheduled maintenance. The platform will be back shortly.',
  allowAdminAccess: true,
  scheduledEnd: null,
};

const SETTING_KEY = 'platform.maintenance';

function parseConfig(raw: string | null): MaintenanceConfig {
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<MaintenanceConfig>) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

let _cache: MaintenanceConfig | null = null;
void _cache; // retained for future opt-in caching; reads currently hit DB fresh

/** Always query the DB fresh — never trust a cross-module in-memory cache,
 *  because route handlers and the page server component may live in
 *  different module instances (Turbopack). The Setting row is tiny. */
async function loadConfig(): Promise<MaintenanceConfig> {
  try {
    const row = await db.setting.findFirst({ where: { key: SETTING_KEY, scope: 'GLOBAL' } });
    return parseConfig(row?.value ?? null);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
  return loadConfig();
}

export async function isMaintenanceMode(): Promise<boolean> {
  const cfg = await loadConfig();
  return cfg.enabled;
}

/** Should this request be blocked by maintenance mode? Owner/bypass
 *  users and (optionally) admins are never blocked. */
export async function shouldBlockForMaintenance(user: { role?: string; billingMode?: string } | null | undefined): Promise<boolean> {
  const cfg = await loadConfig();
  if (!cfg.enabled) return false;
  if (hasBillingBypass(user)) return false;
  if (cfg.allowAdminAccess && (user?.role === 'PLATFORM_ADMIN' || user?.role === 'OWNER')) return false;
  return true;
}

export async function setMaintenanceConfig(patch: Partial<MaintenanceConfig>): Promise<MaintenanceConfig> {
  const current = await loadConfig();
  const next: MaintenanceConfig = { ...current, ...patch };
  const existing = await db.setting.findFirst({ where: { key: SETTING_KEY, scope: 'GLOBAL' } });
  if (existing) {
    await db.setting.update({ where: { id: existing.id }, data: { value: JSON.stringify(next) } });
  } else {
    await db.setting.create({
      data: {
        key: SETTING_KEY,
        value: JSON.stringify(next),
        type: 'STRING',
        scope: 'GLOBAL',
        category: 'GENERAL',
        description: 'Platform maintenance mode configuration',
        isEncrypted: false,
        isPublic: true,
      },
    });
  }
  return next;
}

/** No-op kept for callers — reads always hit the DB fresh now. */
export function invalidateMaintenanceCache(): void {
  // intentionally empty
}
