async function testPostComments() {
  const articleSlug = 'complete-monstera-care-guide';

  console.log('--- Testing Normal Comment Submission on Live Verdant Site ---');
  const normalRes = await fetch('https://verdantt.vercel.app/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleSlug,
      name: 'Verification Bot',
      email: 'bot@example.com',
      content: 'This is a legitimate test comment for end-to-end moderation verification.'
    })
  });
  console.log('Normal comment response status:', normalRes.status);
  const normalData = await normalRes.json();
  console.log('Normal comment response body:', normalData);

  console.log('\n--- Testing Auto Spam Detection on Live Verdant Site ---');
  const spamRes = await fetch('https://verdantt.vercel.app/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleSlug,
      name: 'Spam Bot',
      email: 'spammer@example.com',
      content: 'Visit casino online now and get free crypto giveaway! http://spam1.com http://spam2.com http://spam3.com'
    })
  });
  console.log('Spam comment response status:', spamRes.status);
  const spamData = await spamRes.json();
  console.log('Spam comment response body:', spamData);

  // Check public API does NOT return either of them (since both are PENDING / SPAM)
  const getRes = await fetch(`https://verdantt.vercel.app/api/comments?articleSlug=${articleSlug}`, { cache: 'no-store' });
  const publicComments = await getRes.json();
  console.log('\nPublic comments count (should still be 0 since neither is approved):', publicComments.length);

  // Clean up the two temporary test comments from Postgres
  const { Client } = require('pg');
  const client = new Client({
    connectionString: 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  if (normalData.id) await client.query('DELETE FROM verdant."Comment" WHERE id = $1', [normalData.id]);
  if (spamData.id) await client.query('DELETE FROM verdant."Comment" WHERE id = $1', [spamData.id]);
  await client.end();
  console.log('Cleaned up test comments.');
}

testPostComments().catch(console.error);
