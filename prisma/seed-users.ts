// ============================================================
// SEED: Sample users for the Users management page
// ============================================================
//
// Populates the User table with realistic sample users covering
// ALL roles (SUPER_ADMIN, ADMIN, EDITOR, AUTHOR, CONTRIBUTOR)
// and varied statuses (ACTIVE, SUSPENDED, DEACTIVATED, INVITED).
//
// Run: bun run prisma/seed-users.ts
// ============================================================

import { db } from '../src/lib/db';

async function main() {
  console.log('Seeding sample users...');

  // Check for required AuthorProfile relation — users may need profiles
  // for some features, but the Users page itself doesn't require them.

  const users = [
    {
      email: 'sarah.mitchell@newwdch.com',
      name: 'Sarah Mitchell',
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
      bio: 'Platform administrator overseeing content operations and user management.',
      lastLoginAt: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours ago
      createdAt: new Date(Date.now() - 120 * 24 * 3600 * 1000), // ~4 months ago
    },
    {
      email: 'david.chen@newwdch.com',
      name: 'David Chen',
      role: 'EDITOR' as const,
      status: 'ACTIVE' as const,
      bio: 'Senior editor responsible for content quality and publishing decisions.',
      lastLoginAt: new Date(Date.now() - 1 * 24 * 3600 * 1000), // 1 day ago
      createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000), // ~3 months ago
    },
    {
      email: 'maria.rodriguez@newwdch.com',
      name: 'Maria Rodriguez',
      role: 'EDITOR' as const,
      status: 'SUSPENDED' as const,
      bio: 'Content editor currently on leave.',
      lastLoginAt: new Date(Date.now() - 30 * 24 * 3600 * 1000), // 30 days ago
      createdAt: new Date(Date.now() - 200 * 24 * 3600 * 1000), // ~6.5 months ago
    },
    {
      email: 'james.thompson@newwdch.com',
      name: 'James Thompson',
      role: 'AUTHOR' as const,
      status: 'ACTIVE' as const,
      bio: 'Staff writer covering technology, web development, and AI trends.',
      lastLoginAt: new Date(Date.now() - 5 * 3600 * 1000), // 5 hours ago
      createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000), // ~2 months ago
    },
    {
      email: 'emily.davis@newwdch.com',
      name: 'Emily Davis',
      role: 'AUTHOR' as const,
      status: 'ACTIVE' as const,
      bio: 'Content creator specializing in SEO, marketing, and growth strategies.',
      lastLoginAt: new Date(Date.now() - 3 * 24 * 3600 * 1000), // 3 days ago
      createdAt: new Date(Date.now() - 45 * 24 * 3600 * 1000), // ~1.5 months ago
    },
    {
      email: 'michael.brown@newwdch.com',
      name: 'Michael Brown',
      role: 'CONTRIBUTOR' as const,
      status: 'ACTIVE' as const,
      bio: 'Freelance contributor writing about design and UX.',
      lastLoginAt: new Date(Date.now() - 7 * 24 * 3600 * 1000), // 7 days ago
      createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000), // ~1 month ago
    },
    {
      email: 'lisa.anderson@newwdch.com',
      name: 'Lisa Anderson',
      role: 'CONTRIBUTOR' as const,
      status: 'DEACTIVATED' as const,
      bio: 'Former guest contributor.',
      lastLoginAt: new Date(Date.now() - 90 * 24 * 3600 * 1000), // 90 days ago
      createdAt: new Date(Date.now() - 150 * 24 * 3600 * 1000), // ~5 months ago
    },
    {
      email: 'robert.wilson@newwdch.com',
      name: 'Robert Wilson',
      role: 'AUTHOR' as const,
      status: 'SUSPENDED' as const,
      bio: 'Author account temporarily suspended pending review.',
      lastLoginAt: new Date(Date.now() - 14 * 24 * 3600 * 1000), // 14 days ago
      createdAt: new Date(Date.now() - 75 * 24 * 3600 * 1000), // ~2.5 months ago
    },
    {
      email: 'jennifer.lee@newwdch.com',
      name: 'Jennifer Lee',
      role: 'ADMIN' as const,
      status: 'INVITED' as const,
      bio: 'Newly invited administrator — pending account setup.',
      lastLoginAt: null,
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000), // 2 days ago
    },
    {
      email: 'kevin.park@newwdch.com',
      name: 'Kevin Park',
      role: 'CONTRIBUTOR' as const,
      status: 'INVITED' as const,
      bio: 'Guest contributor invited to write a series on DevOps.',
      lastLoginAt: null,
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000), // 1 day ago
    },
  ];

  let created = 0;
  let updated = 0;

  for (const user of users) {
    const existing = await db.user.findFirst({ where: { email: user.email } });
    if (existing) {
      // Update in place — preserve password from existing record
      await db.user.update({
        where: { id: existing.id },
        data: {
          name: user.name,
          role: user.role,
          status: user.status,
          bio: user.bio,
          lastLoginAt: user.lastLoginAt,
        },
      });
      updated++;
      console.log(`  Updated: ${user.email} (${user.role}, ${user.status})`);
    } else {
      // Create new user with a default password
      await db.user.create({
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          bio: user.bio,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          password: '$2a$10$placeholderHashForSeedUsersOnly',
          emailVerified: user.status === 'ACTIVE',
        },
      });
      created++;
      console.log(`  Created: ${user.email} (${user.role}, ${user.status})`);
    }
  }

  console.log(`\n✓ User seed complete!`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Total sample users: ${users.length}`);

  // Summary by role
  const allUsers = await db.user.findMany({ select: { role: true, status: true } });
  const byRole = allUsers.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const byStatus = allUsers.reduce((acc, u) => {
    acc[u.status] = (acc[u.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`  By role: ${JSON.stringify(byRole)}`);
  console.log(`  By status: ${JSON.stringify(byStatus)}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
