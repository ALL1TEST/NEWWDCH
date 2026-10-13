const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const session = await prisma.session.findFirst({
    where: { expiresAt: { gt: new Date() } },
    include: { user: true }
  });
  console.log('Session user:', session?.user?.email, 'token:', session?.token);

  const res = await fetch('http://localhost:3000/api/comments/bulk-status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `cms_session_token=${session?.token}`
    },
    body: JSON.stringify({
      ids: ['cmuzdefaa0000le06nk7siie9'],
      status: 'TRASH'
    })
  });

  console.log('Response status:', res.status);
  const data = await res.json();
  console.log('Response body:', JSON.stringify(data, null, 2));
}

test().catch(console.error).finally(() => prisma.$disconnect());
