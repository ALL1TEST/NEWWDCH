const { Client } = require('pg');

const connectionString = 'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL');

  // Add status column with default 'PENDING'
  await client.query(`
    ALTER TABLE verdant."Comment" 
    ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'PENDING';
  `);
  console.log('Successfully added status column to verdant."Comment"');

  // Also check if index on articleSlug and status exists, if not add it
  await client.query(`
    CREATE INDEX IF NOT EXISTS "Comment_articleSlug_status_idx" 
    ON verdant."Comment" ("articleSlug", "status");
  `);
  console.log('Created index on articleSlug and status');

  const cols = await client.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'verdant' AND table_name = 'Comment'
    ORDER BY ordinal_position;
  `);
  console.log('Updated columns in verdant.Comment:', cols.rows);

  const comments = await client.query('SELECT id, "articleSlug", name, content, status FROM verdant."Comment";');
  console.log('Comments with status:', comments.rows);

  await client.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
