const { Client } = require('pg');
const pgUrl = 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

async function main() {
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query('SELECT key, value FROM verdant."SiteSetting" ORDER BY key;');
  console.log('SiteSettings in Postgres:', res.rows);
  await client.end();
}

main().catch(console.error);
