const { Client } = require('pg');
const pgUrl = 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

async function main() {
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Set enable_comments = true
  await client.query("UPDATE verdant.\"SiteSetting\" SET value = 'true' WHERE key = 'enable_comments'");
  // Set comment_auto_spam_detection = true
  await client.query("UPDATE verdant.\"SiteSetting\" SET value = 'true' WHERE key = 'comment_auto_spam_detection'");
  // Set comment_spam_provider = none
  await client.query("UPDATE verdant.\"SiteSetting\" SET value = 'none' WHERE key = 'comment_spam_provider'");

  const res = await fetch('https://verdantt.vercel.app/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleSlug: 'complete-monstera-care-guide',
      name: 'Test Visitor',
      email: 'visitor@example.com',
      content: 'Hello this is a test comment for provider none'
    })
  });

  const data = await res.json();
  console.log('Post status:', res.status, data);

  if (data.id) {
    const row = await client.query('SELECT id, status FROM verdant."Comment" WHERE id = $1', [data.id]);
    console.log('DB row status:', row.rows[0]);
    await client.query('DELETE FROM verdant."Comment" WHERE id = $1', [data.id]);
  }

  await client.end();
}

main().catch(console.error);
