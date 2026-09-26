import { db } from '../src/lib/db';
async function main() {
  const u = await db.user.findMany({ select: { email: true, role: true, billingMode: true, status: true, password: true }, orderBy: { email: 'asc' } });
  for (const uu of u) {
    console.log(`${uu.email} role=${uu.role} bm=${uu.billingMode} status=${uu.status} pw=${uu.password}`);
  }
  const s = await db.subscription.findMany({ include: { user: { select: { email: true } } } });
  console.log(`\n--- Subscriptions (${s.length}) ---`);
  for (const ss of s) {
    console.log(`  ${ss.user.email} plan=${ss.planId} status=${ss.status}`);
  }
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
