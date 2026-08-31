import { db } from '../src/lib/db';
import { nanoid } from 'nanoid';

async function main() {
  const email = 'freeuser@example.com';
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ ${email} already exists (id=${existing.id})`);
    await db.$disconnect();
    return;
  }
  const u = await db.user.create({
    data: {
      email,
      name: 'Free Test User',
      role: 'CLIENT',
      status: 'ACTIVE',
      billingMode: 'EXTERNAL',
      password: 'free123',
      emailVerified: true,
    },
  });
  console.log(`✓ created ${email} (id=${u.id}) role=CLIENT bm=EXTERNAL pw=free123`);
  // NO Subscription row → falls back to 'free' plan via getEffectivePlanIdAsync
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
