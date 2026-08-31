import { db } from '../src/lib/db';
async function main() {
  const plans = await db.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log(`=== Plans (${plans.length}) ===`);
  for (const p of plans) {
    console.log(`\n${p.planId} (${p.name})`);
    console.log(`  active=${p.active} free=${p.isFree} cur=${p.currency}`);
    console.log(`  m=${p.priceMonthly} y=${p.priceYearly}`);
    console.log(`  pricesByCurrency=${p.pricesByCurrency}`);
    console.log(`  stripePriceIdsByCurrency=${p.stripePriceIdsByCurrency}`);
    console.log(`  entitlements=${p.entitlements}`);
    console.log(`  features=${p.features}`);
  }
  const c = await db.countryPricing.findMany({ orderBy: { countryName: 'asc' } });
  console.log(`\n=== Countries (${c.length}) ===`);
  for (const cc of c) {
    console.log(`  ${cc.countryCode} ${cc.countryName} cur=${cc.currency} default=${cc.isDefault} active=${cc.active}`);
  }
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
