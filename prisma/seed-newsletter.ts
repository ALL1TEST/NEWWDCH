// ============================================================
// SEED: Newsletter subscribers + campaigns (6 each)
// ============================================================
//
// Populates the NewsletterSubscriber + NewsletterCampaign tables
// with 6 realistic sample records each so the Newsletter page can
// be visually and functionally tested.
//
// Run: bun run prisma/seed-newsletter.ts
// ============================================================

import { db } from '../src/lib/db';

async function main() {
  console.log('Seeding Newsletter sample data...');

  // Find a user to be the campaign author (required FK).
  const user = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  });
  if (!user) {
    console.error('No SUPER_ADMIN user found. Aborting.');
    process.exit(1);
  }
  console.log(`Using author: ${user.id}`);

  // ---------- 6 Subscribers ----------
  const subscribers = [
    {
      email: 'olivia.martinez@gmail.com',
      name: 'Olivia Martinez',
      status: 'SUBSCRIBED' as const,
      source: 'FORM',
      subscribedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    },
    {
      email: 'james.park@outlook.com',
      name: 'James Park',
      status: 'SUBSCRIBED' as const,
      source: 'IMPORT',
      subscribedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    },
    {
      email: 'sophia.brown@protonmail.com',
      name: 'Sophia Brown',
      status: 'UNSUBSCRIBED' as const,
      source: 'FORM',
      subscribedAt: new Date(Date.now() - 12 * 24 * 3600 * 1000),
      unsubscribedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
    },
    {
      email: 'daniel.kim@fastmail.com',
      name: 'Daniel Kim',
      status: 'SUBSCRIBED' as const,
      source: 'API',
      subscribedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
    },
    {
      email: 'emma.wilson@hey.com',
      name: 'Emma Wilson',
      status: 'BOUNCED' as const,
      source: 'IMPORT',
      subscribedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
    },
    {
      email: 'liam.anderson@yahoo.com',
      name: 'Liam Anderson',
      status: 'SUBSCRIBED' as const,
      source: 'FORM',
      subscribedAt: new Date(Date.now() - 6 * 3600 * 1000),
    },
  ];

  for (const sub of subscribers) {
    const existing = await db.newsletterSubscriber.findFirst({
      where: { email: sub.email },
    });
    if (existing) {
      // Update in place to keep id stable but refresh data.
      await db.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          name: sub.name,
          status: sub.status,
          source: sub.source,
          subscribedAt: sub.subscribedAt,
          unsubscribedAt: sub.unsubscribedAt ?? null,
        },
      });
      console.log(`  Updated subscriber: ${sub.email}`);
    } else {
      await db.newsletterSubscriber.create({ data: sub });
      console.log(`  Created subscriber: ${sub.email}`);
    }
  }

  // ---------- 6 Campaigns ----------
  // Use realistic open/click rates based on the subscriber count.
  const totalSubs = subscribers.length;

  const campaigns = [
    {
      name: 'Weekly Digest — Issue #42',
      subject: 'Your weekly roundup: Next.js 16, CSS tips, and more',
      content: 'This week we cover Next.js 16 features, container queries, and TypeScript generics.',
      status: 'SENT' as const,
      scheduledAt: null,
      sentAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      recipientCount: totalSubs,
      openCount: Math.round(totalSubs * 0.72),  // 72% open rate
      clickCount: Math.round(totalSubs * 0.18),  // 18% click rate
    },
    {
      name: 'Product Launch Announcement',
      subject: 'Introducing our new automation builder',
      content: 'We are excited to announce the new automation builder with a 4-step wizard.',
      status: 'SCHEDULED' as const,
      scheduledAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      sentAt: null,
      recipientCount: totalSubs,
      openCount: 0,
      clickCount: 0,
    },
    {
      name: 'Black Friday Promo',
      subject: '50% off all annual plans — this weekend only',
      content: 'Don\'t miss our biggest sale of the year. Use code BLACKFRIDAY50 at checkout.',
      status: 'DRAFT' as const,
      scheduledAt: null,
      sentAt: null,
      recipientCount: totalSubs,
      openCount: 0,
      clickCount: 0,
    },
    {
      name: 'Monthly Newsletter — August',
      subject: 'What\'s new in August: SEO tips, automation, and backups',
      content: 'August recap: new SEO tools, automation improvements, and backup system updates.',
      status: 'SENT' as const,
      scheduledAt: null,
      sentAt: new Date(Date.now() - 14 * 24 * 3600 * 1000),
      recipientCount: totalSubs,
      openCount: Math.round(totalSubs * 0.55),  // 55% open rate
      clickCount: Math.round(totalSubs * 0.12),  // 12% click rate
    },
    {
      name: 'Webinar Invitation',
      subject: 'Join us: Advanced TipTap Editor Workshop',
      content: 'Learn how to build a production-ready rich text editor with TipTap.',
      status: 'FAILED' as const,
      scheduledAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      sentAt: null,
      recipientCount: totalSubs,
      openCount: 0,
      clickCount: 0,
    },
    {
      name: 'Welcome Series — Part 1',
      subject: 'Welcome to NEWWDCH! Here\'s how to get started',
      content: 'Thanks for joining! In this first email, we\'ll walk you through the dashboard.',
      status: 'PAUSED' as const,
      scheduledAt: new Date(Date.now() + 6 * 3600 * 1000),
      sentAt: null,
      recipientCount: totalSubs,
      openCount: 0,
      clickCount: 0,
    },
  ];

  for (const camp of campaigns) {
    const existing = await db.newsletterCampaign.findFirst({
      where: { name: camp.name },
    });
    if (existing) {
      await db.newsletterCampaign.update({
        where: { id: existing.id },
        data: {
          subject: camp.subject,
          content: camp.content,
          status: camp.status,
          scheduledAt: camp.scheduledAt,
          sentAt: camp.sentAt,
          recipientCount: camp.recipientCount,
          openCount: camp.openCount,
          clickCount: camp.clickCount,
          createdById: user.id,
        },
      });
      console.log(`  Updated campaign: ${camp.name}`);
    } else {
      await db.newsletterCampaign.create({
        data: {
          ...camp,
          createdById: user.id,
        },
      });
      console.log(`  Created campaign: ${camp.name}`);
    }
  }

  console.log('\n✓ Newsletter seed complete!');
  console.log(`  Subscribers: ${subscribers.length}`);
  console.log(`  Campaigns: ${campaigns.length}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
