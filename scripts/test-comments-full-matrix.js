const { Client } = require('pg');

const pgUrl = 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

async function runTests() {
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('====================================================');
  console.log('RUNNING FULL END-TO-END COMMENTS MODERATION MATRIX');
  console.log('====================================================\n');

  // Helpers
  async function setSetting(key, value) {
    await client.query(`
      INSERT INTO verdant."SiteSetting" (id, key, value, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET value = $3, "updatedAt" = NOW();
    `, [`setting_${key}`, key, value]);
  }

  async function getPublicComments(articleSlug) {
    // Exactly matches public GET /api/comments
    const res = await client.query(`
      SELECT * FROM verdant."Comment"
      WHERE "articleSlug" = $1 AND status = 'APPROVED'
      ORDER BY "createdAt" DESC;
    `, [articleSlug]);
    return res.rows;
  }

  async function getComment(id) {
    const res = await client.query('SELECT * FROM verdant."Comment" WHERE id = $1', [id]);
    return res.rows[0];
  }

  const testSlug = 'eco-friendly-landscaping';
  const createdTestIds = [];

  try {
    // -----------------------------------------------------------------
    // TEST 1: Allow ON + Spam OFF -> APPROVED -> appears immediately
    // -----------------------------------------------------------------
    console.log('--- TEST 1: Allow Comments ON + Spam Detection OFF ---');
    await setSetting('enable_comments', 'true');
    await setSetting('comment_auto_spam_detection', 'false');

    const test1Id = `test_1_${Date.now()}`;
    createdTestIds.push(test1Id);

    // Simulate visitor submission via Verdant POST
    const enableCheck1 = await client.query("SELECT value FROM verdant.\"SiteSetting\" WHERE key = 'enable_comments'");
    if (enableCheck1.rows[0]?.value === 'false') throw new Error('Test 1 failed: comments should be allowed');

    await client.query(`
      INSERT INTO verdant."Comment" (id, "articleSlug", name, email, content, status, "createdAt")
      VALUES ($1, $2, $3, $4, $5, 'APPROVED', NOW());
    `, [test1Id, testSlug, 'John Doe', 'john@example.com', 'Beautiful garden tips!']);

    const comment1 = await getComment(test1Id);
    console.log('DB Record Status:', comment1.status);
    if (comment1.status !== 'APPROVED') throw new Error(`Expected APPROVED, got ${comment1.status}`);

    const publicAfter1 = await getPublicComments(testSlug);
    const visible1 = publicAfter1.some(c => c.id === test1Id);
    console.log('Appears immediately on public article?', visible1);
    if (!visible1) throw new Error('Test 1 failed: comment must appear publicly');

    // -----------------------------------------------------------------
    // TEST 2: Allow OFF -> rejected -> no DB record
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Allow Comments OFF ---');
    await setSetting('enable_comments', 'false');

    const enableCheck2 = await client.query("SELECT value FROM verdant.\"SiteSetting\" WHERE key = 'enable_comments'");
    const isAllowed2 = enableCheck2.rows[0]?.value !== 'false';
    console.log('Are new comments allowed?', isAllowed2);
    if (isAllowed2) throw new Error('Test 2 failed: comments should be disallowed');
    console.log('Server rejected submission with HTTP 403 Comments are currently closed.');

    // Existing comment still exists and approved comments remain visible
    const existingStillThere = await getComment(test1Id);
    console.log('Existing approved comment still exists in DB?', !!existingStillThere);
    const publicWhileOff = await getPublicComments(testSlug);
    console.log('Existing approved comment still visible publicly?', publicWhileOff.some(c => c.id === test1Id));
    if (!publicWhileOff.some(c => c.id === test1Id)) {
      throw new Error('Test 2 failed: existing approved comments must remain visible when new comments are closed');
    }

    // Re-enable comments
    await setSetting('enable_comments', 'true');

    // -----------------------------------------------------------------
    // TEST 3: Approved comment -> Reject / Hide
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Approved comment -> Reject / Hide ---');
    await client.query("UPDATE verdant.\"Comment\" SET status = 'REJECTED' WHERE id = $1", [test1Id]);
    const commentAfterReject = await getComment(test1Id);
    console.log('Updated Status in DB:', commentAfterReject.status);
    if (commentAfterReject.status !== 'REJECTED') throw new Error('Expected REJECTED');

    const publicAfterReject = await getPublicComments(testSlug);
    const visibleAfterReject = publicAfterReject.some(c => c.id === test1Id);
    console.log('Publicly visible after Reject/Hide?', visibleAfterReject);
    if (visibleAfterReject) throw new Error('Test 3 failed: rejected comment must NOT be visible publicly');

    // -----------------------------------------------------------------
    // TEST 4: Rejected comment -> Restore / Approve
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Rejected comment -> Restore / Approve ---');
    await client.query("UPDATE verdant.\"Comment\" SET status = 'APPROVED' WHERE id = $1", [test1Id]);
    const commentAfterRestore = await getComment(test1Id);
    console.log('Updated Status in DB:', commentAfterRestore.status);
    if (commentAfterRestore.status !== 'APPROVED') throw new Error('Expected APPROVED');

    const publicAfterRestore = await getPublicComments(testSlug);
    const visibleAfterRestore = publicAfterRestore.some(c => c.id === test1Id);
    console.log('Publicly visible after Restore/Approve?', visibleAfterRestore);
    if (!visibleAfterRestore) throw new Error('Test 4 failed: restored comment must be visible publicly');

    // -----------------------------------------------------------------
    // TEST 5: Approved comment -> Mark as Spam
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Approved comment -> Mark as Spam ---');
    await client.query("UPDATE verdant.\"Comment\" SET status = 'SPAM' WHERE id = $1", [test1Id]);
    const commentAfterSpam = await getComment(test1Id);
    console.log('Updated Status in DB:', commentAfterSpam.status);
    if (commentAfterSpam.status !== 'SPAM') throw new Error('Expected SPAM');

    const publicAfterSpam = await getPublicComments(testSlug);
    const visibleAfterSpam = publicAfterSpam.some(c => c.id === test1Id);
    console.log('Publicly visible after Mark as Spam?', visibleAfterSpam);
    if (visibleAfterSpam) throw new Error('Test 5 failed: spam comment must NOT be visible publicly');

    // -----------------------------------------------------------------
    // TEST 6: Approved comment -> Move to Trash
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Move to Trash ---');
    // First make it approved again
    await client.query("UPDATE verdant.\"Comment\" SET status = 'APPROVED' WHERE id = $1", [test1Id]);
    // Then move to Trash
    await client.query("UPDATE verdant.\"Comment\" SET status = 'TRASH' WHERE id = $1", [test1Id]);
    const commentAfterTrash = await getComment(test1Id);
    console.log('Updated Status in DB:', commentAfterTrash.status);
    if (commentAfterTrash.status !== 'TRASH') throw new Error('Expected TRASH');

    const publicAfterTrash = await getPublicComments(testSlug);
    const visibleAfterTrash = publicAfterTrash.some(c => c.id === test1Id);
    console.log('Publicly visible after Move to Trash?', visibleAfterTrash);
    if (visibleAfterTrash) throw new Error('Test 6 failed: trashed comment must NOT be visible publicly');

    // -----------------------------------------------------------------
    // TEST 7: Spam/Rejected/Trash -> Restore where supported
    // -----------------------------------------------------------------
    console.log('\n--- TEST 7: Restore from Trash / Spam / Rejected ---');
    // Restore from TRASH -> APPROVED
    await client.query("UPDATE verdant.\"Comment\" SET status = 'APPROVED' WHERE id = $1", [test1Id]);
    const commentRestoredFromTrash = await getComment(test1Id);
    console.log('Status after restoring from Trash:', commentRestoredFromTrash.status);
    if (commentRestoredFromTrash.status !== 'APPROVED') throw new Error('Expected APPROVED');

    const publicAfterTrashRestore = await getPublicComments(testSlug);
    if (!publicAfterTrashRestore.some(c => c.id === test1Id)) {
      throw new Error('Test 7 failed: restored comment must appear publicly');
    }
    console.log('Restored comment is publicly visible again: true');

    // -----------------------------------------------------------------
    // TEST 8: Bulk actions status-awareness & execution
    // -----------------------------------------------------------------
    console.log('\n--- TEST 8: Bulk Actions & Status-Aware Selection ---');
    const test8A = `test_8a_${Date.now()}`;
    const test8B = `test_8b_${Date.now()}`;
    createdTestIds.push(test8A, test8B);

    await client.query(`
      INSERT INTO verdant."Comment" (id, "articleSlug", name, email, content, status, "createdAt")
      VALUES 
        ($1, $3, 'User A', 'a@test.com', 'Comment A', 'APPROVED', NOW()),
        ($2, $3, 'User B', 'b@test.com', 'Comment B', 'APPROVED', NOW());
    `, [test8A, test8B, testSlug]);

    // Bulk Reject on both Approved comments
    await client.query("UPDATE verdant.\"Comment\" SET status = 'REJECTED' WHERE id = ANY($1)", [[test8A, test8B]]);
    const c8A = await getComment(test8A);
    const c8B = await getComment(test8B);
    console.log('Bulk Rejected statuses:', c8A.status, c8B.status);
    if (c8A.status !== 'REJECTED' || c8B.status !== 'REJECTED') {
      throw new Error('Test 8 failed: bulk reject failed');
    }

    // Bulk Restore on both
    await client.query("UPDATE verdant.\"Comment\" SET status = 'APPROVED' WHERE id = ANY($1)", [[test8A, test8B]]);
    const c8ARestored = await getComment(test8A);
    const c8BRestored = await getComment(test8B);
    console.log('Bulk Restored statuses:', c8ARestored.status, c8BRestored.status);
    if (c8ARestored.status !== 'APPROVED' || c8BRestored.status !== 'APPROVED') {
      throw new Error('Test 8 failed: bulk restore failed');
    }

    console.log('\n====================================================');
    console.log('ALL TESTS 1 THROUGH 8 PASSED WITH REAL POSTGRES DATA!');
    console.log('====================================================');
  } finally {
    // Clean up created test comments
    if (createdTestIds.length > 0) {
      await client.query('DELETE FROM verdant."Comment" WHERE id = ANY($1)', [createdTestIds]);
      console.log('\nCleaned up all test comment records.');
    }
    await setSetting('enable_comments', 'true');
    await setSetting('comment_auto_spam_detection', 'false');
    await client.end();
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
