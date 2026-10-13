const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const count = await prisma.$executeRawUnsafe(
    'UPDATE Comment SET status = ? WHERE id IN (?)',
    'TRASH',
    'cmuzdefaa0000le06nk7siie9'
  );
  console.log('ExecuteRaw count:', count);
  const row = await prisma.$queryRawUnsafe('SELECT id, status FROM Comment WHERE id = ?', 'cmuzdefaa0000le06nk7siie9');
  console.log('Row after update:', row);
}

test().catch(console.error).finally(() => prisma.$disconnect());
