const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const m = await prisma.media.findMany({
    take: 5,
    select: { id: true, filename: true, url: true, mimeType: true, size: true }
  });
  console.log('Sample media:', JSON.stringify(m, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
