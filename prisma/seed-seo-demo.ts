// ============================================================
// SEO MODULE SEED SCRIPT — Realistic Test/Demo Data
// ============================================================
// Populates ALL SEO sections with internally consistent data:
// - SeoIssues (for Overview + Audit pages)
// - SearchConsole stats/queries/pages
// - SitemapConfig with realistic XML
// - RobotsTxt with production-style config
// - Redirects (301/302)
// - IndexingRecords
// Uses the site_url from Settings (https://cms.example.com)
// ============================================================

import { db } from '../src/lib/db';

const SITE_URL = 'https://cms.example.com';

// Realistic article URLs from existing content slugs
const ARTICLE_URLS = [
  '/articles/nextjs-performance-optimization',
  '/articles/getting-started-typescript-2025',
  '/articles/building-design-system-scratch',
  '/articles/startup-scaling-strategies-tech-teams',
  '/articles/react-hooks-advanced-patterns',
  '/articles/api-security-best-practices',
  '/articles/css-container-queries-future',
  '/articles/understanding-server-actions-nextjs',
];

const CATEGORY_URLS = [
  '/categories/technology',
  '/categories/design',
  '/categories/business',
  '/categories/frontend-development',
  '/categories/backend-development',
];

const STATIC_URLS = [
  '/',
  '/about-us',
  '/privacy-policy',
  '/blog',
];

