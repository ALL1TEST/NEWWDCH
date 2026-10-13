const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const comments = await prisma.comment.findMany({ take: 1 });
    if (comments.length === 0) {
      console.log('No comments found');
      return;
    }
    const id = comments[0].id;
    console.log('Testing updateMany with id:', id, 'status: TRASH');
    const res = await prisma.comment.updateMany({
      where: { id: { in: [id] } },
      data: { status: 'TRASH' },
    });
    console.log('updateMany result:', res);
  } catch (err) {
    console.error('updateMany error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
