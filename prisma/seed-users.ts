// ============================================================
// SEED: Sample users for the Users management page (new 2-role schema)
// ============================================================
//
// Populates the User table with realistic sample users covering
// the new simplified role system (ADMIN + EDITOR) and varied
// statuses (ACTIVE, SUSPENDED, DEACTIVATED, INVITED).
//
// EDITOR users get varied `pagePermissions` arrays so admins can
// see how the per-page access UI looks in practice.
//
// Run: bun run prisma/seed-users.ts
// ============================================================

import { db } from '../src/lib/db';

async function main() {
  console.log('Seeding sample users (new 2-role schema)...');

  // Use raw SQL upserts so we can run this even before the legacy
  // migration has converted old role enum values.
  interface SeedUser {
    email: string;
    name: string;
    role: 'ADMIN' | 'EDITOR';
    status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED';
    bio: string;
    lastLoginAt: Date | null;
    createdAt: Date;
    pagePermissions: string[] | null; // null = full access (ADMIN)
  }

  const users: SeedUser[] = [
    // ---------- 2 ADMIN users (full access — pagePermissions = null) ----------
    {
      email: 'sarah.mitchell@newwdch.com',
      name: 'Sarah Mitchell',
      role: 'ADMIN',
      status: 'ACTIVE',
      bio: 'Platform administrator overseeing content operations and user management.',
      lastLoginAt: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours ago
      createdAt: new Date(Date.now() - 120 * 24 * 3600 * 1000),
      pagePermissions: null,
    },
    {
      email: 'jennifer.lee@newwdch.com',
      name: 'Jennifer Lee',
      role: 'ADMIN',
      status: 'INVITED',
      bio: 'Newly invited administrator — pending account setup.',
      lastLoginAt: null,
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      pagePermissions: null,
    },

    // ---------- 8 EDITOR users with varied pagePermissions ----------

    // 2 with most pages (dashboard, calendar, content, media, comments, newsletter)
    {
      email: 'david.chen@newwdch.com',
      name: 'David Chen',
      role: 'EDITOR',
      status: 'ACTIVE',
      bio: 'Senior editor responsible for content quality and publishing decisions.',
      lastLoginAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000),
      pagePermissions: ['dashboard', 'calendar', 'content', 'media', 'comments', 'newsletter'],
    },
    {
      email: 'olivia.martin@newwdch.com',
      name: 'Olivia Martin',
      role: 'EDITOR',
      status: 'ACTIVE',
      bio: 'Content strategist with a focus on newsletter growth and audience engagement.',
      lastLoginAt: new Date(Date.now() - 6 * 3600 * 1000),
      createdAt: new Date(Date.now() - 75 * 24 * 3600 * 1000),
      pagePermissions: ['dashboard', 'calendar', 'content', 'media', 'comments', 'newsletter'],
    },

    // 2 with content + media only
    {
      email: 'james.thompson@newwdch.com',
      name: 'James Thompson',
      role: 'EDITOR',
      status: 'ACTIVE',
      bio: 'Staff writer covering technology, web development, and AI trends.',
      lastLoginAt: new Date(Date.now() - 5 * 3600 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000),
      pagePermissions: ['content', 'media'],
    },
    {
      email: 'emily.davis@newwdch.com',
      name: 'Emily Davis',
      role: 'EDITOR',
      status: 'ACTIVE',
      bio: 'Content creator specializing in marketing and growth strategies.',
      lastLoginAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      createdAt: new Date(Date.now() - 45 * 24 * 3600 * 1000),
      pagePermissions: ['content', 'media'],
    },

    // 2 with content + media + seo + ai
    {
      email: 'maria.rodriguez@newwdch.com',
      name: 'Maria Rodriguez',
      role: 'EDITOR',
      status: 'SUSPENDED',
      bio: 'SEO & AI specialist, currently on leave.',
      lastLoginAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      createdAt: new Date(Date.now() - 200 * 24 * 3600 * 1000),
      pagePermissions: ['content', 'media', 'seo', 'ai'],
    },
    {
      email: 'robert.wilson@newwdch.com',
      name: 'Robert Wilson',
      role: 'EDITOR',
      status: 'SUSPENDED',
      bio: 'Editor account temporarily suspended pending review.',
      lastLoginAt: new Date(Date.now() - 14 * 24 * 3600 * 1000),
      createdAt: new Date(Date.now() - 75 * 24 * 3600 * 1000),
      pagePermissions: ['content', 'media', 'seo', 'ai'],
    },

    // 2 with minimal (dashboard + content only)
    {
      email: 'michael.brown@newwdch.com',
      name: 'Michael Brown',
      role: 'EDITOR',
      status: 'ACTIVE',
      bio: 'Freelance contributor writing about design and UX.',
      lastLoginAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      pagePermissions: ['dashboard', 'content'],
    },
    {
      email: 'lisa.anderson@newwdch.com',
      name: 'Lisa Anderson',
      role: 'EDITOR',
      status: 'DEACTIVATED',
      bio: 'Former guest contributor.',
      lastLoginAt: new Date(Date.now() - 90 * 24 * 3600 * 1000),
      createdAt: new Date(Date.now() - 150 * 24 * 3600 * 1000),
      pagePermissions: ['dashboard', 'content'],
    },
  ];

  let created = 0;
  let updated = 0;

  for (const user of users) {
    const existing = (await db.$queryRawUnsafe(
      `SELECT id FROM User WHERE email = ? LIMIT 1`,
      user.email,
    )) as Array<{ id: string }>;

    const pagePermsJson = user.pagePermissions ? JSON.stringify(user.pagePermissions) : null;

    if (existing.length > 0) {
      // Update in place — preserve password from existing record
      await db.$executeRawUnsafe(
        `UPDATE User SET name = ?, role = ?, status = ?, bio = ?, "lastLoginAt" = ?, "pagePermissions" = ? WHERE id = ?`,
        user.name,
        user.role,
        user.status,
        user.bio,
        user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        pagePermsJson,
        existing[0].id,
      );
      updated++;
      console.log(
        `  Updated: ${user.email} (${user.role}, ${user.status}, pages: ${
          user.pagePermissions ? user.pagePermissions.join('+') : 'FULL'
        })`,
      );
    } else {
      // Create new user with a default password
      await db.$executeRawUnsafe(
        `INSERT INTO User (id, email, name, role, status, bio, "lastLoginAt", "createdAt", "updatedAt", password, "emailVerified", "mfaEnabled", "pagePermissions") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        // id — Prisma uses cuid(); we'll generate one with crypto.randomUUID
        crypto.randomUUID(),
        user.email,
        user.name,
        user.role,
        user.status,
        user.bio,
        user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        user.createdAt.toISOString(),
        new Date().toISOString(),
        '$2a$10$placeholderHashForSeedUsersOnly',
        user.status === 'ACTIVE' ? 1 : 0,
        0,
        pagePermsJson,
      );
      created++;
      console.log(
        `  Created: ${user.email} (${user.role}, ${user.status}, pages: ${
          user.pagePermissions ? user.pagePermissions.join('+') : 'FULL'
        })`,
      );
    }
  }

  console.log(`\n✓ User seed complete!`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Total sample users: ${users.length}`);

  // Summary by role
  const allUsers = (await db.$queryRawUnsafe(
    `SELECT role FROM User WHERE "deletedAt" IS NULL`,
  )) as Array<{ role: string }>;
  const byRole = allUsers.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`  By role: ${JSON.stringify(byRole)}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
