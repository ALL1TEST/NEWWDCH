const { Client } = require('pg');

const connectionString = 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function main() {
  await client.connect();

  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'verdant'
    ORDER BY table_name;
  `);
  console.log('Tables in schema verdant:', tables.rows);

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
