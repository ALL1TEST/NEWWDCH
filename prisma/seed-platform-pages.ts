import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const pageType = await prisma.contentType.findFirst({ where: { slug: 'page' } });
  const author = await prisma.user.findFirst({ where: { id: 'cmt0pg30r0000uwmza35j6bwu' } }) || await prisma.user.findFirst({ where: { role: { in: ['OWNER', 'PLATFORM_ADMIN', 'ADMIN'] } } });
  if (!pageType || !author) {
    console.error('Missing pageType or author');
    return;
  }

  // Move the 2 car drafts to ww site
  await prisma.contentItem.updateMany({
    where: { siteId: null, title: 'Best Cars for Daily Driving in 2026' },
    data: { siteId: 'cmtugsrgh001vk9fczbsh4t1o' },
  });

  const pages = [
    {
      title: 'About Karmax',
      slug: 'about',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-20T10:00:00Z'),
      seoTitle: 'About Karmax — One Calm Workflow for Everything You Publish',
      seoDescription: 'Learn about the Karmax mission, our editorial principles, and how we empower publishers to run every site from one calm dashboard.',
      content: '<h2>One calm workflow for everything you publish</h2><p>Karmax brings AI-assisted writing, a complete SEO suite, media management, newsletter and automation together — and connects straight to WordPress or any REST CMS.</p><h3>Why Karmax exists</h3><p>Most publishing teams draft in one app, check SEO in another, store media somewhere else, and still publish by hand. Karmax replaces that patchwork with a single, calm platform connected directly to the sites you already operate.</p><h3>Our Core Principles</h3><ul><li><strong>Honest AI Assistance:</strong> AI accelerates your workflow without overwriting your editorial voice.</li><li><strong>Zero Platform Lock-in:</strong> Your content belongs to you. We publish to your CMS via standard APIs.</li><li><strong>Multi-Site Native:</strong> Manage one site or fifty without switching accounts or losing context.</li></ul>',
    },
    {
      title: 'Contact Us',
      slug: 'contact',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-21T10:00:00Z'),
      seoTitle: 'Contact Karmax — Support, Sales & Inquiries',
      seoDescription: 'Get in touch with the Karmax team for platform support, enterprise sales, security disclosures, and partnership inquiries.',
      content: '<h2>Get in Touch with Karmax</h2><p>Have questions about Karmax, need help with your subscription, or want to discuss enterprise multi-site deployments? Our team is here to assist.</p><h3>Support Channels</h3><p><strong>Customer Support:</strong> support@karmax.io — response within 24 hours.</p><p><strong>Sales & Enterprise:</strong> sales@karmax.io — custom limits, SLA guarantees, and dedicated onboarding.</p><p><strong>Security Inquiries:</strong> security@karmax.io — responsible disclosure and security compliance queries.</p>',
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-22T10:00:00Z'),
      seoTitle: 'Privacy Policy — Karmax',
      seoDescription: 'Read the Karmax Privacy Policy to understand how we collect, use, protect, and manage your personal data.',
      content: '<h2>Privacy Policy</h2><p>Last updated: September 2026</p><p>This Privacy Policy describes how Karmax (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) collects, uses, and safeguards personal information when you access our hosted service and platform.</p><h3>Information We Collect</h3><p>We collect account details (name, email), authentication credentials, subscription status, and usage telemetry required to provide reliable multi-site publishing services.</p><h3>Data Protection & Security</h3><p>All data is encrypted in transit using TLS 1.3 and at rest with AES-256. We never sell your personal data or content to third parties.</p>',
    },
    {
      title: 'Terms of Service',
      slug: 'terms',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-22T10:00:00Z'),
      seoTitle: 'Terms of Service — Karmax',
      seoDescription: 'Read the terms and conditions that govern your access to and use of the Karmax multi-site publishing platform.',
      content: '<h2>Terms of Service</h2><p>Last updated: September 2026</p><p>Please read these Terms of Service carefully before using the Karmax platform. By accessing or using the Service, you agree to be bound by these terms.</p><h3>Account Responsibilities</h3><p>You are responsible for maintaining the security of your account and credentials. You must immediately notify us of any unauthorized use.</p><h3>Subscription & Billing</h3><p>Paid subscriptions renew automatically unless cancelled prior to the billing date. Payments are processed securely via Stripe.</p>',
    },
    {
      title: 'Security & Compliance',
      slug: 'security',
      status: 'PUBLISHED' as const,
      contentTypeId: pageType.id,
      authorId: author.id,
      siteId: null,
      publishedAt: new Date('2026-09-23T10:00:00Z'),
      seoTitle: 'Security & Infrastructure — Karmax',
      seoDescription: 'Learn about Karmax security architecture, data isolation, encryption standards, and compliance measures.',
      content: '<h2>Security & Compliance at Karmax</h2><p>Security and data integrity are fundamental to Karmax. We design our multi-tenant architecture with defense-in-depth principles.</p><h3>Infrastructure & Encryption</h3><p>All network communications require TLS 1.3. Databases and backups are protected with AES-256 encryption at rest. Each tenant\'s data is strictly partitioned and isolated.</p><h3>Backup & Disaster Recovery</h3><p>Automated snapshot backups run continuously with point-in-time recovery capabilities to guarantee business continuity.</p>',
    },
  ];

  for (const page of pages) {
    const existing = await prisma.contentItem.findFirst({
      where: { slug: page.slug, contentTypeId: pageType.id, siteId: null },
    });
    if (existing) {
      await prisma.contentItem.update({
        where: { id: existing.id },
        data: page,
      });
      console.log('Updated page:', page.title);
    } else {
      await prisma.contentItem.create({ data: page });
      console.log('Created page:', page.title);
    }
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