async function main() {
  console.log('=== SEO SEED STARTING ===');
  console.log(`Site URL: ${SITE_URL}`);

  // ---- Clean up old SEO test data ----
  console.log('\nCleaning up old SEO data...');
  await db.seoIssue.deleteMany({});
  await db.searchConsoleStat.deleteMany({});
  await db.searchConsoleQuery.deleteMany({});
  await db.searchConsolePage.deleteMany({});
  await db.redirect.deleteMany({});
  await db.indexingRecord.deleteMany({});
  console.log('  Old data cleaned.');

  // ============================================================
  // 1. SEO ISSUES (for Overview + Audit pages)
  // ============================================================
  console.log('\nCreating SEO Issues...');

  const issues = [
    // 2 Critical (unresolved)
    { severity: 'CRITICAL', pageUrl: ARTICLE_URLS[0], problem: 'Missing meta description', recommendation: 'Add a unique meta description of 150-160 characters that summarizes the page content and includes the target keyword.', isResolved: false },
    { severity: 'CRITICAL', pageUrl: ARTICLE_URLS[1], problem: 'Broken internal link detected', recommendation: 'The link "/articles/old-typescript-guide" returns a 404. Update the link to point to the current article or add a redirect.', isResolved: false },

    // 4 Warnings (unresolved)
    { severity: 'WARNING', pageUrl: ARTICLE_URLS[2], problem: 'Meta title exceeds 60 characters', recommendation: 'Shorten the title tag to 50-60 characters to ensure it displays fully in search results.', isResolved: false },
    { severity: 'WARNING', pageUrl: ARTICLE_URLS[3], problem: 'Missing canonical URL', recommendation: 'Add a canonical URL to prevent duplicate content issues and consolidate ranking signals.', isResolved: false },
    { severity: 'WARNING', pageUrl: ARTICLE_URLS[4], problem: 'Image missing alt text', recommendation: 'Add descriptive alt text to all images for accessibility and SEO. Found 3 images without alt attributes.', isResolved: false },
    { severity: 'WARNING', pageUrl: ARTICLE_URLS[5], problem: 'Low word count', recommendation: 'Consider expanding the content to at least 300 words. Current word count: 187. Longer content tends to rank better.', isResolved: false },

    // 3 Info (2 unresolved, 1 resolved)
    { severity: 'INFO', pageUrl: ARTICLE_URLS[6], problem: 'No structured data found', recommendation: 'Add Schema.org structured data (Article schema) to help search engines understand the content better.', isResolved: false },
    { severity: 'INFO', pageUrl: ARTICLE_URLS[7], problem: 'Open Graph image missing', recommendation: 'Add an OG image (1200x630px) to improve social media sharing appearance.', isResolved: false },
    { severity: 'INFO', pageUrl: '/about-us', problem: 'Page load speed could be improved', recommendation: 'Current load time is 2.8s. Optimize images and consider lazy-loading below-the-fold content to improve Core Web Vitals.', isResolved: true },
  ];

  for (const issue of issues) {
    await db.seoIssue.create({
      data: {
        severity: issue.severity,
        resourceType: 'content',
        pageUrl: issue.pageUrl,
        problem: issue.problem,
        recommendation: issue.recommendation,
        isResolved: issue.isResolved,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`  ✓ Created ${issues.length} SEO issues (2 Critical, 4 Warning, 3 Info — 1 resolved)`);

  // ============================================================
  // 2. SEARCH CONSOLE
  // ============================================================
  console.log('\nUpdating Search Console connection...');

  // Update the existing connection with a realistic site URL
  const scConn = await db.searchConsoleConnection.findFirst();
  if (scConn) {
    await db.searchConsoleConnection.update({
      where: { id: scConn.id },
      data: {
        siteUrl: SITE_URL,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
      },
    });
  } else {
    await db.searchConsoleConnection.create({
      data: {
        siteUrl: SITE_URL,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
      },
    });
  }
  const connection = await db.searchConsoleConnection.findFirst();
  const connId = connection!.id;
  console.log(`  ✓ Search Console connected to ${SITE_URL}`);

  // Search Console daily stats (last 30 days)
  console.log('Creating Search Console daily stats (30 days)...');
  const stats = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Realistic numbers with some variance
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseImpressions = isWeekend ? 1800 : 3200;
    const variance = Math.random() * 0.4 - 0.2; // ±20%
    const impressions = Math.round(baseImpressions * (1 + variance));
    const ctr = 0.032 + Math.random() * 0.015; // 3.2% - 4.7%
    const clicks = Math.round(impressions * ctr);
    const position = 8.2 + Math.random() * 3.5; // 8.2 - 11.7

    stats.push({
      date: dateStr,
      clicks,
      impressions,
      ctr: parseFloat(ctr.toFixed(4)),
      position: parseFloat(position.toFixed(1)),
      connectionId: connId,
    });
  }

  for (const stat of stats) {
    await db.searchConsoleStat.create({ data: stat });
  }

  // Calculate totals for verification
  const totalClicks = stats.reduce((sum, s) => sum + s.clicks, 0);
  const totalImpressions = stats.reduce((sum, s) => sum + s.impressions, 0);
  const avgCtr = parseFloat(((totalClicks / totalImpressions) * 100).toFixed(1));
  const avgPosition = parseFloat((stats.reduce((sum, s) => sum + s.position, 0) / stats.length).toFixed(1));
  console.log(`  ✓ Created 30 days of stats | Total clicks: ${totalClicks}, impressions: ${totalImpressions}, CTR: ${avgCtr}%, avg position: ${avgPosition}`);

  // Top search queries
  console.log('Creating top search queries...');
  const queries = [
    { query: 'nextjs performance optimization', clicks: 342, impressions: 4200, ctr: 8.14, position: 3.2 },
    { query: 'typescript getting started 2025', clicks: 287, impressions: 3800, ctr: 7.55, position: 4.1 },
    { query: 'design system from scratch', clicks: 234, impressions: 3100, ctr: 7.55, position: 5.3 },
    { query: 'react hooks advanced patterns', clicks: 198, impressions: 2900, ctr: 6.83, position: 6.1 },
    { query: 'api security best practices', clicks: 176, impressions: 2500, ctr: 7.04, position: 5.8 },
    { query: 'startup scaling strategies', clicks: 143, impressions: 2100, ctr: 6.81, position: 7.2 },
    { query: 'css container queries', clicks: 121, impressions: 1900, ctr: 6.37, position: 6.8 },
    { query: 'nextjs server actions', clicks: 98, impressions: 1500, ctr: 6.53, position: 8.4 },
    { query: 'typescript tutorial', clicks: 76, impressions: 2800, ctr: 2.71, position: 12.3 },
    { query: 'web design trends 2025', clicks: 54, impressions: 1200, ctr: 4.50, position: 9.7 },
  ];

  for (const q of queries) {
    await db.searchConsoleQuery.create({
      data: { ...q, connectionId: connId },
    });
  }
  console.log(`  ✓ Created ${queries.length} top search queries`);

  // Top pages
  console.log('Creating top pages...');
  const pages = [
    { pageUrl: ARTICLE_URLS[0], clicks: 342, impressions: 4200, ctr: 8.14, position: 3.2 },
    { pageUrl: ARTICLE_URLS[1], clicks: 287, impressions: 3800, ctr: 7.55, position: 4.1 },
    { pageUrl: ARTICLE_URLS[2], clicks: 234, impressions: 3100, ctr: 7.55, position: 5.3 },
    { pageUrl: ARTICLE_URLS[3], clicks: 198, impressions: 2900, ctr: 6.83, position: 6.1 },
    { pageUrl: ARTICLE_URLS[4], clicks: 176, impressions: 2500, ctr: 7.04, position: 5.8 },
    { pageUrl: ARTICLE_URLS[5], clicks: 143, impressions: 2100, ctr: 6.81, position: 7.2 },
    { pageUrl: '/about-us', clicks: 54, impressions: 800, ctr: 6.75, position: 8.9 },
    { pageUrl: '/', clicks: 89, impressions: 1200, ctr: 7.42, position: 6.5 },
  ];

  for (const p of pages) {
    await db.searchConsolePage.create({
      data: { ...p, connectionId: connId },
    });
  }
  console.log(`  ✓ Created ${pages.length} top pages`);

  // ============================================================
  // 3. SITEMAP CONFIG
  // ============================================================
  console.log('\nUpdating Sitemap config...');

  // Generate realistic XML sitemap
  const allUrls = [...ARTICLE_URLS, ...CATEGORY_URLS, ...STATIC_URLS];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map((url) => {
    const lastmod = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const changefreq = url.startsWith('/articles/') ? 'weekly' : 'monthly';
    const priority = url === '/' ? '1.0' : url.startsWith('/articles/') ? '0.8' : '0.6';
    return `  <url>
    <loc>${SITE_URL}${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n')}
</urlset>`;

  const sitemap = await db.sitemapConfig.findFirst();
  if (sitemap) {
    await db.sitemapConfig.update({
      where: { id: sitemap.id },
      data: {
        urlCount: allUrls.length,
        status: 'GENERATED',
        autoGenerate: true,
        lastGeneratedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        lastPingedGoogle: new Date(Date.now() - 2 * 60 * 60 * 1000),
        lastPingedBing: new Date(Date.now() - 2 * 60 * 60 * 1000),
        xmlContent: sitemapXml,
      },
    });
  } else {
    await db.sitemapConfig.create({
      data: {
        urlCount: allUrls.length,
        status: 'GENERATED',
        autoGenerate: true,
        lastGeneratedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        lastPingedGoogle: new Date(Date.now() - 2 * 60 * 60 * 1000),
        lastPingedBing: new Date(Date.now() - 2 * 60 * 60 * 1000),
        xmlContent: sitemapXml,
      },
    });
  }
  console.log(`  ✓ Sitemap updated: ${allUrls.length} URLs, status=GENERATED, autoGenerate=true`);

  // ============================================================
  // 4. ROBOTS.TXT
  // ============================================================
  console.log('\nUpdating robots.txt...');

  const robotsContent = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /private/
Disallow: /*?sort=
Disallow: /*?filter=
Disallow: /*?page=

# Block AI crawlers that don't respect robots.txt
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Disallow: /

# Allow all other bots
User-agent: *
Allow: /articles/
Allow: /categories/
Allow: /blog
Allow: /about-us
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml`;

  const robots = await db.robotsTxt.findFirst();
  if (robots) {
    await db.robotsTxt.update({
      where: { id: robots.id },
      data: { content: robotsContent },
    });
  } else {
    await db.robotsTxt.create({
      data: { content: robotsContent },
    });
  }
  console.log('  ✓ Robots.txt updated with production-style config');

  // ============================================================
  // 5. REDIRECTS
  // ============================================================
  console.log('\nCreating redirects...');

  const redirects = [
    {
      fromPath: '/articles/old-typescript-guide',
      toPath: ARTICLE_URLS[1],
      type: 'PERMANENT_301',
      hitCount: 47,
      isActive: true,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    },
    {
      fromPath: '/articles/typescript-basics',
      toPath: ARTICLE_URLS[1],
      type: 'PERMANENT_301',
      hitCount: 23,
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    {
      fromPath: '/blog/nextjs-speed-tips',
      toPath: ARTICLE_URLS[0],
      type: 'PERMANENT_301',
      hitCount: 89,
      isActive: true,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    },
    {
      fromPath: '/categories/tech',
      toPath: CATEGORY_URLS[0],
      type: 'PERMANENT_301',
      hitCount: 12,
      isActive: true,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    },
    {
      fromPath: '/categories/dev',
      toPath: CATEGORY_URLS[3],
      type: 'PERMANENT_301',
      hitCount: 8,
      isActive: true,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
    {
      fromPath: '/articles/temp-promo-page',
      toPath: '/',
      type: 'TEMPORARY_302',
      hitCount: 3,
      isActive: false,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      fromPath: '/old-about',
      toPath: '/about-us',
      type: 'PERMANENT_301',
      hitCount: 34,
      isActive: true,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const r of redirects) {
    await db.redirect.create({ data: r });
  }
  console.log(`  ✓ Created ${redirects.length} redirects (${redirects.filter(r => r.type === 'PERMANENT_301').length} permanent, ${redirects.filter(r => r.type === 'TEMPORARY_302').length} temporary, ${redirects.filter(r => r.isActive).length} active)`);

  // ============================================================
  // 6. INDEXING RECORDS
  // ============================================================
  console.log('\nCreating indexing records...');

  const indexingRecords = [
    { title: 'Next.js Performance Optimization Techniques', pageUrl: ARTICLE_URLS[0], status: 'INDEXED', lastCrawl: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), lastIndexed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    { title: 'Getting Started with TypeScript in 2025', pageUrl: ARTICLE_URLS[1], status: 'INDEXED', lastCrawl: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), lastIndexed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    { title: 'Building a Design System from Scratch', pageUrl: ARTICLE_URLS[2], status: 'INDEXED', lastCrawl: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), lastIndexed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    { title: 'Startup Scaling Strategies for Tech Teams', pageUrl: ARTICLE_URLS[3], status: 'INDEXED', lastCrawl: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), lastIndexed: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    { title: 'React Hooks: Advanced Patterns', pageUrl: ARTICLE_URLS[4], status: 'DISCOVERED', lastCrawl: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), lastIndexed: null },
    { title: 'API Security Best Practices', pageUrl: ARTICLE_URLS[5], status: 'PENDING', lastCrawl: null, lastIndexed: null },
    { title: 'About Us', pageUrl: '/about-us', status: 'INDEXED', lastCrawl: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), lastIndexed: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    { title: 'Privacy Policy', pageUrl: '/privacy-policy', status: 'INDEXED', lastCrawl: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), lastIndexed: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) },
  ];

  for (const ir of indexingRecords) {
    await db.indexingRecord.create({
      data: {
        title: ir.title,
        pageUrl: ir.pageUrl,
        status: ir.status,
        lastCrawl: ir.lastCrawl,
        lastIndexed: ir.lastIndexed,
      },
    });
  }
  console.log(`  ✓ Created ${indexingRecords.length} indexing records (${indexingRecords.filter(r => r.status === 'INDEXED').length} indexed, ${indexingRecords.filter(r => r.status === 'DISCOVERED').length} discovered, ${indexingRecords.filter(r => r.status === 'PENDING').length} pending)`);

  // ============================================================
  // 7. SEO CONFIGS for published articles (for meta data)
  // ============================================================
  console.log('\nCreating SEO configs for published articles...');

  const publishedArticles = await db.contentItem.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    select: { id: true, title: true, slug: true, seoTitle: true, seoDescription: true },
  });

  let configCount = 0;
  for (const article of publishedArticles) {
    const existing = await db.seoConfig.findFirst({
      where: { resourceType: 'content', resourceId: article.id },
    });
    if (!existing) {
      const metaTitle = article.seoTitle || article.title;
      const metaDescription = article.seoDescription || `${article.title} — read our in-depth guide covering best practices, tips, and real-world examples.`;
      await db.seoConfig.create({
        data: {
          resourceType: 'content',
          resourceId: article.id,
          metaTitle,
          metaDescription,
          canonicalUrl: `${SITE_URL}/articles/${article.slug}`,
          structuredData: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: metaTitle,
            description: metaDescription,
            author: { '@type': 'Organization', name: 'CMS Admin' },
            publisher: { '@type': 'Organization', name: 'CMS Admin Dashboard' },
          }),
        },
      });
      configCount++;
    }
  }
  console.log(`  ✓ Created ${configCount} SEO configs for published articles`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n========================================');
  console.log('SEO SEED COMPLETE');
  console.log('========================================');
  console.log(`Site URL: ${SITE_URL}`);
  console.log(`SEO Issues: ${issues.length} (2 Critical, 4 Warning, 3 Info — 1 resolved)`);
  console.log(`Search Console: 30 days stats, ${queries.length} queries, ${pages.length} pages`);
  console.log(`  Total clicks: ${totalClicks}, impressions: ${totalImpressions}`);
  console.log(`  Avg CTR: ${avgCtr}%, avg position: ${avgPosition}`);
  console.log(`Sitemap: ${allUrls.length} URLs, status=GENERATED, autoGenerate=true`);
  console.log(`Robots.txt: production-style config with sitemap reference`);
  console.log(`Redirects: ${redirects.length} (${redirects.filter(r => r.isActive).length} active, ${redirects.filter(r => !r.isActive).length} inactive)`);
  console.log(`Indexing Records: ${indexingRecords.length} (${indexingRecords.filter(r => r.status === 'INDEXED').length} indexed)`);
  console.log(`SEO Configs: ${configCount} created for published articles`);
  console.log('========================================');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
