import { PrismaClient, PostStatus } from '@prisma/client';
import fs from 'fs';
import { markdownToEditorHtml } from '../src/lib/pipeline/markdown-to-html';

const prisma = new PrismaClient();

const VERDANT_SITE_ID = 'cmtzpnikt0000k9ooun4tk151';
const ADMIN_USER_ID = 'cmt0pg30r0000uwmza35j6bwu';

async function main() {
  console.log('Starting sync of Verdant content into CMS database...');

  // 1. Get ContentType IDs
  const postType = await prisma.contentType.findFirst({ where: { slug: 'post' } });
  const pageType = await prisma.contentType.findFirst({ where: { slug: 'page' } });

  if (!postType || !pageType) {
    throw new Error('Content types post/page not found in DB');
  }

  // 2. Sync Static Pages
  console.log('\n--- Syncing Static Pages ---');
  const staticPages = [
    {
      title: 'About Verdant',
      slug: 'about',
      excerpt: 'We started Verdant with one simple belief: everyone deserves to experience the joy of growing healthy, beautiful indoor plants.',
      content: `<h1>About Verdant</h1>
<p>We started Verdant with one simple belief: everyone deserves to experience the joy of growing healthy, beautiful indoor plants.</p>
<h2>Our Mission</h2>
<p>Founded in 2023, Verdant was born from a frustration we hear all too often: &ldquo;I love plants, but I keep killing them.&rdquo;</p>
<p>Our founder, Elena Greenfield, spent over a decade as a professional horticulturist before realizing that the best plant care advice was locked behind paywalls, buried in jargon, or simply wrong.</p>
<p>Verdant exists to bridge that gap &mdash; to make expert-level plant knowledge accessible, actionable, and genuinely enjoyable to read. Every guide is researched, tested in real homes, and written with beginners in mind.</p>
<img src="https://verdantt.vercel.app/images/hero-plant.jpg" alt="Lush indoor garden" />
<h2>What We Stand For</h2>
<h3>Plant-First Philosophy</h3>
<p>Every piece of advice we share is rooted in genuine care for plants and the people who grow them. We believe thriving plants lead to thriving spaces.</p>
<h3>Science-Backed Guidance</h3>
<p>Our care guides combine horticultural science with real-world experience. We test every tip in our own indoor gardens before publishing.</p>
<h3>Community Driven</h3>
<p>Verdant is built by plant lovers, for plant lovers. Our growing community of readers shapes the content we create and the topics we cover.</p>
<h2>Join Our Growing Community</h2>
<p>Subscribe to our newsletter and get weekly plant care tips, new guides, and exclusive content delivered to your inbox.</p>`,
    },
    {
      title: 'Contact Us',
      slug: 'contact',
      excerpt: "Have a question, suggestion, or just want to say hello? We'd love to hear from you.",
      content: `<h1>Contact Us</h1>
<p>Have a question, suggestion, or just want to say hello? We&rsquo;d love to hear from you.</p>
<h2>Get In Touch</h2>
<p>Whether you need plant care advice, have feedback on our guides, or want to explore partnership opportunities, our team is here to help.</p>
<p>Email: contact@verdant.com</p>
<h2>Send us a Message</h2>
<p>Reach out through our online contact form anytime and our team will get back to you within 24-48 business hours.</p>`,
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      excerpt: 'Privacy Policy for Verdant - Learn how we collect, use, and protect your personal information.',
      content: `<h1>Privacy Policy</h1>
<p><em>Last updated: January 1, 2025</em></p>
<h2>1. Information We Collect</h2>
<p>When you visit Verdant, we may collect certain information to improve your experience. This includes:</p>
<ul>
  <li><strong>Information you provide:</strong> When you leave a comment, subscribe to our newsletter, or contact us, we collect your name, email address, and any other information you choose to share.</li>
  <li><strong>Automatically collected data:</strong> We may collect technical information such as your IP address, browser type, operating system, and pages visited to help us understand how visitors use our site.</li>
  <li><strong>Cookies:</strong> We use cookies to remember your preferences and improve your browsing experience.</li>
</ul>
<h2>2. How We Use Your Information</h2>
<p>We use the information we collect for the following purposes:</p>
<ul>
  <li>To respond to your comments, questions, and requests</li>
  <li>To send you our newsletter (only if you explicitly subscribe)</li>
  <li>To improve our website content and user experience</li>
  <li>To analyze site traffic and usage patterns</li>
  <li>To protect against spam, abuse, and security threats</li>
</ul>
<h2>3. Comments</h2>
<p>When you leave a comment on an article, your name and the comment content are displayed publicly. Your email address is collected but never displayed publicly. We reserve the right to moderate comments for spam or inappropriate content.</p>
<h2>4. Newsletter</h2>
<p>If you subscribe to our newsletter, we will use your email address solely to send you plant care tips, new articles, and updates about Verdant. You can unsubscribe at any time using the link provided in every email.</p>
<h2>5. Third-Party Services</h2>
<p>We may use third-party services for analytics or email delivery. These services have their own privacy policies, and we do not sell or share your personal information with third parties for marketing purposes.</p>
<h2>6. Data Security</h2>
<p>We take reasonable measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction.</p>
<h2>7. Your Rights</h2>
<p>You have the right to request access to, correction of, or deletion of your personal data, or to unsubscribe from our newsletter at any time.</p>
<h2>8. Contact Us</h2>
<p>If you have any questions about this Privacy Policy, please contact us at <strong>privacy@verdant.com</strong>.</p>`,
    },
  ];

  for (const page of staticPages) {
    const existing = await prisma.contentItem.findFirst({
      where: {
        slug: page.slug,
        contentTypeId: pageType.id,
        siteId: VERDANT_SITE_ID,
      },
    });

    if (existing) {
      await prisma.contentItem.update({
        where: { id: existing.id },
        data: {
          title: page.title,
          content: page.content,
          excerpt: page.excerpt,
          status: PostStatus.PUBLISHED,
          publishedAt: existing.publishedAt || new Date(),
        },
      });
      console.log(`Updated page: ${page.title} (${page.slug})`);
    } else {
      await prisma.contentItem.create({
        data: {
          title: page.title,
          slug: page.slug,
          excerpt: page.excerpt,
          content: page.content,
          status: PostStatus.PUBLISHED,
          contentTypeId: pageType.id,
          siteId: VERDANT_SITE_ID,
          authorId: ADMIN_USER_ID,
          publishedAt: new Date(),
        },
      });
      console.log(`Created page: ${page.title} (${page.slug})`);
    }
  }

  // 3. Sync Categories for Verdant
  console.log('\n--- Syncing Categories ---');
  const categoryDefs = [
    { name: 'Plant Care', slug: 'plant-care', description: 'Essential plant care tips and maintenance guides' },
    { name: 'Beginner Guides', slug: 'beginner-guides', description: 'Getting started guides for first-time plant parents' },
    { name: 'Design Ideas', slug: 'design-ideas', description: 'Interior styling and plant arrangement ideas' },
    { name: 'Plant Profiles', slug: 'plant-profiles', description: 'In-depth profiles and care requirements for popular plants' },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoryDefs) {
    const existingCat = await prisma.category.findFirst({
      where: {
        slug: cat.slug,
        siteId: VERDANT_SITE_ID,
      },
    });

    if (existingCat) {
      categoryMap.set(cat.slug, existingCat.id);
      console.log(`Found category: ${cat.name} -> ${existingCat.id}`);
    } else {
      const created = await prisma.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          siteId: VERDANT_SITE_ID,
        },
      });
      categoryMap.set(cat.slug, created.id);
      console.log(`Created category: ${cat.name} -> ${created.id}`);
    }
  }

  // 4. Sync Blog Posts
  console.log('\n--- Syncing Blog Posts ---');
  // Read article-content.ts from Verdant
  const articleContentFile = 'C:/Users/ABDELLAH AIT-SI/Desktop/Verdant/src/lib/article-content.ts';
  const articleContentText = fs.readFileSync(articleContentFile, 'utf8');

  // Helper to extract content by slug from article-content.ts
  function getRawArticleContent(slug: string): string {
    const key = `"${slug}":`;
    const idx = articleContentText.indexOf(key);
    if (idx === -1) return '';
    const startBacktick = articleContentText.indexOf('`', idx);
    if (startBacktick === -1) return '';
    const endBacktick = articleContentText.indexOf('`', startBacktick + 1);
    if (endBacktick === -1) return '';
    return articleContentText.slice(startBacktick + 1, endBacktick).trim();
  }

  const blogPosts = [
    {
      title: 'The Complete Monstera Care Guide: From Propagation to Blooming',
      slug: 'complete-monstera-care-guide',
      excerpt: 'Everything you need to know about growing and maintaining stunning monstera plants, including watering schedules, light requirements, and common problems.',
      categorySlug: 'plant-care',
      coverImage: '/images/article-monstera-care.jpg',
      date: '2025-01-10',
    },
    {
      title: '15 Best Low-Light Plants That Thrive in Dark Apartments',
      slug: 'best-low-light-plants',
      excerpt: 'No sunny windows? No problem. These resilient plants flourish in low-light conditions and are perfect for apartments with limited natural light.',
      categorySlug: 'beginner-guides',
      coverImage: '/images/article-beginner-plants.jpg',
      date: '2025-01-08',
    },
    {
      title: 'How to Create a Lush Plant Shelf That Looks Professionally Styled',
      slug: 'styled-plant-shelf',
      excerpt: 'Transform any shelf into a stunning botanical display with our expert styling tips, plant pairings, and arrangement principles.',
      categorySlug: 'design-ideas',
      coverImage: '/images/article-living-room.jpg',
      date: '2025-01-05',
    },
    {
      title: 'Succulent Care 101: The Definitive Beginner Handbook',
      slug: 'succulent-care-beginner-handbook',
      excerpt: 'Master the art of growing succulents indoors with our comprehensive guide covering soil, watering, light, and troubleshooting.',
      categorySlug: 'beginner-guides',
      coverImage: '/images/article-succulents.jpg',
      date: '2025-01-03',
    },
    {
      title: 'Calathea Care: Why Your Prayer Plant Is Crispy and How to Fix It',
      slug: 'calathea-care-crispy-leaves',
      excerpt: 'Calatheas are famously finicky, but they reward patient caregivers with breathtaking foliage. Learn the exact conditions these tropical beauties need.',
      categorySlug: 'plant-profiles',
      coverImage: '/images/article-calathea.jpg',
      date: '2024-12-28',
    },
    {
      title: 'The Best Air-Purifying Houseplants Backed by NASA Research',
      slug: 'air-purifying-houseplants-nasa',
      excerpt: 'Discover which houseplants are scientifically proven to clean indoor air, and how many you actually need to make a difference in your home.',
      categorySlug: 'plant-care',
      coverImage: '/images/article-air-purifying.jpg',
      date: '2024-12-25',
    },
    {
      title: 'Pothos Varieties: A Visual Guide to 12 Stunning Cultivars',
      slug: 'pothos-varieties-visual-guide',
      excerpt: 'From the classic Golden Pothos to the rare Cebu Blue, explore the diverse world of Epipremnum aureum cultivars for your collection.',
      categorySlug: 'plant-profiles',
      coverImage: '/images/article-pothos.jpg',
      date: '2024-12-22',
    },
    {
      title: 'Step-by-Step Guide to Repotting Your Houseplants Without Stress',
      slug: 'repotting-houseplants-guide',
      excerpt: 'Repotting doesn\'t have to be messy or stressful. Our horticulturist walks you through the process with clear, foolproof steps.',
      categorySlug: 'plant-care',
      coverImage: '/images/article-repotting.jpg',
      date: '2024-12-18',
    },
    {
      title: '10 Rare Houseplants Worth the Investment for Serious Collectors',
      slug: 'rare-houseplants-worth-investment',
      excerpt: 'For plant enthusiasts ready to expand beyond the basics, these rare specimens offer unique beauty and the thrill of the hunt.',
      categorySlug: 'plant-profiles',
      coverImage: '/images/article-rare-plants.jpg',
      date: '2024-12-15',
    },
  ];

  for (const post of blogPosts) {
    // 1. Featured image Media record
    const imageUrl = post.coverImage.startsWith('http')
      ? post.coverImage
      : `https://verdantt.vercel.app${post.coverImage}`;

    const filename = post.coverImage.split('/').pop() || `${post.slug}.jpg`;
    let media = await prisma.media.findFirst({
      where: {
        url: imageUrl,
        siteId: VERDANT_SITE_ID,
      },
    });

    if (!media) {
      media = await prisma.media.create({
        data: {
          filename,
          originalName: filename,
          mimeType: 'image/jpeg',
          size: 50000,
          url: imageUrl,
          thumbnailUrl: imageUrl,
          processingStatus: 'READY',
          scanStatus: 'CLEAN',
          uploadedById: ADMIN_USER_ID,
          siteId: VERDANT_SITE_ID,
        },
      });
      console.log(`Created media record for ${filename}`);
    }

    // 2. Raw content converted to semantic editor HTML
    const rawMarkdown = getRawArticleContent(post.slug);
    const editorHtml = rawMarkdown ? markdownToEditorHtml(rawMarkdown) : `<p>${post.excerpt}</p>`;

    // 3. Upsert ContentItem
    const categoryId = categoryMap.get(post.categorySlug) || null;
    const existing = await prisma.contentItem.findFirst({
      where: {
        slug: post.slug,
        contentTypeId: postType.id,
        siteId: VERDANT_SITE_ID,
      },
    });

    if (existing) {
      await prisma.contentItem.update({
        where: { id: existing.id },
        data: {
          title: post.title,
          excerpt: post.excerpt,
          content: editorHtml,
          categoryId,
          featuredImageId: media.id,
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(post.date),
        },
      });
      console.log(`Updated blog post: ${post.title} (${post.slug})`);
    } else {
      await prisma.contentItem.create({
        data: {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: editorHtml,
          categoryId,
          featuredImageId: media.id,
          status: PostStatus.PUBLISHED,
          contentTypeId: postType.id,
          siteId: VERDANT_SITE_ID,
          authorId: ADMIN_USER_ID,
          publishedAt: new Date(post.date),
        },
      });
      console.log(`Created blog post: ${post.title} (${post.slug})`);
    }
  }

  console.log('\nSync completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during sync:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
