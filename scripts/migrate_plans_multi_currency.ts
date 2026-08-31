import { db } from '../src/lib/db';

const PRICES: Record<string, Record<string, { monthly: number; yearly: number }>> = {
  free: {
    CHF: { monthly: 0, yearly: 0 },
    USD: { monthly: 0, yearly: 0 },
    EUR: { monthly: 0, yearly: 0 },
    MAD: { monthly: 0, yearly: 0 },
  },
  plus: {
    CHF: { monthly: 9, yearly: 90 },
    USD: { monthly: 10, yearly: 100 },
    EUR: { monthly: 9, yearly: 90 },
    MAD: { monthly: 90, yearly: 900 },
  },
  pro: {
    CHF: { monthly: 49, yearly: 490 },
    USD: { monthly: 55, yearly: 550 },
    EUR: { monthly: 45, yearly: 450 },
    MAD: { monthly: 490, yearly: 4900 },
  },
  max: {
    CHF: { monthly: 99, yearly: 990 },
    USD: { monthly: 109, yearly: 1090 },
    EUR: { monthly: 92, yearly: 920 },
    MAD: { monthly: 990, yearly: 9900 },
  },
};

async function main() {
  const plans = await db.planConfig.findMany();
  console.log(`Migrating ${plans.length} plans to multi-currency prices...`);
  for (const p of plans) {
    const prices = PRICES[p.planId] ?? PRICES.pro;
    const patch: Record<string, unknown> = {
      pricesByCurrency: JSON.stringify(prices),
      stripePriceIdsByCurrency: '{}',
    };
    // Snapshot default currency (CHF) into the legacy fields.
    if (prices.CHF) {
      patch.priceMonthly = prices.CHF.monthly;
      patch.priceYearly = prices.CHF.yearly;
    }
    // Clear the old stripePriceIdMonthly/Yearly snapshot (they'll be re-populated on next sync).
    patch.stripePriceIdMonthly = null;
    patch.stripePriceIdYearly = null;
    // Drop the legacy 'features' marketing copy — derived from entitlements on the client side now.
    patch.features = '[]';
    await db.planConfig.update({ where: { planId: p.planId }, data: patch });
    console.log(`  ✓ ${p.planId}: pricesByCurrency=${JSON.stringify(prices)}`);
  }
  // Verify
  const after = await db.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log('\n--- After migration ---');
  for (const p of after) {
    console.log(`  ${p.planId}: cur=${p.currency} m=${p.priceMonthly} y=${p.priceYearly} pricesByCur=${p.pricesByCurrency}`);
  }
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
