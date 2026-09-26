const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectImages() {
  const item = await prisma.contentItem.findUnique({
    where: { id: 'cmuc02x0r004rk9tgstnztju9' },
    select: { content: true }
  });
  if (!item || !item.content) return console.log('No item/content');
  const imgMatches = [...item.content.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
  console.log('Total img tags in content:', imgMatches.length);
  imgMatches.forEach((m, i) => {
    const src = m[1];
    const isBase64 = src.startsWith('data:');
    const fullTag = m[0];
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    console.log(`Image ${i + 1}:`, isBase64 ? `Base64 (${src.length} chars)` : src, 'Alt:', altMatch ? altMatch[1] : 'none');
  });
}

inspectImages().catch(console.error).finally(() => prisma.$disconnect());
