// ============================================================
// ONE-OFF MIGRATION — Plan Feature Access architecture update.
// ============================================================
// 1. Strip the legacy 'custom_domains' / 'white_label' entitlement
//    keys from every PlanConfig row (site identity is client-owned,
//    not a plan entitlement — the runtime cache already strips them
//    on load via normalizeEntitlementKeys; this aligns the stored
//    rows so persistence matches).
// 2. Align the canonical rows (free/plus/pro/max) with the updated
//    DEFAULT_PLAN_CONFIGS entitlement examples, including the new
//    'comments' feature entitlement.
// Custom (non-canonical) rows keep their entitlements — minus the
// removed keys.
// Idempotent: safe to re-run.
// ============================================================

import { db } from '../src/lib/db';

const NEW_CANONICAL_ENTITLEMENTS: Record<string, string[]> = {
  free: [],
  plus: ['ai_platform', 'advanced_analytics', 'comments', 'newsletter'],
  pro: [
    'ai_platform',
    'advanced_analytics',
    'automation',
    'comments',
    'newsletter',
    'email_templates',
    'backups',
  ],
  max: [
    'ai_client',
    'advanced_analytics',
    'automation',
    'comments',
    'api_access',
    'audit_log',
    'advanced_seo',
    'newsletter',
    'email_templates',
    'backups',
  ],
};

const REMOVED_KEYS = new Set(['custom_domains', 'white_label']);

async function main() {
  const rows = await db.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  const report: string[] = [];

  for (const row of rows) {
    let entitlements: string[] = [];
    try {
      entitlements = JSON.parse(row.entitlements || '[]');
    } catch {
      entitlements = [];
    }

    const canonical = NEW_CANONICAL_ENTITLEMENTS[row.planId];
    if (canonical) {
      // Canonical rows → align exactly with the new model.
      const next = [...canonical];
      if (JSON.stringify(next) !== JSON.stringify(entitlements)) {
        await db.planConfig.update({
          where: { id: row.id },
          data: { entitlements: JSON.stringify(next) },
        });
        report.push(`${row.planId}: aligned to new Feature Access model (${next.length} keys)`);
      } else {
        report.push(`${row.planId}: already up to date`);
      }
      continue;
    }

    // Custom rows → only strip the removed legacy keys.
    const next = entitlements.filter((k) => !REMOVED_KEYS.has(k));
    if (next.length !== entitlements.length) {
      await db.planConfig.update({
        where: { id: row.id },
        data: { entitlements: JSON.stringify(next) },
      });
      report.push(`${row.planId}: stripped ${entitlements.length - next.length} legacy key(s)`);
    } else {
      report.push(`${row.planId}: no legacy keys, untouched`);
    }
  }

  console.log('=== PLAN FEATURE ACCESS MIGRATION ===');
  for (const line of report) console.log(' -', line);

  // Verify final state.
  const finalRows = await db.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  for (const row of finalRows) {
    const ents: string[] = JSON.parse(row.entitlements || '[]');
    const hasRemoved = ents.some((k) => REMOVED_KEYS.has(k));
    console.log(
      `  ${row.planId.padEnd(8)} -> [${ents.join(', ')}]${hasRemoved ? '  ⚠ STILL HAS REMOVED KEYS' : ''}`,
    );
  }
  console.log('=== DONE ===');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
