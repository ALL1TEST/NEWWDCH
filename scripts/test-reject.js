const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { updateVerdantCommentStatus } = require('../src/lib/services/production-comment-service');

async function testReject() {
  const testId = 'cmuyjf8ya0000i906nng88vgb';
  console.log('Testing reject on comment:', testId);

  // Update in SQLite
  const updated = await prisma.comment.update({
    where: { id: testId },
    data: { status: 'REJECTED' }
  });
  console.log('SQLite status after reject:', updated.status);

  // Update in Postgres
  const pgResult = await updateVerdantCommentStatus(testId, 'REJECTED');
  console.log('Postgres update result:', pgResult);
}

testReject().catch(console.error).finally(() => prisma.$disconnect());
