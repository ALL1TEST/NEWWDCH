const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.contentItem.findMany({
    where: {
      OR: [
        { title: { contains: 'Getting Started' } },
        { title: { contains: 'verdangt' } },
        { title: { contains: 'Verdant' } }
      ]
    },
    include: {
      contentType: true,
      featuredImage: true,
    }
  });

  console.log('Found items:');
  for (const it of items) {
    console.log(`- [${it.id}] "${it.title}" (slug: ${it.slug})`);
    console.log(`  contentTypeId: ${it.contentTypeId} (${it.contentType?.name}, slug: ${it.contentType?.slug})`);
    console.log(`  status: ${it.status}, siteId: ${it.siteId}`);
  }

  // Also list all content types
  const types = await prisma.contentType.findMany();
  console.log('\nAll ContentTypes in DB:');
  for (const t of types) {
    console.log(`- [${t.id}] ${t.name} (slug: ${t.slug}) isBuiltIn=${t.isBuiltIn} siteId=${t.siteId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
