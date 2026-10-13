const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.comment.update({
    where: { id: 'cmuyjf8ya0000i906nng88vgb' },
    data: { status: 'PENDING' }
  });
  const comment = await prisma.comment.findUnique({
    where: { id: 'cmuyjf8ya0000i906nng88vgb' }
  });
  console.log('CMS SQLite comment is now:', comment.status);
}

main().catch(console.error).finally(() => prisma.$disconnect());
