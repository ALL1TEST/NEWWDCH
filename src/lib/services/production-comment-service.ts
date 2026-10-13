// ============================================================
// PRODUCTION COMMENT SERVICE — Canonical Postgres Sync Engine
// ============================================================
// Unifies the public website's comment submissions
// with the CMS Admin's comment moderation.
//
// Public Website (https://verdantt.vercel.app/blog/[slug])
//     ↓ (POST /api/comments)
// Production Database (Supabase PostgreSQL schema verdant)
//     ↓ (table verdant."Comment")
// CMS Comments Moderation
//     ↓
// Moderation changes (Approve, Unapprove, Reject, Spam, Trash, Delete)
// immediately sync back to production Postgres!
// ============================================================

import { Client } from 'pg';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getProductionPostgresUrl, getVerdantSiteRecord } from './production-subscriber-service';

export interface ProductionCommentRow {
  id: string;
  articleSlug: string;
  name: string;
  email: string;
  content: string;
  status?: string;
  createdAt: Date | string;
}

/**
 * Reconciles comments from the canonical production PostgreSQL database
 * into CMS's Comment table for the Verdant site.
 */
export async function syncVerdantComments(targetSiteId?: string): Promise<number> {
  const verdantSite = await getVerdantSiteRecord();
  if (!verdantSite) return 0;
  const siteId = targetSiteId || verdantSite.id;

  const pgUrl = getProductionPostgresUrl();
  const client = new Client({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const res = await client.query<ProductionCommentRow>(
      'SELECT id, "articleSlug", name, email, content, status, "createdAt" FROM verdant."Comment" ORDER BY "createdAt" DESC;'
    );
    const rows = res.rows;
    if (!rows || rows.length === 0) return 0;

    for (const row of rows) {
      const cleanEmail = row.email ? row.email.trim().toLowerCase() : 'anonymous@example.com';
      let author = await db.user.findFirst({ where: { email: cleanEmail } });
      if (!author) {
        author = await db.user.create({
          data: {
            id: `u_${nanoid(16)}`,
            email: cleanEmail,
            name: row.name || 'Anonymous',
            role: 'CLIENT',
            status: 'ACTIVE',
          },
        });
      }

      let contentItem = await db.contentItem.findFirst({
        where: { slug: row.articleSlug, siteId },
        select: { id: true },
      });
      if (!contentItem) {
        contentItem = await db.contentItem.findFirst({
          where: { slug: row.articleSlug },
          select: { id: true },
        });
      }
      if (!contentItem) {
        contentItem = await db.contentItem.findFirst({
          where: { siteId },
          select: { id: true },
        });
      }

      if (!contentItem) continue;

      const existingComment = await db.comment.findUnique({
        where: { id: row.id },
      });

      const createdAtDate = new Date(row.createdAt);
      const canonicalStatus = row.status || 'PENDING';

      if (!existingComment) {
        await db.comment.create({
          data: {
            id: row.id,
            content: row.content,
            authorId: author.id,
            contentItemId: contentItem.id,
            siteId,
            status: canonicalStatus,
            createdAt: createdAtDate,
            updatedAt: createdAtDate,
          },
        });
      } else {
        // If Postgres has a specific non-default status that differs from local, sync it
        if (existingComment.status !== canonicalStatus && row.status) {
          await db.comment.update({
            where: { id: row.id },
            data: { status: canonicalStatus },
          });
        }
      }
    }

    return rows.length;
  } catch (err) {
    console.warn('[PRODUCTION:COMMENT:PG] Sync error:', err);
    return 0;
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

/**
 * Updates the canonical status of a comment in PostgreSQL.
 */
export async function updateVerdantCommentStatus(commentId: string, status: string): Promise<boolean> {
  const pgUrl = getProductionPostgresUrl();
  const client = new Client({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('UPDATE verdant."Comment" SET status = $1 WHERE id = $2;', [status, commentId]);
    return true;
  } catch (err) {
    console.warn('[PRODUCTION:COMMENT:PG] Update status error:', err);
    return false;
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

/**
 * Bulk updates comment statuses in PostgreSQL.
 */
export async function bulkUpdateVerdantCommentStatus(commentIds: string[], status: string): Promise<number> {
  if (!commentIds || commentIds.length === 0) return 0;
  const pgUrl = getProductionPostgresUrl();
  const client = new Client({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const res = await client.query('UPDATE verdant."Comment" SET status = $1 WHERE id = ANY($2);', [
      status,
      commentIds,
    ]);
    return res.rowCount || 0;
  } catch (err) {
    console.warn('[PRODUCTION:COMMENT:PG] Bulk update status error:', err);
    return 0;
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

/**
 * Removes a comment from the production database when deleted in CMS.
 */
export async function deleteVerdantComment(commentId: string): Promise<boolean> {
  const pgUrl = getProductionPostgresUrl();
  const client = new Client({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('DELETE FROM verdant."Comment" WHERE id = $1;', [commentId]);
    return true;
  } catch (err) {
    console.warn('[PRODUCTION:COMMENT:PG] Delete error:', err);
    return false;
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

/**
 * Bulk removes comments from the production database.
 */
export async function bulkDeleteVerdantComments(commentIds: string[]): Promise<number> {
  if (!commentIds || commentIds.length === 0) return 0;
  const pgUrl = getProductionPostgresUrl();
  const client = new Client({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const res = await client.query('DELETE FROM verdant."Comment" WHERE id = ANY($1);', [commentIds]);
    return res.rowCount || 0;
  } catch (err) {
    console.warn('[PRODUCTION:COMMENT:PG] Bulk delete error:', err);
    return 0;
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

/**
 * Syncs comment settings (enable_comments, comment_auto_spam_detection, etc.) to PostgreSQL SiteSetting table.
 */
export async function syncVerdantCommentSetting(key: string, value: string): Promise<void> {
  const pgUrl = getProductionPostgresUrl();
  const client = new Client({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query(
      `INSERT INTO verdant."SiteSetting" (id, key, value, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (key) DO UPDATE SET value = $3, "updatedAt" = NOW();`,
      [`setting_${key}`, key, value]
    );
  } catch (err) {
    console.warn('[PRODUCTION:COMMENT:PG] Sync setting error:', err);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}
