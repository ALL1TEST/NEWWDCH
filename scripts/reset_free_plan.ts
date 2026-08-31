import { db } from '../src/lib/db';
async function main() {
  // Reset Free plan back to 0 entitlements (the canonical default)
  await db.planConfig.update({
    where: { planId: 'free' },
    data: { entitlements: JSON.stringify([]) },
  });
  console.log('✓ Reset Free plan entitlements = [] (canonical default)');
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
