const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.contentItem.findUnique({
    where: { id: 'cmuc02x0r004rk9tgstnztju9' },
    include: {
      author: true,
      category: true,
      featuredImage: true,
    }
  });
  if (!c) {
    console.log('Article not found in CMS DB');
    return;
  }
  console.log('Title:', c.title);
  console.log('Slug:', c.slug);
  console.log('Excerpt:', c.excerpt);
  console.log('CoverImage:', c.featuredImage?.url || 'none');
  console.log('Content total length:', c.content ? c.content.length : 0);
  console.log('Content preview (first 1000 chars):');
  console.log(c.content ? c.content.slice(0, 1000) : 'null');
  console.log('\n--- Content preview (last 500 chars):');
  console.log(c.content ? c.content.slice(-500) : 'null');
}

main().catch(console.error).finally(() => prisma.$disconnect());
