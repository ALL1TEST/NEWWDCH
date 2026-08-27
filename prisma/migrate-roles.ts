// ============================================================
// MIGRATE ROLES — Convert legacy 5-role system to new 2-role system
// ============================================================
//
// Old: SUPER_ADMIN, ADMIN, EDITOR, AUTHOR, CONTRIBUTOR
// New: ADMIN, EDITOR (with `pagePermissions` JSON array)
//
// Rules:
//   SUPER_ADMIN → ADMIN (pagePermissions = null, i.e. full access)
//   ADMIN       → ADMIN (pagePermissions = null)
//   EDITOR      → EDITOR (pagePermissions = all builtin pages)
//   AUTHOR      → EDITOR (pagePermissions = content, media, calendar, comments)
//   CONTRIBUTOR → EDITOR (pagePermissions = content, media)
//
// Uses raw SQL to bypass Prisma enum validation, since the DB still
// contains rows with old enum values that the new Prisma Client
// refuses to load.
//
// Run: bun run prisma/migrate-roles.ts
// ============================================================

import { db } from '../src/lib/db';

const ALL_BUILTIN_PAGES = [
  'dashboard',
  'calendar',
  'content',
  'media',
  'users',
  'comments',
  'newsletter',
  'seo',
  'ai',
  'automation',
  'settings',
  'email-templates',
  'smtp',
  'notifications',
  'backups',
];

const AUTHOR_PAGES = ['content', 'media', 'calendar', 'comments'];
const CONTRIBUTOR_PAGES = ['content', 'media'];

function pickPagesForRole(oldRole: string): string[] | null {
  switch (oldRole) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return null; // ADMIN has full access — null = full
    case 'EDITOR':
      return ALL_BUILTIN_PAGES;
    case 'AUTHOR':
      return AUTHOR_PAGES;
    case 'CONTRIBUTOR':
      return CONTRIBUTOR_PAGES;
    default:
      // Unknown role — default to EDITOR with content + media
      return CONTRIBUTOR_PAGES;
  }
}

async function main() {
  console.log('Migrating user roles...');
  console.log('  Old: SUPER_ADMIN, ADMIN, EDITOR, AUTHOR, CONTRIBUTOR');
  console.log('  New: ADMIN, EDITOR (+ pagePermissions JSON)\n');

  // Pull every user via raw SQL — Prisma's findMany rejects rows whose
  // `role` column holds a value not in the new enum.
  const rows = (await db.$queryRawUnsafe(
    `SELECT id, email, name, role, "pagePermissions" FROM User WHERE "deletedAt" IS NULL`,
  )) as Array<{ id: string; email: string; name: string | null; role: string; pagePermissions: string | null }>;

  console.log(`Found ${rows.length} active users.\n`);

  let adminCount = 0;
  let editorCount = 0;
  let alreadyMigrated = 0;

  for (const row of rows) {
    const newRole: 'ADMIN' | 'EDITOR' =
      row.role === 'SUPER_ADMIN' || row.role === 'ADMIN' ? 'ADMIN' : 'EDITOR';
    const newPages = pickPagesForRole(row.role);

    // If the user is already on the new schema (role ∈ {ADMIN, EDITOR})
    // AND pagePermissions is consistent, skip silently.
    if (row.role === 'ADMIN' || row.role === 'EDITOR') {
      alreadyMigrated++;
      // Still ensure pagePermissions is correct for the role
      if (row.role === 'ADMIN' && row.pagePermissions !== null) {
        await db.$executeRawUnsafe(
          `UPDATE User SET "pagePermissions" = NULL WHERE id = ?`,
          row.id,
        );
        console.log(`  [${row.email}] ADMIN — cleared pagePermissions`);
      } else if (row.role === 'EDITOR' && !row.pagePermissions) {
        const pagesJson = JSON.stringify(ALL_BUILTIN_PAGES);
        await db.$executeRawUnsafe(
          `UPDATE User SET "pagePermissions" = ? WHERE id = ?`,
          pagesJson,
          row.id,
        );
        console.log(`  [${row.email}] EDITOR — set pagePermissions to all builtin pages`);
      } else {
        console.log(`  [${row.email}] ${row.role} — already migrated, skipping`);
      }
      if (row.role === 'ADMIN') adminCount++;
      else editorCount++;
      continue;
    }

    // Legacy role — update both `role` and `pagePermissions` in one go.
    const pagesJson = newPages ? JSON.stringify(newPages) : null;

    if (newRole === 'ADMIN') {
      await db.$executeRawUnsafe(
        `UPDATE User SET role = 'ADMIN', "pagePermissions" = NULL WHERE id = ?`,
        row.id,
      );
      adminCount++;
      console.log(
        `  [${row.email}] ${row.role} → ADMIN (full access)`,
      );
    } else {
      await db.$executeRawUnsafe(
        `UPDATE User SET role = 'EDITOR', "pagePermissions" = ? WHERE id = ?`,
        pagesJson,
        row.id,
      );
      editorCount++;
      console.log(
        `  [${row.email}] ${row.role} → EDITOR (pagePermissions: ${newPages?.join(', ') ?? 'none'})`,
      );
    }
  }

  console.log('\n✓ Migration complete!');
  console.log(`  ADMIN:  ${adminCount}`);
  console.log(`  EDITOR: ${editorCount}`);
  console.log(`  Already migrated (skipped): ${alreadyMigrated}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
