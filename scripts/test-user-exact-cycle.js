const { Client } = require('pg');

const connectionString = 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

async function runCycle() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  const testId = 'cmuyjf8ya0000i906nng88vgb';
  const articleSlug = 'complete-monstera-care-guide';

  async function setStatus(status) {
    await client.query('UPDATE verdant."Comment" SET status = $1 WHERE id = $2', [status, testId]);
  }

  async function checkLivePublic() {
    const res = await fetch(`https://verdantt.vercel.app/api/comments?articleSlug=${articleSlug}`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const comments = await res.json();
    return comments.some(c => c.id === testId);
  }

  console.log('====================================================');
  console.log('TESTING THE EXACT CURRENT BUG CYCLE (LIVE END-TO-END)');
  console.log('====================================================');

  // 1. Approved -> public = YES
  await setStatus('APPROVED');
  let isPublic = await checkLivePublic();
  console.log(`1. Approved:      DB = APPROVED | Public = ${isPublic ? 'YES (PASS)' : 'NO (FAIL)'}`);
  if (!isPublic) throw new Error('Step 1 failed');

  // 2. Unapprove -> public = NO
  await setStatus('PENDING');
  isPublic = await checkLivePublic();
  console.log(`2. Unapprove:     DB = PENDING  | Public = ${!isPublic ? 'NO  (PASS)' : 'YES (FAIL)'}`);
  if (isPublic) throw new Error('Step 2 failed');

  // 3. Approve again -> public = YES
  await setStatus('APPROVED');
  isPublic = await checkLivePublic();
  console.log(`3. Approve again: DB = APPROVED | Public = ${isPublic ? 'YES (PASS)' : 'NO (FAIL)'}`);
  if (!isPublic) throw new Error('Step 3 failed');

  // 4. Reject -> public = NO
  await setStatus('REJECTED');
  isPublic = await checkLivePublic();
  console.log(`4. Reject:        DB = REJECTED | Public = ${!isPublic ? 'NO  (PASS)' : 'YES (FAIL)'}`);
  if (isPublic) throw new Error('Step 4 failed');

  // 5. Approve again -> public = YES
  await setStatus('APPROVED');
  isPublic = await checkLivePublic();
  console.log(`5. Approve again: DB = APPROVED | Public = ${isPublic ? 'YES (PASS)' : 'NO (FAIL)'}`);
  if (!isPublic) throw new Error('Step 5 failed');

  // 6. Mark as Spam -> public = NO
  await setStatus('SPAM');
  isPublic = await checkLivePublic();
  console.log(`6. Mark as Spam:  DB = SPAM     | Public = ${!isPublic ? 'NO  (PASS)' : 'YES (FAIL)'}`);
  if (isPublic) throw new Error('Step 6 failed');

  // 7. Approve again -> public = YES
  await setStatus('APPROVED');
  isPublic = await checkLivePublic();
  console.log(`7. Approve again: DB = APPROVED | Public = ${isPublic ? 'YES (PASS)' : 'NO (FAIL)'}`);
  if (!isPublic) throw new Error('Step 7 failed');

  // 8. Move to Trash -> public = NO
  await setStatus('TRASH');
  isPublic = await checkLivePublic();
  console.log(`8. Move to Trash: DB = TRASH    | Public = ${!isPublic ? 'NO  (PASS)' : 'YES (FAIL)'}`);
  if (isPublic) throw new Error('Step 8 failed');

  // 9. Restore -> public = NO (moves to PENDING)
  await setStatus('PENDING');
  isPublic = await checkLivePublic();
  console.log(`9. Restore:       DB = PENDING  | Public = ${!isPublic ? 'NO  (PASS)' : 'YES (FAIL)'}`);
  if (isPublic) throw new Error('Step 9 failed');

  // 10. Leave in PENDING (or APPROVED if user wants to see it approved):
  // Let's set it to PENDING as the user's report originally had it unapproved:
  await setStatus('PENDING');

  await client.end();
  console.log('====================================================');
  console.log('ALL 9 PHASES OF THE CYCLE VERIFIED 100% SUCCESSFULLY');
  console.log('====================================================');
}

runCycle().catch(err => {
  console.error('Cycle failure:', err);
  process.exit(1);
});
