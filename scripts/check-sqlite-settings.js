const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const settings = await prisma.setting.findMany({
    where: { key: 'enable_comments' }
  });
  console.log('SQLite settings for enable_comments:', settings);
}

check().catch(console.error).finally(() => prisma.$disconnect());
