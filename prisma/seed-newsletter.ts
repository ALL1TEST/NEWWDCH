// ============================================================
// SEED: Newsletter — email templates + subscribers + campaigns
// ============================================================
//
// Seeds:
//   - 4 Email Templates (reusable designs)
//   - 6 Subscribers (mix of statuses/sources)
//   - 6 Campaigns (referencing the templates, mix of statuses)
//
// Run: bun run prisma/seed-newsletter.ts
// ============================================================

import { db } from '../src/lib/db';

async function main() {
  console.log('Seeding Newsletter sample data...');

  const user = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  });
  if (!user) {
    console.error('No SUPER_ADMIN user found. Aborting.');
    process.exit(1);
  }
  console.log(`Using author: ${user.id}`);

  // ---------- 4 Email Templates ----------
  const templates = [
    {
      name: 'Weekly Newsletter',
      slug: 'weekly-newsletter',
      subject: 'Your weekly roundup',
      previewText: 'The latest updates, tips, and news',
      htmlBody: '<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="color:#f59e0b;">Weekly Newsletter</h1><p>Hello {{name}},</p><p>Here are this week\'s highlights:</p><ul><li>New features released</li><li>Tips and best practices</li><li>Community updates</li></ul><p>Read more on our blog.</p></body></html>',
      fromName: 'NEWWDCH Team',
      fromEmail: 'newsletter@example.com',
      replyTo: 'reply@example.com',
      category: 'MARKETING',
      status: 'ENABLED',
    },
    {
      name: 'Product Announcement',
      slug: 'product-announcement',
      subject: 'We just launched something new',
      previewText: 'Check out our latest product update',
      htmlBody: '<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="color:#f59e0b;">New Product Launch</h1><p>Hello {{name}},</p><p>We\'re excited to announce our new feature!</p><p>This update brings:</p><ul><li>Improved performance</li><li>Better user experience</li><li>New automation capabilities</li></ul><p>Log in to try it now.</p></body></html>',
      fromName: 'NEWWDCH Team',
      fromEmail: 'product@example.com',
      replyTo: 'reply@example.com',
      category: 'MARKETING',
      status: 'ENABLED',
    },
    {
      name: 'Welcome Email',
      slug: 'welcome-email',
      subject: 'Welcome to NEWWDCH!',
      previewText: 'Get started with these quick tips',
      htmlBody: '<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="color:#f59e0b;">Welcome, {{name}}!</h1><p>Thanks for joining NEWWDCH. Here\'s how to get started:</p><ol><li>Complete your profile</li><li>Create your first article</li><li>Set up your SEO settings</li><li>Explore the automation builder</li></ol><p>Need help? Reply to this email.</p></body></html>',
      fromName: 'NEWWDCH Team',
      fromEmail: 'welcome@example.com',
      replyTo: 'support@example.com',
      category: 'NEWSLETTER',
      status: 'ENABLED',
    },
    {
      name: 'Promotional Offer',
      slug: 'promotional-offer',
      subject: 'Special offer just for you',
      previewText: 'Limited time discount inside',
      htmlBody: '<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="color:#f59e0b;">Special Offer</h1><p>Hello {{name}},</p><p>As a valued subscriber, we\'re offering you an exclusive discount:</p><div style="background:#fef3c7;padding:20px;border-radius:8px;text-align:center;margin:20px 0;"><span style="font-size:36px;font-weight:bold;color:#f59e0b;">50% OFF</span></div><p>Use code <strong>NEWSLETTER50</strong> at checkout. Offer ends soon!</p></body></html>',
      fromName: 'NEWWDCH Team',
      fromEmail: 'promo@example.com',
      replyTo: 'reply@example.com',
      category: 'MARKETING',
      status: 'ENABLED',
    },
  ];

  const templateIds: string[] = [];
  for (const tpl of templates) {
    const existing = await db.emailTemplate.findFirst({ where: { slug: tpl.slug } });
    if (existing) {
      await db.emailTemplate.update({
        where: { id: existing.id },
        data: { ...tpl, createdById: user.id },
      });
      templateIds.push(existing.id);
      console.log(`  Updated template: ${tpl.name}`);
    } else {
      const created = await db.emailTemplate.create({
        data: { ...tpl, createdById: user.id },
      });
      templateIds.push(created.id);
      console.log(`  Created template: ${tpl.name}`);
    }
  }

  // ---------- 6 Subscribers ----------
  const subscribers = [
    { email: 'olivia.martinez@gmail.com', name: 'Olivia Martinez', status: 'SUBSCRIBED' as const, source: 'FORM', subscribedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) },
    { email: 'james.park@outlook.com', name: 'James Park', status: 'SUBSCRIBED' as const, source: 'IMPORT', subscribedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000) },
    { email: 'sophia.brown@protonmail.com', name: 'Sophia Brown', status: 'UNSUBSCRIBED' as const, source: 'FORM', subscribedAt: new Date(Date.now() - 12 * 24 * 3600 * 1000), unsubscribedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
    { email: 'daniel.kim@fastmail.com', name: 'Daniel Kim', status: 'SUBSCRIBED' as const, source: 'API', subscribedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000) },
    { email: 'emma.wilson@hey.com', name: 'Emma Wilson', status: 'BOUNCED' as const, source: 'IMPORT', subscribedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000) },
    { email: 'liam.anderson@yahoo.com', name: 'Liam Anderson', status: 'SUBSCRIBED' as const, source: 'FORM', subscribedAt: new Date(Date.now() - 6 * 3600 * 1000) },
  ];

  for (const sub of subscribers) {
    const existing = await db.newsletterSubscriber.findFirst({ where: { email: sub.email } });
    if (existing) {
      await db.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { name: sub.name, status: sub.status, source: sub.source, subscribedAt: sub.subscribedAt, unsubscribedAt: sub.unsubscribedAt ?? null },
      });
      console.log(`  Updated subscriber: ${sub.email}`);
    } else {
      await db.newsletterSubscriber.create({ data: sub });
      console.log(`  Created subscriber: ${sub.email}`);
    }
  }

  // Count eligible subscribers (status=SUBSCRIBED) = 4
  const eligibleCount = await db.newsletterSubscriber.count({ where: { status: 'SUBSCRIBED' } });
  console.log(`Eligible subscribers (SUBSCRIBED): ${eligibleCount}`);

  // ---------- 6 Campaigns (referencing templates) ----------
  // Statuses: Draft, Scheduled, Sent x2, Failed, Cancelled (no PAUSED)
  const campaigns = [
    {
      name: 'Weekly Digest — Issue #42',
      subject: 'Your weekly roundup: Next.js 16, CSS tips, and more',
      templateId: templateIds[0], // Weekly Newsletter
      status: 'SENT' as const,
      scheduledAt: null,
      sentAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      recipientCount: eligibleCount,
      openCount: Math.round(eligibleCount * 0.75),  // 75% open rate
      clickCount: Math.round(eligibleCount * 0.25),  // 25% click rate
    },
    {
      name: 'Product Launch Announcement',
      subject: 'Introducing our new automation builder',
      templateId: templateIds[1], // Product Announcement
      status: 'SCHEDULED' as const,
      scheduledAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      sentAt: null,
      recipientCount: eligibleCount,
      openCount: 0,
      clickCount: 0,
    },
    {
      name: 'Black Friday Promo',
      subject: '50% off all annual plans — this weekend only',
      templateId: templateIds[3], // Promotional Offer
      status: 'DRAFT' as const,
      scheduledAt: null,
      sentAt: null,
      recipientCount: eligibleCount,
      openCount: 0,
      clickCount: 0,
    },
    {
      name: 'Monthly Newsletter — August',
      subject: 'What\'s new in August: SEO tips, automation, and backups',
      templateId: templateIds[0], // Weekly Newsletter (reused)
      status: 'SENT' as const,
      scheduledAt: null,
      sentAt: new Date(Date.now() - 14 * 24 * 3600 * 1000),
      recipientCount: eligibleCount,
      openCount: Math.round(eligibleCount * 0.50),  // 50% open rate
      clickCount: Math.round(eligibleCount * 0.25),  // 25% click rate
    },
    {
      name: 'Webinar Invitation',
      subject: 'Join us: Advanced TipTap Editor Workshop',
      templateId: templateIds[1], // Product Announcement (reused)
      status: 'FAILED' as const,
      scheduledAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      sentAt: null,
      recipientCount: eligibleCount,
      openCount: 0,
      clickCount: 0,
      errorMessage: 'SMTP connection failed: getaddrinfo ENOTFOUND smtp.example.com',
    },
    {
      name: 'Welcome Series — Part 1',
      subject: 'Welcome to NEWWDCH! Here\'s how to get started',
      templateId: templateIds[2], // Welcome Email
      status: 'CANCELLED' as const,
      scheduledAt: null,
      sentAt: null,
      recipientCount: eligibleCount,
      openCount: 0,
      clickCount: 0,
    },
  ];

  for (const camp of campaigns) {
    const existing = await db.newsletterCampaign.findFirst({ where: { name: camp.name } });
    if (existing) {
      await db.newsletterCampaign.update({
        where: { id: existing.id },
        data: {
          subject: camp.subject,
          templateId: camp.templateId,
          status: camp.status,
          scheduledAt: camp.scheduledAt,
          sentAt: camp.sentAt,
          recipientCount: camp.recipientCount,
          openCount: camp.openCount,
          clickCount: camp.clickCount,
          errorMessage: (camp as { errorMessage?: string }).errorMessage ?? null,
          createdById: user.id,
        },
      });
      console.log(`  Updated campaign: ${camp.name}`);
    } else {
      await db.newsletterCampaign.create({
        data: {
          name: camp.name,
          subject: camp.subject,
          templateId: camp.templateId,
          status: camp.status,
          scheduledAt: camp.scheduledAt,
          sentAt: camp.sentAt,
          recipientCount: camp.recipientCount,
          openCount: camp.openCount,
          clickCount: camp.clickCount,
          errorMessage: (camp as { errorMessage?: string }).errorMessage ?? null,
          createdById: user.id,
        },
      });
      console.log(`  Created campaign: ${camp.name}`);
    }
  }

  console.log('\n✓ Newsletter seed complete!');
  console.log(`  Email Templates: ${templates.length}`);
  console.log(`  Subscribers: ${subscribers.length} (${eligibleCount} eligible)`);
  console.log(`  Campaigns: ${campaigns.length}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
