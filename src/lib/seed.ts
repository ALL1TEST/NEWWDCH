// ============================================================
// SEED SCRIPT — Enterprise CMS Admin Dashboard
// Runnable via: bun run src/lib/seed.ts
// ============================================================

import { db } from '@/lib/db';

// -------------------- Helpers --------------------

function log(label: string, count: number) {
  console.log(`  ✓ ${label}: ${count} record(s)`);
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// -------------------- Main --------------------

async function main() {
  console.log('\n🌱 Seeding CMS database...\n');

  // Clean existing data (order matters for FK constraints)
  console.log('Cleaning existing data...');
  // --- System / Monitoring ---
  await db.domainEvent.deleteMany();
  await db.queueJob.deleteMany();
  await db.systemMetric.deleteMany();
  await db.schedulerLog.deleteMany();
  await db.errorLog.deleteMany();
  await db.securityEvent.deleteMany();
  await db.dependencyHealth.deleteMany();
  await db.monitorSetting.deleteMany();
  // --- Alerts ---
  await db.alert.deleteMany();
  await db.alertRule.deleteMany();
  // --- Webhooks ---
  await db.webhookDelivery.deleteMany();
  await db.webhook.deleteMany();
  // --- Audit / API logs ---
  await db.auditLog.deleteMany();
  await db.apiLog.deleteMany();
  // --- AI ---
  await db.aiLog.deleteMany();
  await db.aiJob.deleteMany();
  await db.aiModel.deleteMany();
  await db.aiPromptMarketplace.deleteMany();
  await db.aiProviderFallback.deleteMany();
  await db.aiSettings.deleteMany();
  await db.promptTemplateVersion.deleteMany();
  await db.promptTemplate.deleteMany();
  await db.aiProvider.deleteMany();
  // --- SEO ---
  await db.searchConsoleStat.deleteMany();
  await db.searchConsoleQuery.deleteMany();
  await db.searchConsolePage.deleteMany();
  await db.searchConsoleConnection.deleteMany();
  await db.indexingRecord.deleteMany();
  await db.brokenLink.deleteMany();
  await db.seoIssue.deleteMany();
  await db.robotsTxt.deleteMany();
  await db.sitemapConfig.deleteMany();
  await db.seoConfig.deleteMany();
  // --- Backups ---
  await db.backupLog.deleteMany();
  await db.backupStorage.deleteMany();
  await db.backupSchedule.deleteMany();
  await db.backup.deleteMany();
  // --- Features / Settings ---
  await db.featureFlag.deleteMany();
  await db.importExportJob.deleteMany();
  await db.savedFilter.deleteMany();
  await db.bulkOperation.deleteMany();
  await db.ipRule.deleteMany();
  await db.settingsAuditLog.deleteMany();
  await db.setting.deleteMany();
  // --- Notifications ---
  await db.userNotificationPreference.deleteMany();
  await db.notification.deleteMany();
  // --- User-facing ---
  await db.userDashboardLayout.deleteMany();
  await db.analyticsEvent.deleteMany();
  // --- Email / Newsletter ---
  await db.emailTemplateVersion.deleteMany();
  await db.emailTemplate.deleteMany();
  await db.smtpSetting.deleteMany();
  await db.newsletterCampaign.deleteMany();
  await db.newsletterSubscriber.deleteMany();
  // --- Forms ---
  await db.formSubmission.deleteMany();
  await db.form.deleteMany();
  // --- Content ---
  await db.comment.deleteMany();
  await db.tag.deleteMany();
  await db.category.deleteMany();
  await db.redirect.deleteMany();
  await db.navigationVersion.deleteMany();
  await db.navigation.deleteMany();
  await db.mediaCollectionItem.deleteMany();
  await db.mediaCollection.deleteMany();
  await db.mediaUsage.deleteMany();
  await db.media.deleteMany();
  await db.mediaFolder.deleteMany();
  await db.reviewComment.deleteMany();
  await db.reviewAssignment.deleteMany();
  await db.contentContributor.deleteMany();
  await db.postTranslation.deleteMany();
  await db.contentVersion.deleteMany();
  await db.contentItem.deleteMany();
  await db.contentTemplate.deleteMany();
  await db.reusableBlock.deleteMany();
  await db.homepageLayout.deleteMany();
  await db.fieldPermission.deleteMany();
  await db.contentType.deleteMany();
  // --- Sites ---
  await db.site.deleteMany();
  // --- Users (last) ---
  await db.authorProfile.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.apiKey.deleteMany();
  await db.user.deleteMany();

  // ============================================================
  // 1. USERS
  // ============================================================
  console.log('\n--- Users ---');

  const adminUser = await db.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: 'admin123',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      lastLoginAt: daysAgo(1),
    },
  });

  const editorUser = await db.user.create({
    data: {
      email: 'editor@example.com',
      name: 'Jane Editor',
      password: 'editor123',
      role: 'EDITOR',
      status: 'ACTIVE',
      emailVerified: true,
      lastLoginAt: daysAgo(2),
    },
  });

  const authorUser = await db.user.create({
    data: {
      email: 'author@example.com',
      name: 'John Author',
      password: 'author123',
      role: 'EDITOR',
      status: 'ACTIVE',
      emailVerified: true,
      lastLoginAt: daysAgo(3),
    },
  });

  log('Users', 3);

  // ============================================================
  // 2. AUTHOR PROFILES
  // ============================================================
  console.log('\n--- Author Profiles ---');

  await db.authorProfile.createMany({
    data: [
      {
        userId: adminUser.id,
        displayName: 'Admin User',
        slug: 'admin-user',
        bio: 'Platform administrator and system architect. Overseeing the CMS infrastructure and development.',
        website: 'https://example.com/admin',
        twitter: '@adminuser',
        github: 'adminuser',
      },
      {
        userId: editorUser.id,
        displayName: 'Jane Editor',
        slug: 'jane-editor',
        bio: 'Senior content editor with 10+ years of experience in digital publishing and content strategy.',
        website: 'https://example.com/jane',
        twitter: '@janeeditor',
        github: 'janeeditor',
        linkedin: 'jane-editor',
      },
      {
        userId: authorUser.id,
        displayName: 'John Author',
        slug: 'john-author',
        bio: 'Full-stack developer and technical writer. Passionate about web technologies and open source.',
        website: 'https://example.com/john',
        twitter: '@johnauthor',
        github: 'johnauthor',
      },
    ],
  });

  log('Author Profiles', 3);

  // ============================================================
  // 3. CONTENT TYPES
  // ============================================================
  console.log('\n--- Content Types ---');

  const postType = await db.contentType.create({
    data: {
      name: 'Post',
      slug: 'post',
      description: 'Standard blog post content type',
      icon: 'FileText',
      isBuiltIn: true,
      allowedStatuses: JSON.stringify(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']),
      fields: JSON.stringify([
        { name: 'title', type: 'STRING', label: 'Title', required: true, maxLength: 500 },
        { name: 'content', type: 'JSON', label: 'Content', required: true },
        { name: 'excerpt', type: 'STRING', label: 'Excerpt', required: false, maxLength: 1000 },
        { name: 'featuredImage', type: 'FILE', label: 'Featured Image', required: false },
        { name: 'seoTitle', type: 'STRING', label: 'SEO Title', required: false, maxLength: 70 },
        { name: 'seoDescription', type: 'STRING', label: 'SEO Description', required: false, maxLength: 160 },
        { name: 'focusKeyword', type: 'STRING', label: 'Focus Keyword', required: false, maxLength: 100 },
      ]),
    },
  });

  const pageType = await db.contentType.create({
    data: {
      name: 'Page',
      slug: 'page',
      description: 'Static page content type',
      icon: 'File',
      isBuiltIn: true,
      allowedStatuses: JSON.stringify(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
      fields: JSON.stringify([
        { name: 'title', type: 'STRING', label: 'Title', required: true, maxLength: 500 },
        { name: 'content', type: 'JSON', label: 'Content', required: true },
      ]),
    },
  });

  log('Content Types', 2);

  // ============================================================
  // 4. CATEGORIES
  // ============================================================
  console.log('\n--- Categories ---');

  const techCategory = await db.category.create({
    data: {
      name: 'Technology',
      slug: 'technology',
      description: 'All things tech — software, hardware, and innovation',
      sortOrder: 1,
    },
  });

  const designCategory = await db.category.create({
    data: {
      name: 'Design',
      slug: 'design',
      description: 'UI/UX design, graphic design, and creative processes',
      sortOrder: 2,
    },
  });

  const businessCategory = await db.category.create({
    data: {
      name: 'Business',
      slug: 'business',
      description: 'Business strategy, startups, and entrepreneurship',
      sortOrder: 3,
    },
  });

  // Child categories for tree structure
  const frontendCategory = await db.category.create({
    data: {
      name: 'Frontend Development',
      slug: 'frontend-development',
      description: 'Frontend frameworks, libraries, and best practices',
      parentId: techCategory.id,
      sortOrder: 1,
    },
  });

  const backendCategory = await db.category.create({
    data: {
      name: 'Backend Development',
      slug: 'backend-development',
      description: 'Server-side development, APIs, and databases',
      parentId: techCategory.id,
      sortOrder: 2,
    },
  });

  log('Categories', 5);

  // ============================================================
  // 5. TAGS
  // ============================================================
  console.log('\n--- Tags ---');

  const javascriptTag = await db.tag.create({
    data: { name: 'JavaScript', slug: 'javascript', color: '#f7df1e' },
  });
  const reactTag = await db.tag.create({
    data: { name: 'React', slug: 'react', color: '#61dafb' },
  });
  const nextjsTag = await db.tag.create({
    data: { name: 'Next.js', slug: 'next-js', color: '#000000' },
  });
  const typescriptTag = await db.tag.create({
    data: { name: 'TypeScript', slug: 'typescript', color: '#3178c6' },
  });
  const cssTag = await db.tag.create({
    data: { name: 'CSS', slug: 'css', color: '#264de4' },
  });
  const designTag = await db.tag.create({
    data: { name: 'Design', slug: 'design', color: '#ff6b6b' },
  });

  log('Tags', 6);

  // ============================================================
  // 6. MEDIA FOLDER & MEDIA
  // ============================================================
  console.log('\n--- Media ---');

  const uploadsFolder = await db.mediaFolder.create({
    data: { name: 'Uploads' },
  });

  await db.mediaFolder.create({
    data: {
      name: 'Blog Images',
      parentId: uploadsFolder.id,
    },
  });

  const heroImage = await db.media.create({
    data: {
      filename: 'hero-banner-2025.png',
      originalName: 'hero-banner-2025.png',
      mimeType: 'image/png',
      size: 2457600,
      width: 1920,
      height: 1080,
      alt: 'Hero banner showcasing modern web development',
      caption: 'A panoramic view of a modern development workspace',
      folderId: uploadsFolder.id,
      url: '/uploads/hero-banner-2025.png',
      thumbnailUrl: '/uploads/thumbnails/hero-banner-2025.png',
      processingStatus: 'READY',
      scanStatus: 'CLEAN',
      uploadedById: adminUser.id,
    },
  });

  const blogImage1 = await db.media.create({
    data: {
      filename: 'typescript-guide-cover.jpg',
      originalName: 'typescript-guide-cover.jpg',
      mimeType: 'image/jpeg',
      size: 892400,
      width: 1200,
      height: 630,
      alt: 'TypeScript comprehensive guide cover image',
      caption: 'Cover image for the TypeScript guide article',
      folderId: uploadsFolder.id,
      url: '/uploads/typescript-guide-cover.jpg',
      thumbnailUrl: '/uploads/thumbnails/typescript-guide-cover.jpg',
      processingStatus: 'READY',
      scanStatus: 'CLEAN',
      uploadedById: authorUser.id,
    },
  });

  const blogImage2 = await db.media.create({
    data: {
      filename: 'nextjs-performance.webp',
      originalName: 'nextjs-performance.webp',
      mimeType: 'image/webp',
      size: 512000,
      width: 800,
      height: 450,
      alt: 'Next.js performance optimization diagram',
      caption: 'Diagram showing Next.js performance techniques',
      folderId: uploadsFolder.id,
      url: '/uploads/nextjs-performance.webp',
      thumbnailUrl: '/uploads/thumbnails/nextjs-performance.webp',
      processingStatus: 'READY',
      scanStatus: 'CLEAN',
      uploadedById: authorUser.id,
    },
  });

  const pdfDocument = await db.media.create({
    data: {
      filename: 'style-guide-v3.pdf',
      originalName: 'style-guide-v3.pdf',
      mimeType: 'application/pdf',
      size: 2048000,
      alt: 'Company style guide version 3',
      folderId: uploadsFolder.id,
      url: '/uploads/style-guide-v3.pdf',
      processingStatus: 'READY',
      scanStatus: 'CLEAN',
      uploadedById: editorUser.id,
    },
  });

  log('Media Folders', 2);
  log('Media Files', 4);

  // ============================================================
  // 7. CONTENT ITEMS
  // ============================================================
  console.log('\n--- Content Items ---');

  const contentItems = await db.contentItem.createMany({
    data: [
      {
        title: 'Getting Started with TypeScript in 2025',
        slug: 'getting-started-typescript-2025',
        status: 'PUBLISHED',
        version: 1,
        content: '<h2>Why TypeScript Matters</h2><p>TypeScript has become the de facto standard for large-scale JavaScript projects. With its powerful type system, excellent IDE support, and growing ecosystem, it offers developers a way to write more reliable and maintainable code.</p><h3>Setting Up Your First Project</h3><p>Getting started with TypeScript is straightforward. Install it globally, initialize a project with <code>tsc --init</code>, and configure your tsconfig.json to match your needs. Modern bundlers like Vite and Next.js have first-class TypeScript support built in.</p><pre><code class="language-typescript">interface User {\n  id: string;\n  name: string;\n  email: string;\n  role: "admin" | "editor" | "viewer";\n}\n\nfunction greetUser(user: User): string {\n  return `Hello, ${user.name}!`;\n}</code></pre>',
        excerpt: 'A comprehensive guide to getting started with TypeScript in 2025, covering setup, configuration, and best practices for modern development.',
        authorId: authorUser.id,
        contentTypeId: postType.id,
        featuredImageId: blogImage1.id,
        categoryId: frontendCategory.id,
        publishedAt: daysAgo(5),
        seoTitle: 'Getting Started with TypeScript in 2025 | Complete Guide',
        seoDescription: 'Learn TypeScript from scratch with this comprehensive 2025 guide covering setup, types, generics, and best practices.',
        focusKeyword: 'TypeScript tutorial 2025',
        viewCount: 1245,
        createdAt: daysAgo(7),
      },
      {
        title: 'Next.js Performance Optimization Techniques',
        slug: 'nextjs-performance-optimization',
        status: 'PUBLISHED',
        version: 1,
        content: '<h2>Core Web Vitals and Next.js</h2><p>Next.js provides powerful built-in optimizations for Core Web Vitals. From automatic code splitting to image optimization with the <code>next/image</code> component, the framework handles much of the heavy lifting for you.</p><h3>Server Components and Streaming</h3><p>React Server Components in Next.js 14+ allow you to render components on the server, dramatically reducing client-side JavaScript. Combined with streaming, users see content progressively rather than waiting for the entire page to load.</p><pre><code class="language-tsx">// Server Component — no &quot;use client&quot;\nexport default async function PostList() {\n  const posts = await db.post.findMany({\n    take: 10,\n    orderBy: { createdAt: &quot;desc&quot; }\n  });\n  return &lt;ul&gt;{posts.map(p =&gt; &lt;li key={p.id}&gt;{p.title}&lt;/li&gt;)}&lt;/ul&gt;;\n}</code></pre>',
        excerpt: 'Deep dive into Next.js performance optimization covering Server Components, streaming, caching strategies, and image optimization.',
        authorId: authorUser.id,
        contentTypeId: postType.id,
        featuredImageId: blogImage2.id,
        categoryId: frontendCategory.id,
        publishedAt: daysAgo(3),
        seoTitle: 'Next.js Performance Optimization: The Definitive Guide',
        seoDescription: 'Master Next.js performance with Server Components, streaming, ISR, and advanced caching strategies for blazing-fast applications.',
        focusKeyword: 'Next.js performance',
        viewCount: 892,
        createdAt: daysAgo(5),
      },
      {
        title: 'Building a Design System from Scratch',
        slug: 'building-design-system-scratch',
        status: 'PUBLISHED',
        version: 1,
        content: '<h2>What is a Design System?</h2><p>A design system is a collection of reusable components, guided by clear standards, that can be assembled together to build any number of applications. It serves as the single source of truth for your product\'s visual language.</p><h3>Foundations: Color, Typography, Spacing</h3><p>Start with your design tokens — colors, typography scales, spacing units, and border radii. These form the atomic building blocks of your entire system. Use CSS custom properties for runtime theming and Tailwind for utility-first implementation.</p>',
        excerpt: 'Learn how to build a comprehensive design system from the ground up, covering design tokens, component architecture, and documentation.',
        authorId: editorUser.id,
        contentTypeId: postType.id,
        categoryId: designCategory.id,
        publishedAt: daysAgo(10),
        seoTitle: 'Building a Design System from Scratch | Complete Tutorial',
        seoDescription: 'Step-by-step guide to creating a production-ready design system with design tokens, components, and documentation.',
        focusKeyword: 'design system tutorial',
        viewCount: 2103,
        createdAt: daysAgo(14),
      },
      {
        title: 'React Hooks: Advanced Patterns and Best Practices',
        slug: 'react-hooks-advanced-patterns',
        status: 'IN_REVIEW',
        version: 2,
        content: '<h2>Beyond useState and useEffect</h2><p>While useState and useEffect cover most basic use cases, advanced React applications benefit from custom hooks that encapsulate complex stateful logic, side effects, and interactions with browser APIs.</p><h3>Custom Hook Patterns</h3><p>The most powerful custom hooks follow the separation of concerns principle: they abstract a single piece of behavior (debouncing, local storage sync, media queries, intersection observer) into a reusable hook with a clean API.</p>',
        excerpt: 'Explore advanced React hook patterns including custom hooks, useReducer strategies, and composable hook architectures.',
        authorId: authorUser.id,
        contentTypeId: postType.id,
        categoryId: frontendCategory.id,
        seoTitle: 'React Hooks Advanced Patterns | Best Practices 2025',
        seoDescription: 'Master advanced React hooks patterns including custom hooks, useReducer, and composable architectures for scalable applications.',
        focusKeyword: 'React hooks patterns',
        createdAt: daysAgo(2),
      },
      {
        title: 'CSS Container Queries: The Future of Responsive Design',
        slug: 'css-container-queries-future',
        status: 'DRAFT',
        version: 3,
        content: '<h2>Container Queries Explained</h2><p>Container queries allow you to style elements based on the size of their container rather than the viewport. This is a game-changer for component-based architectures where components need to adapt to their surrounding context.</p>',
        excerpt: 'Container queries are changing how we think about responsive design. Learn how to use them in modern CSS.',
        authorId: editorUser.id,
        contentTypeId: postType.id,
        categoryId: designCategory.id,
        focusKeyword: 'CSS container queries',
        createdAt: daysAgo(1),
      },
      {
        title: 'Startup Scaling Strategies for Tech Teams',
        slug: 'startup-scaling-strategies-tech-teams',
        status: 'PUBLISHED',
        version: 1,
        content: '<h2>Growing Pains are Real</h2><p>Scaling a tech team from 5 to 50 engineers requires more than just hiring. It demands a fundamental shift in engineering culture, processes, and tooling. Communication overhead grows quadratically with team size.</p><h3>Key Strategies</h3><p>Invest in CI/CD pipelines early. Adopt trunk-based development with short-lived feature branches. Implement code ownership models. Create clear RFC processes for architectural decisions. Build a strong internal documentation culture.</p>',
        excerpt: 'Practical strategies for scaling engineering teams from startup to growth stage, covering culture, processes, and tooling.',
        authorId: editorUser.id,
        contentTypeId: postType.id,
        categoryId: businessCategory.id,
        publishedAt: daysAgo(20),
        seoTitle: 'Startup Scaling Strategies for Tech Teams | Practical Guide',
        seoDescription: 'Learn proven strategies for scaling your engineering team effectively, from hiring practices to technical processes.',
        focusKeyword: 'startup scaling engineering',
        viewCount: 1567,
        createdAt: daysAgo(25),
      },
      {
        title: 'Understanding Server Actions in Next.js',
        slug: 'understanding-server-actions-nextjs',
        status: 'DRAFT',
        version: 1,
        content: '<h2>What Are Server Actions?</h2><p>Server Actions are an alpha feature in Next.js that allows you to define server-side functions that can be called directly from client components. They simplify form handling and data mutations without the need for separate API routes.</p>',
        excerpt: 'An introduction to Next.js Server Actions and how they simplify data mutations in full-stack applications.',
        authorId: authorUser.id,
        contentTypeId: postType.id,
        categoryId: frontendCategory.id,
        createdAt: daysAgo(1),
      },
      {
        title: 'About Us',
        slug: 'about-us',
        status: 'PUBLISHED',
        version: 1,
        content: '<p>We are a passionate team of developers, designers, and content creators dedicated to building the best content management experience on the web.</p><h2>Our Mission</h2><p>To empower creators and businesses with tools that make content management intuitive, powerful, and delightful.</p>',
        excerpt: 'Learn about our team and mission.',
        authorId: adminUser.id,
        contentTypeId: pageType.id,
        publishedAt: daysAgo(30),
        viewCount: 543,
        createdAt: daysAgo(30),
      },
      {
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        status: 'PUBLISHED',
        version: 1,
        content: '<p>Your privacy is important to us. This privacy policy explains how we collect, use, and protect your personal information when you use our services.</p>',
        excerpt: 'Our privacy policy explaining how we handle your data.',
        authorId: adminUser.id,
        contentTypeId: pageType.id,
        publishedAt: daysAgo(30),
        viewCount: 234,
        createdAt: daysAgo(30),
      },
      {
        title: 'API Security Best Practices for Modern Web Apps',
        slug: 'api-security-best-practices',
        status: 'IN_REVIEW',
        version: 1,
        content: '<h2>Authentication vs Authorization</h2><p>The first step in securing any API is implementing proper authentication and authorization. Use JWT tokens with short expiration times, implement refresh token rotation, and always validate permissions server-side.</p>',
        excerpt: 'Essential API security practices every developer should know, from authentication to rate limiting and CORS configuration.',
        authorId: authorUser.id,
        contentTypeId: postType.id,
        categoryId: backendCategory.id,
        createdAt: daysAgo(4),
      },
    ],
  });

  // Connect tags to content items
  const allContent = await db.contentItem.findMany();
  const tsPost = allContent.find(c => c.slug === 'getting-started-typescript-2025')!;
  const nextjsPost = allContent.find(c => c.slug === 'nextjs-performance-optimization')!;
  const designPost = allContent.find(c => c.slug === 'building-design-system-scratch')!;
  const hooksPost = allContent.find(c => c.slug === 'react-hooks-advanced-patterns')!;
  const cssPost = allContent.find(c => c.slug === 'css-container-queries-future')!;
  const businessPost = allContent.find(c => c.slug === 'startup-scaling-strategies-tech-teams')!;
  const serverActionPost = allContent.find(c => c.slug === 'understanding-server-actions-nextjs')!;
  const apiSecurityPost = allContent.find(c => c.slug === 'api-security-best-practices')!;

  await db.contentItem.update({
    where: { id: tsPost.id },
    data: { tags: { connect: [{ id: typescriptTag.id }, { id: javascriptTag.id }] } },
  });

  await db.contentItem.update({
    where: { id: nextjsPost.id },
    data: { tags: { connect: [{ id: nextjsTag.id }, { id: reactTag.id }, { id: typescriptTag.id }] } },
  });

  await db.contentItem.update({
    where: { id: designPost.id },
    data: { tags: { connect: [{ id: designTag.id }, { id: cssTag.id }] } },
  });

  await db.contentItem.update({
    where: { id: hooksPost.id },
    data: { tags: { connect: [{ id: reactTag.id }, { id: javascriptTag.id }] } },
  });

  await db.contentItem.update({
    where: { id: cssPost.id },
    data: { tags: { connect: [{ id: cssTag.id }, { id: designTag.id }] } },
  });

  await db.contentItem.update({
    where: { id: businessPost.id },
    data: { tags: { connect: [{ id: typescriptTag.id }] } },
  });

  await db.contentItem.update({
    where: { id: serverActionPost.id },
    data: { tags: { connect: [{ id: nextjsTag.id }, { id: reactTag.id }] } },
  });

  await db.contentItem.update({
    where: { id: apiSecurityPost.id },
    data: { tags: { connect: [{ id: typescriptTag.id }, { id: javascriptTag.id }] } },
  });

  log('Content Items', 10);

  // ============================================================
  // 8. NAVIGATION
  // ============================================================
  console.log('\n--- Navigation ---');

  await db.navigation.create({
    data: {
      name: 'Main Menu',
      slug: 'main-menu',
      description: 'Primary site navigation displayed in the header',
      isActive: true,
      items: JSON.stringify([
        {
          id: 'nav-home',
          type: 'CUSTOM_URL',
          label: 'Home',
          url: '/',
          order: 1,
        },
        {
          id: 'nav-blog',
          type: 'CATEGORY_LINK',
          label: 'Blog',
          categoryId: techCategory.id,
          url: '/blog',
          order: 2,
        },
        {
          id: 'nav-design',
          type: 'CATEGORY_LINK',
          label: 'Design',
          categoryId: designCategory.id,
          url: '/design',
          order: 3,
        },
        {
          id: 'nav-business',
          type: 'CATEGORY_LINK',
          label: 'Business',
          categoryId: businessCategory.id,
          url: '/business',
          order: 4,
        },
        {
          id: 'nav-about',
          type: 'PAGE_LINK',
          label: 'About',
          url: '/about-us',
          order: 5,
        },
        {
          id: 'nav-contact',
          type: 'CUSTOM_URL',
          label: 'Contact',
          url: '/contact',
          order: 6,
        },
      ]),
    },
  });

  log('Navigation', 1);

  // ============================================================
  // 9. SETTINGS
  // ============================================================
  console.log('\n--- Settings ---');

  await db.setting.createMany({
    data: [
      // General
      { key: 'site_title', value: 'CMS Admin Dashboard', type: 'STRING', scope: 'GLOBAL', category: 'GENERAL', isPublic: true, description: 'The name of your site' },
      { key: 'site_description', value: 'A modern, enterprise-grade content management system', type: 'STRING', scope: 'GLOBAL', category: 'GENERAL', isPublic: true, description: 'Site meta description' },
      { key: 'site_url', value: 'https://cms.example.com', type: 'URL', scope: 'GLOBAL', category: 'GENERAL', isPublic: true, description: 'Canonical site URL' },
      { key: 'site_logo', value: '/uploads/logo.svg', type: 'STRING', scope: 'GLOBAL', category: 'GENERAL', isPublic: true, description: 'Site logo URL' },
      { key: 'site_favicon', value: '/favicon.ico', type: 'STRING', scope: 'GLOBAL', category: 'GENERAL', isPublic: true, description: 'Favicon URL' },
      { key: 'site_email', value: 'admin@example.com', type: 'EMAIL', scope: 'GLOBAL', category: 'GENERAL', description: 'Primary contact email' },
      // Reading
      { key: 'posts_per_page', value: '10', type: 'NUMBER', scope: 'GLOBAL', category: 'READING', description: 'Number of posts per page' },
      { key: 'default_content_type', value: 'post', type: 'STRING', scope: 'GLOBAL', category: 'READING', description: 'Default content type' },
      // Discussion
      { key: 'enable_comments', value: 'true', type: 'BOOLEAN', scope: 'GLOBAL', category: 'DISCUSSION', isPublic: true, description: 'Enable comments globally' },
      { key: 'comment_moderation', value: 'true', type: 'BOOLEAN', scope: 'GLOBAL', category: 'DISCUSSION', description: 'Require comment moderation' },
      // Localization
      { key: 'locale_language', value: 'en', type: 'STRING', scope: 'GLOBAL', category: 'LOCALIZATION', description: 'Primary language' },
      { key: 'locale_timezone', value: 'UTC', type: 'STRING', scope: 'GLOBAL', category: 'LOCALIZATION', description: 'Default timezone' },
    ],
  });

  log('Settings', 12);

  // ============================================================
  // 10. COMMENTS
  // ============================================================
  console.log('\n--- Comments ---');

  await db.comment.createMany({
    data: [
      {
        content: 'Excellent article! The TypeScript examples are really clear and practical. I especially liked the section on generics — it demystified a topic I\'ve been struggling with.',
        authorId: editorUser.id,
        contentItemId: tsPost.id,
        status: 'APPROVED',
        ipAddress: '192.168.1.45',
        createdAt: daysAgo(4),
      },
      {
        content: 'Could you cover more about utility types like Partial, Required, and Pick in a follow-up?',
        authorId: authorUser.id,
        contentItemId: tsPost.id,
        status: 'APPROVED',
        ipAddress: '192.168.1.22',
        createdAt: daysAgo(3),
      },
      {
        content: 'This helped me improve my Next.js app\'s Lighthouse score from 72 to 98. The Server Components explanation was exactly what I needed.',
        authorId: editorUser.id,
        contentItemId: nextjsPost.id,
        status: 'APPROVED',
        createdAt: daysAgo(2),
      },
      {
        content: 'Great insights on scaling! We implemented the trunk-based development approach and it reduced our merge conflicts by 60%.',
        authorId: authorUser.id,
        contentItemId: businessPost.id,
        status: 'APPROVED',
        createdAt: daysAgo(15),
      },
      {
        content: 'Do you have any recommendations for team sizes above 100 engineers? The strategies here seem focused on the 5-50 range.',
        authorId: adminUser.id,
        contentItemId: businessPost.id,
        status: 'PENDING',
        createdAt: daysAgo(14),
      },
      {
        content: 'I disagree with some of the points about design tokens. In practice, we found that using CSS custom properties creates too much abstraction overhead.',
        authorId: authorUser.id,
        contentItemId: designPost.id,
        status: 'APPROVED',
        createdAt: daysAgo(9),
      },
      {
        content: 'Container queries are amazing! We\'ve been using them in production for 6 months now and they\'ve eliminated so many media query hacks.',
        authorId: editorUser.id,
        contentItemId: cssPost.id,
        status: 'PENDING',
        createdAt: daysAgo(1),
      },
    ],
  });

  log('Comments', 7);

  // ============================================================
  // 11. NOTIFICATIONS
  // ============================================================
  console.log('\n--- Notifications ---');

  await db.notification.createMany({
    data: [
      {
        type: 'INFO',
        title: 'Welcome to the CMS',
        message: 'Your account has been set up successfully. Start by creating your first content type or importing existing content.',
        channel: 'IN_APP',
        userId: adminUser.id,
        isRead: true,
        createdAt: daysAgo(30),
      },
      {
        type: 'SUCCESS',
        title: 'Content Published',
        message: 'Your article "Getting Started with TypeScript in 2025" has been published and is now live on the site.',
        channel: 'IN_APP',
        userId: authorUser.id,
        isRead: true,
        link: '/content/edit/' + tsPost.id,
        createdAt: daysAgo(5),
      },
      {
        type: 'ACTION_REQUIRED',
        title: 'Content Awaiting Review',
        message: '2 content items are pending your review. Please review them at your earliest convenience.',
        channel: 'IN_APP',
        userId: editorUser.id,
        isRead: false,
        createdAt: daysAgo(2),
      },
      {
        type: 'WARNING',
        title: 'Comment Pending Moderation',
        message: 'A new comment on "Startup Scaling Strategies for Tech Teams" is pending moderation.',
        channel: 'IN_APP',
        userId: adminUser.id,
        isRead: false,
        createdAt: daysAgo(14),
      },
      {
        type: 'INFO',
        title: 'New Feature Available',
        message: 'AI content generation is now available in beta. Try it from the content editor to generate drafts, summaries, and meta descriptions.',
        channel: 'IN_APP',
        userId: authorUser.id,
        isRead: false,
        createdAt: daysAgo(1),
      },
      {
        type: 'SUCCESS',
        title: 'Backup Completed',
        message: 'Automated daily backup completed successfully. 42.3 MB compressed.',
        channel: 'IN_APP',
        userId: adminUser.id,
        isRead: true,
        createdAt: daysAgo(1),
      },
      {
        type: 'ERROR',
        title: 'Media Upload Failed',
        message: 'Failed to process uploaded file "raw-footage.mp4". The file exceeds the maximum upload size of 50 MB.',
        channel: 'IN_APP',
        userId: authorUser.id,
        isRead: false,
        createdAt: daysAgo(1),
      },
    ],
  });

  log('Notifications', 7);

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n✅ Seed completed successfully!\n');

  const counts = {
    Users: await db.user.count(),
    AuthorProfiles: await db.authorProfile.count(),
    ContentTypes: await db.contentType.count(),
    Categories: await db.category.count(),
    Tags: await db.tag.count(),
    MediaFolders: await db.mediaFolder.count(),
    Media: await db.media.count(),
    ContentItems: await db.contentItem.count(),
    Navigation: await db.navigation.count(),
    Settings: await db.setting.count(),
    Comments: await db.comment.count(),
    Notifications: await db.notification.count(),
  };

  console.log('--- Database Summary ---');
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  ${name}: ${count}`);
  }
  console.log('');

  // Print login credentials
  console.log('--- Login Credentials ---');
  console.log('  Admin:   admin@example.com / admin123');
  console.log('  Editor:  editor@example.com / editor123');
  console.log('  Author:  author@example.com / author123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
