const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const session = await prisma.session.findFirst({
    where: { expiresAt: { gt: new Date() } },
  });

  const res = await fetch('http://localhost:3000/api/comments?status=TRASH', {
    headers: {
      'Cookie': `cms_session_token=${session?.token}`
    }
  });

  console.log('GET /api/comments?status=TRASH status:', res.status);
  const data = await res.json();
  console.log('GET /api/comments?status=TRASH body:', JSON.stringify(data, null, 2));
}

test().catch(console.error).finally(() => prisma.$disconnect());
