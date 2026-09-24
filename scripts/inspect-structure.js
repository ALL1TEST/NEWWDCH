const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const item = await prisma.contentItem.findUnique({
    where: { id: 'cmuc02x0r004rk9tgstnztju9' },
    select: { content: true }
  });
  if (!item || !item.content) return;
  // Replace base64 strings with a short placeholder to see the full HTML structure clearly
  const cleaned = item.content.replace(/data:image\/[^;]+;base64,[^"']+/g, '[BASE64_IMAGE]');
  console.log(cleaned);
}

main().catch(console.error).finally(() => prisma.$disconnect());
