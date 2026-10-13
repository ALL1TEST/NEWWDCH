// ============================================================
// PRODUCTION SUBSCRIBER SERVICE — Canonical Postgres Sync Engine
// ============================================================
// Unifies the public website's write path (Supabase Postgres)
// with the CMS Admin's read path.
//
// Public Website (https://verdantt.vercel.app/)
//     ↓ (POST /api/newsletter)
// Production Database (Supabase PostgreSQL schema verdant)
//     ↓ (table verdant."Subscriber")
// CMS Newsletter → Subscribers
//     ↓
// Same subscriber appears in real-time!
// ============================================================

import { Client } from 'pg';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

const DEFAULT_VERDANT_PG_URL =
  'postgresql://postgres.xngpgftvnadjtztkvkgc:fnj%40gnfE53dj%40e@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=verdant';

export function getProductionPostgresUrl(): string {
  return (
    process.env.VERDANT_DATABASE_URL ||
    process.env.PRODUCTION_DATABASE_URL ||
    DEFAULT_VERDANT_PG_URL
  );
}

/**
 * Resolves the Verdant site record in CMS.
 */
export async function getVerdantSiteRecord() {
  return await db.site.findFirst({
    where: {
      OR: [
        { id: 'cmtzpnikt0000k9ooun4tk151' },
        { domain: { contains: 'verdantt.vercel.app' } },
        { domain: { contains: 'vertest' } },
        { slug: 'verdant' },
      ],
    },
    select: { id: true, name: true, domain: true, config: true },
  });
}

/**
 * Connects to PostgreSQL and queries with automatic connection cleanup.
 */
async function withPgClient<T>(fn: (client: Client) => Promise<T>): Promise<T | null> {
  const connectionString = getProductionPostgresUrl();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    return await fn(client);
  } catch (err) {
    console.warn('[PRODUCTION:SUBSCRIBER:PG] Direct PostgreSQL query warning:', err);
    return null;
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

export interface ProductionSubscriberRow {
  id: string;
  email: string;
  active: boolean;
  createdAt: Date | string;
}

/**
 * Reconciles subscribers from the canonical production PostgreSQL database
 * into CMS's newsletterSubscriber table for the Verdant site.
 */
export async function syncVerdantSubscribers(targetSiteId?: string): Promise<number> {
  const verdantSite = await getVerdantSiteRecord();
  if (!verdantSite) return 0;

  const siteId = targetSiteId || verdantSite.id;

  // 1. Fetch from canonical PostgreSQL database
  const pgSubscribers = await withPgClient(async (client) => {
    const res = await client.query<ProductionSubscriberRow>(
      'SELECT id, email, active, "createdAt" FROM verdant."Subscriber" ORDER BY "createdAt" DESC;'
    );
    return res.rows;
  });

  if (!pgSubscribers) {
    // If PG is temporarily unreachable, keep existing CMS data intact
    return 0;
  }

  // 2. Upsert each production subscriber into CMS table
  for (const row of pgSubscribers) {
    const cleanEmail = row.email.trim().toLowerCase();
    const existing = await db.newsletterSubscriber.findFirst({
      where: { siteId, email: cleanEmail },
    });

    const status = row.active ? 'SUBSCRIBED' : 'UNSUBSCRIBED';
    const createdAtDate = new Date(row.createdAt);

    if (existing) {
      if (existing.status !== status) {
        await db.newsletterSubscriber.update({
          where: { id: existing.id },
          data: {
            status,
            unsubscribedAt: row.active ? null : new Date(),
          },
        });
      }
    } else {
      await db.newsletterSubscriber.create({
        data: {
          id: row.id || `sub_${nanoid(16)}`,
          siteId,
          email: cleanEmail,
          status,
          source: 'WEBSITE',
          subscribedAt: createdAtDate,
          createdAt: createdAtDate,
        },
      });
    }
  }

  return pgSubscribers.length;
}

/**
 * Writes a new subscriber to both PostgreSQL and the CMS database.
 */
export async function persistSubscriberToProduction(params: {
  email: string;
  name?: string | null;
  siteId?: string | null;
  source?: string;
}) {
  const cleanEmail = params.email.trim().toLowerCase();
  const verdantSite = await getVerdantSiteRecord();

  // If this belongs to Verdant, mirror to PostgreSQL
  if (params.siteId && verdantSite && params.siteId === verdantSite.id) {
    await withPgClient(async (client) => {
      const subId = `sub_${nanoid(16)}`;
      await client.query(
        `INSERT INTO verdant."Subscriber" (id, email, active, "createdAt")
         VALUES ($1, $2, true, NOW())
         ON CONFLICT (email) DO UPDATE SET active = true;`,
        [subId, cleanEmail]
      );
    });
  }
}

/**
 * Updates a subscriber's active status in the production database.
 */
export async function updateSubscriberInProduction(email: string, active: boolean) {
  const cleanEmail = email.trim().toLowerCase();
  await withPgClient(async (client) => {
    await client.query(
      'UPDATE verdant."Subscriber" SET active = $1 WHERE LOWER(email) = $2;',
      [active, cleanEmail]
    );
  });
}

/**
 * Removes a subscriber from the production database.
 */
export async function deleteSubscriberFromProduction(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  await withPgClient(async (client) => {
    await client.query(
      'DELETE FROM verdant."Subscriber" WHERE LOWER(email) = $1;',
      [cleanEmail]
    );
  });
}
