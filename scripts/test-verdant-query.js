const { PrismaClient } = require('C:\\Users\\ABDELLAH AIT-SI\\Desktop\\Verdant\\node_modules\\@prisma\\client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=verdant'
    }
  }
});

async function main() {
  console.log('Testing prisma query...');
  const comments = await prisma.comment.findMany({
    where: {
      articleSlug: 'complete-monstera-care-guide',
      status: 'APPROVED',
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Approved comments for articleSlug:', comments);

  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'enable_comments' }
  });
  console.log('SiteSetting enable_comments:', setting);
}

main()
  .catch(err => {
    console.error('Error running prisma query:', err);
  })
  .finally(() => prisma.$disconnect());
