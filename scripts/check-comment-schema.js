const { Client } = require('pg');

const pgUrl = 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

async function check() {
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'verdant' AND table_name = 'Comment';");
  console.log('Comment columns:', res.rows);
  const statusValues = await client.query('SELECT DISTINCT status FROM verdant."Comment";');
  console.log('Distinct statuses in DB:', statusValues.rows);
  await client.end();
}

check().catch(console.error);
