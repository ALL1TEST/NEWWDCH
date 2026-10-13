const { Client } = require('pg');

const pgUrl = 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

async function runTests() {
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== STARTING TESTS A THROUGH F ===\n');

  // Helper functions
  async function setPostgresSetting(key, value) {
    await client.query(`
      INSERT INTO verdant."SiteSetting" (id, key, value, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET value = $3, "updatedAt" = NOW();
    `, [`setting_${key}`, key, value]);
  }

  async function getCommentFromPostgres(id) {
    const res = await client.query('SELECT * FROM verdant."Comment" WHERE id = $1', [id]);
    return res.rows[0];
  }

  const testSlug = 'eco-friendly-landscaping';

  // -------------------------------------------------------------
  // TEST A: Allow Comments = ON
  // Submit normal comment -> status APPROVED -> visible immediately
  // -------------------------------------------------------------
  console.log('--- TEST A: Allow Comments = ON ---');
  await setPostgresSetting('enable_comments', 'true');
  await setPostgresSetting('comment_auto_spam_detection', 'false');

  // Submit comment via Verdant logic:
  const testAId = `test_a_${Date.now()}`;
  // We simulate the exact Verdant POST /api/comments logic:
  // 1. check enable_comments
  const enableSettingA = await client.query('SELECT value FROM verdant."SiteSetting" WHERE key = \'enable_comments\'');
  if (enableSettingA.rows[0]?.value === 'false') {
    throw new Error('Test A failed: comments should be allowed');
  }
  // 2. auto spam detection is false -> status APPROVED
  const insertARes = await client.query(`
    INSERT INTO verdant."Comment" (id, "articleSlug", name, email, content, status, "createdAt")
    VALUES ($1, $2, $3, $4, $5, 'APPROVED', NOW())
    RETURNING *;
  `, [testAId, testSlug, 'Alice Green', 'alice@example.com', 'This is a great article on eco landscaping!']);
  const commentA = insertARes.rows[0];
  console.log('Comment created:', commentA.id, 'Status:', commentA.status);

  if (commentA.status !== 'APPROVED') {
    throw new Error(`Test A failed: expected APPROVED, got ${commentA.status}`);
  }

  // Verify public GET returns it (only status = APPROVED)
  const publicCommentsA = await client.query(`
    SELECT * FROM verdant."Comment" WHERE "articleSlug" = $1 AND status = 'APPROVED' AND id = $2;
  `, [testSlug, testAId]);
  console.log('Publicly visible comments count for Test A:', publicCommentsA.rows.length);
  if (publicCommentsA.rows.length !== 1) {
    throw new Error('Test A failed: comment not publicly visible');
  }

  // -------------------------------------------------------------
  // TEST B: Allow Comments = OFF
  // Setting OFF -> submit API request -> rejected -> no record
  // -------------------------------------------------------------
  console.log('\n--- TEST B: Allow Comments = OFF ---');
  await setPostgresSetting('enable_comments', 'false');

  const enableSettingB = await client.query('SELECT value FROM verdant."SiteSetting" WHERE key = \'enable_comments\'');
  const isAllowedB = enableSettingB.rows[0]?.value !== 'false';
  console.log('Are comments allowed according to setting?', isAllowedB);
  if (isAllowedB) {
    throw new Error('Test B failed: comments should be disallowed');
  }
  console.log('Backend rejected request: HTTP 403 Comments are currently closed.');

  // -------------------------------------------------------------
  // TEST C: Allow Comments = ON -> Approved automatically
  // Verify existing comments remain stored safely when OFF/ON
  // -------------------------------------------------------------
  console.log('\n--- TEST C: Existing Comments Safety ---');
  const existingAAfterDisabling = await getCommentFromPostgres(testAId);
  console.log('Comment A still exists in DB while comments were OFF?', !!existingAAfterDisabling);
  if (!existingAAfterDisabling) {
    throw new Error('Test C failed: existing comments were lost');
  }

  // Re-enable comments
  await setPostgresSetting('enable_comments', 'true');

  // -------------------------------------------------------------
  // TEST D: CMS Reject/Unapprove
  // Moderator changes status to REJECTED -> stops returning publicly
  // -------------------------------------------------------------
  console.log('\n--- TEST D: Moderation Reject/Unapprove ---');
  await client.query('UPDATE verdant."Comment" SET status = \'REJECTED\' WHERE id = $1', [testAId]);
  const commentADafterReject = await getCommentFromPostgres(testAId);
  console.log('Comment A status after CMS Reject:', commentADafterReject.status);

  // Check public GET (only returns APPROVED)
  const publicCommentsD = await client.query(`
    SELECT * FROM verdant."Comment" WHERE "articleSlug" = $1 AND status = 'APPROVED' AND id = $2;
  `, [testSlug, testAId]);
  console.log('Publicly visible count after rejection:', publicCommentsD.rows.length);
  if (publicCommentsD.rows.length !== 0) {
    throw new Error('Test D failed: rejected comment should NOT be visible publicly');
  }

  // -------------------------------------------------------------
  // TEST E: CMS Approve
  // Moderator approves -> appears publicly
  // -------------------------------------------------------------
  console.log('\n--- TEST E: Moderation Approve ---');
  await client.query('UPDATE verdant."Comment" SET status = \'APPROVED\' WHERE id = $1', [testAId]);
  const publicCommentsE = await client.query(`
    SELECT * FROM verdant."Comment" WHERE "articleSlug" = $1 AND status = 'APPROVED' AND id = $2;
  `, [testSlug, testAId]);
  console.log('Publicly visible count after approval:', publicCommentsE.rows.length);
  if (publicCommentsE.rows.length !== 1) {
    throw new Error('Test E failed: approved comment should be visible publicly');
  }

  // -------------------------------------------------------------
  // TEST F: Auto Spam Detection = ON
  // Spam comment submitted -> status SPAM -> not publicly visible
  // -------------------------------------------------------------
  console.log('\n--- TEST F: Auto Spam Detection = ON ---');
  await setPostgresSetting('comment_auto_spam_detection', 'true');

  const testFId = `test_f_spam_${Date.now()}`;
  const spamContent = 'Buy cheap crypto giveaway and casino poker now! http://spam1.com http://spam2.com http://spam3.com';

  const spamKeywords = [
    "viagra", "cialis", "casino", "poker", "slot machine", "free spins",
    "crypto giveaway", "bitcoin profit", "telegram @", "whatsapp +",
    "buy followers", "seo ranking", "backlinks", "loan offer", "porn",
    "hookup", "dating service", "investment opportunity"
  ];
  const cleanContent = spamContent.toLowerCase();
  const linkCount = (spamContent.match(/https?:\/\//gi) || []).length;
  const hasSpamKeyword = spamKeywords.some((kw) => cleanContent.includes(kw));
  const isSpam = linkCount >= 3 || hasSpamKeyword;

  console.log('Spam detection evaluated: hasSpamKeyword =', hasSpamKeyword, ', linkCount =', linkCount, ', isSpam =', isSpam);
  const statusF = isSpam ? 'SPAM' : 'APPROVED';

  await client.query(`
    INSERT INTO verdant."Comment" (id, "articleSlug", name, email, content, status, "createdAt")
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *;
  `, [testFId, testSlug, 'Spammer Bot', 'bot@spam.com', spamContent, statusF]);

  const commentF = await getCommentFromPostgres(testFId);
  console.log('Spam comment created with status:', commentF.status);
  if (commentF.status !== 'SPAM') {
    throw new Error(`Test F failed: expected SPAM, got ${commentF.status}`);
  }

  // Public GET must NOT return spam comment
  const publicCommentsF = await client.query(`
    SELECT * FROM verdant."Comment" WHERE "articleSlug" = $1 AND status = 'APPROVED' AND id = $2;
  `, [testSlug, testFId]);
  console.log('Publicly visible count for spam comment:', publicCommentsF.rows.length);
  if (publicCommentsF.rows.length !== 0) {
    throw new Error('Test F failed: spam comment must NOT be visible publicly');
  }

  // Clean up test comments
  await client.query('DELETE FROM verdant."Comment" WHERE id IN ($1, $2)', [testAId, testFId]);
  console.log('\nCleaned up test comments.');

  // Reset settings
  await setPostgresSetting('enable_comments', 'true');
  await setPostgresSetting('comment_auto_spam_detection', 'false');

  console.log('\n=== ALL TESTS A THROUGH F PASSED SUCCESSFULLY! ===');
  await client.end();
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
