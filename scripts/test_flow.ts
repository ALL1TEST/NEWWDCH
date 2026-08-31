// Test scenario:
// A. Set Free plan to have ONLY 1 feature ('advanced_analytics')
// B. Verify a Free user gets 200 on /api/analytics, 403 on /api/automations, 403 on /api/ai/jobs
// C. Verify Platform Admin (platform@example.com, OWNER/INTERNAL) gets 200 on all
import { db } from '../src/lib/db';
async function main() {
  // A. Set Free plan to have ONLY 1 feature ('advanced_analytics')
  const free = await db.planConfig.findUnique({ where: { planId: 'free' } });
  if (!free) throw new Error('free plan missing');
  await db.planConfig.update({
    where: { planId: 'free' },
    data: { entitlements: JSON.stringify(['advanced_analytics']) },
  });
  console.log('✓ Set Free plan entitlements = ["advanced_analytics"]');
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
