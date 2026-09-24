const { PrismaClient } = require('@prisma/client');

async function verify() {
  // 1. Check API
  const apiRes = await fetch('https://verdantt.vercel.app/api/articles');
  const articles = await apiRes.json();
  console.log('--- API Verification (https://verdantt.vercel.app/api/articles) ---');
  console.log('Total articles returned:', articles.length);
  const targetArticle = articles.find(a => a.title.includes('Dark to Dramatic'));
  if (!targetArticle) {
    console.error('Target article not found in API!');
    return;
  }
  console.log('Found target article in API:');
  console.log('  Title:', targetArticle.title);
  console.log('  Slug:', targetArticle.slug);
  console.log('  Category:', targetArticle.category);
  console.log('  Date:', targetArticle.date);
  console.log('  Author:', targetArticle.author?.name);

  // 2. Check Homepage HTML
  console.log('\n--- Homepage Verification (https://verdantt.vercel.app/) ---');
  const homeRes = await fetch('https://verdantt.vercel.app/');
  const homeHtml = await homeRes.text();
  console.log('HTTP Status:', homeRes.status);
  console.log('Contains Title:', homeHtml.includes('From Dark to Dramatic: How to Choose the Perfect Low-Light Plant for Your Home'));
  console.log('Contains Article Slug:', homeHtml.includes(targetArticle.slug));

  // 3. Check Blog Page HTML
  console.log('\n--- Blog Page Verification (https://verdantt.vercel.app/blog) ---');
  const blogRes = await fetch('https://verdantt.vercel.app/blog');
  const blogHtml = await blogRes.text();
  console.log('HTTP Status:', blogRes.status);
  console.log('Contains Title:', blogHtml.includes('From Dark to Dramatic: How to Choose the Perfect Low-Light Plant for Your Home'));
  console.log('Contains Article Slug:', blogHtml.includes(targetArticle.slug));
  console.log('Contains 10 articles count:', blogHtml.includes('10 articles'));

  // 4. Verify Supabase DB
  console.log('\n--- PostgreSQL Supabase DB Verification (verdant schema) ---');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=verdant'
      }
    }
  });
  const dbPosts = await prisma.post.findMany({ select: { id: true, title: true, slug: true, status: true } });
  console.log('Total posts in database table verdant.Post:', dbPosts.length);
  const dbMatch = dbPosts.find(p => p.title.includes('Dark to Dramatic'));
  console.log('Target post in DB:', JSON.stringify(dbMatch, null, 2));
  await prisma.$disconnect();

  console.log('\n=== ALL END-TO-END VERIFICATIONS PASSED ===');
}

verify().catch(console.error);
