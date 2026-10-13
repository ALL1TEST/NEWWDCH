// ============================================================
// Safe, Explicit Cleanup Script for Accidental Test Sites
// Removes ONLY the 7 accidental test fixtures with:
//   name: 'Other Tenant Site' AND slug: other-site-*
// Does NOT touch any customer or real sites (Verdant, gog, etc.)
// ============================================================

import { db } from '../src/lib/db';

async function cleanupTestSites() {
  console.log('--- Finding accidental test sites ---');
  const testSites = await db.site.findMany({
    where: {
      name: 'Other Tenant Site',
      slug: { startsWith: 'other-site-' },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      ownerId: true,
    },
  });

  console.log(`Found ${testSites.length} test site(s) to clean up:`, testSites);

  if (testSites.length === 0) {
    console.log('No test sites found. Nothing to clean.');
    return;
  }

  const siteIds = testSites.map((s) => s.id);

  // 1. Verify safety: ensure no real content items exist on these test sites
  const contentCount = await db.contentItem.count({
    where: { siteId: { in: siteIds } },
  });

  if (contentCount > 0) {
    console.error(`Safety check failed: ${contentCount} content items found on these sites. Aborting cleanup.`);
    process.exit(1);
  }

  // 2. Remove any test automations and runs associated with these test sites
  const testAutomations = await db.automation.findMany({
    where: { siteId: { in: siteIds } },
    select: { id: true },
  });
  const autoIds = testAutomations.map((a) => a.id);

  if (autoIds.length > 0) {
    await db.automationRun.deleteMany({
      where: { automationId: { in: autoIds } },
    });
    const deletedAutos = await db.automation.deleteMany({
      where: { id: { in: autoIds } },
    });
    console.log(`Cleaned up ${deletedAutos.count} test automation(s).`);
  }

  // 3. Delete the test site records
  const deletedSites = await db.site.deleteMany({
    where: { id: { in: siteIds } },
  });

  console.log(`Successfully deleted ${deletedSites.count} accidental test site(s).`);
}

cleanupTestSites()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
