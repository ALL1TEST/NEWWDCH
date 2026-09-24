const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contentItem.findUnique({
    where: { id: 'cmuc02x0r004rk9tgstnztju9' },
    include: { featuredImage: true }
  });
  console.log('Title:', c.title);
  console.log('Cover image URL:', c.featuredImage?.url);
  console.log('Content length:', c.content?.length);
  console.log('Contains base64:', c.content?.includes('base64'));
  console.log('Content preview:\n', c.content?.slice(0, 500));
}

main().catch(console.error).finally(() => prisma.$disconnect());
