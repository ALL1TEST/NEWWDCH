// ============================================================
// PLATFORM BOOTSTRAP — idempotent setup of the platform owner +
// default platform config (plans, feature flags, country pricing).
// ============================================================
// Run once after `db:push`:
//   bun run src/lib/platform/bootstrap.ts
// Safe to re-run: every operation is an upsert / self-seed.
// ============================================================

import { db } from '@/lib/db';
import { ensureHydrated as ensurePlans } from './plan-config';
import { listFeatureFlags } from './feature-flags';
import { listCountries, getDefaultCountry } from './country-pricing';
import { getMaintenanceConfig } from './maintenance';

async function ensureOwner() {
  const email = 'owner@example.com';
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Ensure an existing owner has the OWNER role + INTERNAL billing mode.
    if (existing.role !== 'OWNER' || existing.billingMode !== 'INTERNAL') {
      await db.user.update({
        where: { email },
        data: { role: 'OWNER', billingMode: 'INTERNAL', status: 'ACTIVE' },
      });
      console.log(`  ✓ upgraded existing ${email} → OWNER / INTERNAL`);
    } else {
      console.log(`  ✓ ${email} already OWNER / INTERNAL`);
    }
    return;
  }
  await db.user.create({
    data: {
      email,
      name: 'Platform Owner',
      role: 'OWNER',
      status: 'ACTIVE',
      billingMode: 'INTERNAL',
      // Demo-only plain-text password (matches existing login convention).
      password: 'owner123',
      emailVerified: true,
    },
  });
  console.log(`  ✓ created ${email} (OWNER / INTERNAL, password: owner123)`);
}

async function main() {
  console.log('\n🚀 Bootstrapping platform config...\n');
  await ensureOwner();
  await ensurePlans();
  console.log(`  ✓ plan configs seeded (${(await db.planConfig.count())} rows)`);
  await listFeatureFlags();
  console.log(`  ✓ feature flags seeded (${(await db.featureFlag.count())} rows)`);
  await listCountries();
  await getDefaultCountry();
  console.log(`  ✓ country pricing seeded (${(await db.countryPricing.count())} rows)`);
  await getMaintenanceConfig();
  console.log(`  ✓ maintenance config initialized`);
  console.log('\n✅ Platform bootstrap complete.\n');
  console.log('   Owner login: owner@example.com / owner123');
}

main()
  .catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
