import { db } from '../src/lib/db';
async function main() {
  // Delete the test user + any subscription row
  await db.subscription.deleteMany({ where: { userId: { contains: 'test' } } }).catch(() => {});
  const u = await db.user.findUnique({ where: { email: 'freeuser@example.com' } });
  if (u) {
    await db.subscription.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await db.session.deleteMany({ where: { userId: u.id } }).catch(() => {});
    await db.user.delete({ where: { id: u.id } });
    console.log('✓ Deleted test user freeuser@example.com');
  } else {
    console.log('(test user not found — nothing to delete)');
  }
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
