const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  const result = await prisma.comment.findMany({ where: { status: 'TRASH' } });
  console.log('TRASH query success, count:', result.length);
}
test().catch(console.error).finally(() => prisma.$disconnect());
