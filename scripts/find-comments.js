const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const comments = await prisma.comment.findMany({
    include: { author: true, contentItem: true }
  });
  console.log('Comments in SQLite:');
  for (const c of comments) {
    console.log({
      id: c.id,
      content: c.content,
      author: c.author?.email,
      status: c.status
    });
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
