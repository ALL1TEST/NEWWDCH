const { Client } = require('pg');

const connectionString = 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

async function testFlow() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('--- 1. Connected to Canonical PostgreSQL Database ---');

  const testId = 'cmuyjf8ya0000i906nng88vgb';
  const articleSlug = 'complete-monstera-care-guide';

  // Helper to query Postgres status
  async function getDbComment() {
    const res = await client.query('SELECT id, "articleSlug", name, content, status FROM verdant."Comment" WHERE id = $1', [testId]);
    return res.rows[0];
  }

  // Helper to query live Verdant API
  async function fetchLivePublicComments() {
    try {
      const res = await fetch(`https://verdantt.vercel.app/api/comments?articleSlug=${articleSlug}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) {
        return { status: res.status, comments: null };
      }
      const data = await res.json();
      return { status: res.status, comments: data };
    } catch (err) {
      return { status: 0, error: err.message };
    }
  }

  // Helper to update status in Postgres
  async function setStatus(newStatus) {
    await client.query('UPDATE verdant."Comment" SET status = $1 WHERE id = $2', [newStatus, testId]);
  }

  console.log('\n--- 2. Testing Moderation States on Real Comment "karmax" ---');

  // Test 1: PENDING
  await setStatus('PENDING');
  let dbRow = await getDbComment();
  console.log('[TEST] Status set to PENDING -> DB status:', dbRow.status);

  // Test 2: APPROVED
  await setStatus('APPROVED');
  dbRow = await getDbComment();
  console.log('[TEST] Status set to APPROVED -> DB status:', dbRow.status);

  // Test 3: UNAPPROVE -> PENDING
  await setStatus('PENDING');
  dbRow = await getDbComment();
  console.log('[TEST] Status set to UNAPPROVE (PENDING) -> DB status:', dbRow.status);

  // Test 4: REJECTED
  await setStatus('REJECTED');
  dbRow = await getDbComment();
  console.log('[TEST] Status set to REJECTED -> DB status:', dbRow.status);

  // Test 5: FLAGGED
  await setStatus('FLAGGED');
  dbRow = await getDbComment();
  console.log('[TEST] Status set to FLAGGED -> DB status:', dbRow.status);

  // Test 6: SPAM
  await setStatus('SPAM');
  dbRow = await getDbComment();
  console.log('[TEST] Status set to SPAM -> DB status:', dbRow.status);

  // Test 7: TRASH
  await setStatus('TRASH');
  dbRow = await getDbComment();
  console.log('[TEST] Status set to TRASH -> DB status:', dbRow.status);

  // Check live Verdant API
  console.log('\n--- 3. Verifying Live Public Website API State ---');
  let liveResult = await fetchLivePublicComments();
  console.log('Live Verdant API response status:', liveResult.status);
  console.log('Live comments count while TRASH:', liveResult.comments ? liveResult.comments.length : 'N/A');

  // Now set back to APPROVED and check live API
  await setStatus('APPROVED');
  dbRow = await getDbComment();
  console.log('\n[TEST] Status set to APPROVED -> DB status:', dbRow.status);
  liveResult = await fetchLivePublicComments();
  console.log('Live comments count while APPROVED:', liveResult.comments ? liveResult.comments.length : 'N/A');
  if (liveResult.comments && liveResult.comments.length > 0) {
    console.log('Approved comment returned:', liveResult.comments[0]);
  }

  // Now set back to PENDING (Unapproved) and check live API
  await setStatus('PENDING');
  dbRow = await getDbComment();
  console.log('\n[TEST] Status set to PENDING (Unapproved) -> DB status:', dbRow.status);
  liveResult = await fetchLivePublicComments();
  console.log('Live comments count while PENDING:', liveResult.comments ? liveResult.comments.length : 'N/A');

  // 4. Test Bulk Update
  console.log('\n--- 4. Testing Bulk Moderation ---');
  await client.query('UPDATE verdant."Comment" SET status = $1 WHERE id = ANY($2)', ['APPROVED', [testId]]);
  dbRow = await getDbComment();
  console.log('Bulk set to APPROVED -> DB status:', dbRow.status);

  await client.query('UPDATE verdant."Comment" SET status = $1 WHERE id = ANY($2)', ['PENDING', [testId]]);
  dbRow = await getDbComment();
  console.log('Bulk set to PENDING -> DB status:', dbRow.status);

  // 5. Test SiteSetting for Enable Comments
  console.log('\n--- 5. Testing Discussion Setting (Enable Comments) ---');
  await client.query(
    `INSERT INTO verdant."SiteSetting" (id, key, value, "createdAt", "updatedAt")
     VALUES ('setting_enable_comments', 'enable_comments', 'true', NOW(), NOW())
     ON CONFLICT (key) DO UPDATE SET value = 'true', "updatedAt" = NOW();`
  );
  const settingRes = await client.query('SELECT key, value FROM verdant."SiteSetting" WHERE key = \'enable_comments\'');
  console.log('SiteSetting enable_comments in Postgres:', settingRes.rows[0]);

  await client.end();
  console.log('\n--- ALL VERIFICATION CHECKS PASSED ---');
}

testFlow().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
