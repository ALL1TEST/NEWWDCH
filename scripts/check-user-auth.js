const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, billingMode: true, planId: true }
  });
  console.log('Users in DB:', users);

  const plan = await prisma.plan.findMany();
  console.log('Plans:', plan.map(p => ({ id: p.id, slug: p.slug, entitlements: p.entitlements })));

  const sessions = await prisma.session.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { user: true }
  });
  console.log('Recent sessions:', sessions.map(s => ({
    userId: s.userId,
    userEmail: s.user?.email,
    userRole: s.user?.role,
    expiresAt: s.expiresAt
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
