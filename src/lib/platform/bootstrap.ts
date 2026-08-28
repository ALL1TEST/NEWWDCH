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

// Seed realistic demo coupons so the Platform Admin Coupons page is
// populated on first run. Idempotent — only inserts when the table is
// empty, so re-running the bootstrap never duplicates coupons.
const DEMO_COUPONS: Array<{
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  currency: string;
  applicablePlans: string[];
  startsAt: Date | null;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  active: boolean;
  timesRedeemed: number;
}> = [
  // Welcome — 10% off all plans, popular, limited
  { code: 'WELCOME10', type: 'percent', value: 10, currency: 'CHF', applicablePlans: [], startsAt: daysAgo(30), expiresAt: daysAhead(60), maxRedemptions: 100, perCustomerLimit: 1, active: true, timesRedeemed: 23 },
  // Beta launch — 50% off Beta only, short window
  { code: 'BETA50', type: 'percent', value: 50, currency: 'CHF', applicablePlans: ['beta'], startsAt: daysAgo(15), expiresAt: daysAhead(15), maxRedemptions: null, perCustomerLimit: 1, active: true, timesRedeemed: 8 },
  // Pro upgrade — 25% off Pro, evergreen
  { code: 'PRO25', type: 'percent', value: 25, currency: 'CHF', applicablePlans: ['pro'], startsAt: daysAgo(10), expiresAt: null, maxRedemptions: 500, perCustomerLimit: null, active: true, timesRedeemed: 41 },
  // Max fixed discount — CHF 100 off Max
  { code: 'MAX100', type: 'fixed', value: 100, currency: 'CHF', applicablePlans: ['max'], startsAt: daysAgo(5), expiresAt: daysAhead(90), maxRedemptions: 50, perCustomerLimit: 1, active: true, timesRedeemed: 3 },
  // Summer campaign — 20% off all plans, high volume
  { code: 'SUMMER20', type: 'percent', value: 20, currency: 'CHF', applicablePlans: [], startsAt: daysAgo(20), expiresAt: daysAhead(45), maxRedemptions: 200, perCustomerLimit: null, active: true, timesRedeemed: 87 },
  // Yearly push — 15% off all plans, evergreen, per-customer limit
  { code: 'YEARLY15', type: 'percent', value: 15, currency: 'CHF', applicablePlans: [], startsAt: null, expiresAt: null, maxRedemptions: null, perCustomerLimit: 1, active: true, timesRedeemed: 12 },
  // Friends & family — 30% off Pro + Max
  { code: 'FRIENDS30', type: 'percent', value: 30, currency: 'CHF', applicablePlans: ['pro', 'max'], startsAt: daysAgo(7), expiresAt: daysAhead(120), maxRedemptions: 50, perCustomerLimit: null, active: true, timesRedeemed: 5 },
  // Expired launch coupon — inactive, already fully redeemed
  { code: 'LAUNCH25', type: 'fixed', value: 25, currency: 'CHF', applicablePlans: [], startsAt: daysAgo(90), expiresAt: daysAgo(1), maxRedemptions: 100, perCustomerLimit: null, active: false, timesRedeemed: 100 },
  // Flash weekend — 40% off, very short, unused
  { code: 'FLASH40', type: 'percent', value: 40, currency: 'CHF', applicablePlans: [], startsAt: daysAhead(2), expiresAt: daysAhead(4), maxRedemptions: 25, perCustomerLimit: 1, active: true, timesRedeemed: 0 },
];

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9, 15, 0, 0);
  return d;
}
function daysAhead(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 15, 0, 0);
  return d;
}

async function seedCoupons() {
  const existing = await db.coupon.count();
  if (existing > 0) {
    console.log(`  ✓ coupons already seeded (${existing} rows) — skipping`);
    return;
  }
  for (const c of DEMO_COUPONS) {
    await db.coupon.create({
      data: {
        code: c.code,
        type: c.type,
        value: c.value,
        currency: c.currency,
        applicablePlans: JSON.stringify(c.applicablePlans),
        startsAt: c.startsAt,
        expiresAt: c.expiresAt,
        maxRedemptions: c.maxRedemptions,
        perCustomerLimit: c.perCustomerLimit,
        active: c.active,
        timesRedeemed: c.timesRedeemed,
      },
    });
  }
  console.log(`  ✓ seeded ${DEMO_COUPONS.length} demo coupons`);
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
  await seedCoupons();
  console.log(`  ✓ coupons seeded (${(await db.coupon.count())} rows)`);
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
