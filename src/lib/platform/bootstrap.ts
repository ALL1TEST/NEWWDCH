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
  const password = 'owner123';
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Ensure an existing owner has the OWNER role + INTERNAL billing mode
    // AND the demo password matches what the login screen fills in.
    if (
      existing.role !== 'OWNER' ||
      existing.billingMode !== 'INTERNAL' ||
      existing.password !== password
    ) {
      await db.user.update({
        where: { email },
        data: { role: 'OWNER', billingMode: 'INTERNAL', status: 'ACTIVE', password },
      });
      console.log(`  ✓ upgraded existing ${email} → OWNER / INTERNAL (password reset to ${password})`);
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
      password,
      emailVerified: true,
    },
  });
  console.log(`  ✓ created ${email} (OWNER / INTERNAL, password: ${password})`);
}

// Second OWNER alias for the "Platform Admin" demo login — same role +
// billing mode as owner@example.com, just a different email/password
// so the login screen's "Platform Admin" button (platform@example.com
// / platform123) authenticates as the platform owner. No separate
// permissions system — both aliases map to the same OWNER role and
// share the same RBAC + entitlement-bypass paths server-side.
async function ensurePlatformOwnerAlias() {
  const email = 'platform@example.com';
  const password = 'platform123';
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (
      existing.role !== 'OWNER' ||
      existing.billingMode !== 'INTERNAL' ||
      existing.password !== password
    ) {
      await db.user.update({
        where: { email },
        data: { role: 'OWNER', billingMode: 'INTERNAL', status: 'ACTIVE', password },
      });
      console.log(`  ✓ upgraded existing ${email} → OWNER / INTERNAL (password reset to ${password})`);
    } else {
      console.log(`  ✓ ${email} already OWNER / INTERNAL`);
    }
    return;
  }
  await db.user.create({
    data: {
      email,
      name: 'Platform Admin',
      role: 'OWNER',
      status: 'ACTIVE',
      billingMode: 'INTERNAL',
      // Demo-only plain-text password (matches existing login convention).
      password,
      emailVerified: true,
    },
  });
  console.log(`  ✓ created ${email} (OWNER / INTERNAL, password: ${password})`);
}

async function main() {
  console.log('\n🚀 Bootstrapping platform config...\n');
  await ensureOwner();
  await ensurePlatformOwnerAlias();
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
  console.log('   Owner login:        owner@example.com / owner123');
  console.log('   Platform Admin:     platform@example.com / platform123');
  console.log('   CMS Admin (client): admin@example.com / admin123');
}

main()
  .catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
