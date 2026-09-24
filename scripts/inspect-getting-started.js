const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const it = await prisma.contentItem.findUnique({
    where: { id: 'cmudat7tr0015k9hothsvoars' },
    include: { featuredImage: true }
  });
  if (!it) return;
  console.log('Title:', it.title);
  console.log('CoverImage:', it.featuredImage?.url);
  console.log('Content length:', it.content?.length);
  console.log('Has base64:', it.content?.includes('base64'));
  const imgMatches = [...(it.content || '').matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
  console.log('Total img tags in content:', imgMatches.length);
  imgMatches.forEach((m, idx) => {
    console.log(`Image ${idx + 1}:`, m[1].startsWith('data:') ? `Base64 (${m[1].length} chars)` : m[1]);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
