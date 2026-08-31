import { db } from '../src/lib/db';
async function main() {
  const plans = await db.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  for (const p of plans) {
    console.log(`\n${p.planId} (${p.name}) active=${p.active} free=${p.isFree} cur=${p.currency} m=${p.priceMonthly} y=${p.priceYearly}`);
    console.log(`  entitlements: ${p.entitlements}`);
    console.log(`  features: ${p.features}`);
    console.log(`  limits: ${p.limits}`);
    console.log(`  stripeM=${p.stripePriceIdMonthly ?? 'null'} stripeY=${p.stripePriceIdYearly ?? 'null'}`);
  }
  const c = await db.countryPricing.findMany();
  console.log(`\n--- Countries: ${c.length} ---`);
  for (const cc of c) {
    console.log(`  ${cc.countryCode} ${cc.countryName} cur=${cc.currency} default=${cc.isDefault} active=${cc.active} regional=${cc.regionalPrices}`);
  }
  const u = await db.user.findMany({ select: { email: true, role: true, billingMode: true, status: true }, orderBy: { email: 'asc' } });
  console.log(`\n--- Users: ${u.length} ---`);
  for (const uu of u) {
    console.log(`  ${uu.email} role=${uu.role} bm=${uu.billingMode} status=${uu.status}`);
  }
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
