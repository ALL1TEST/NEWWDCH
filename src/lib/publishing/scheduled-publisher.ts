// ============================================================
// SCHEDULED PUBLISHER — Background Auto-Publisher for Due Articles
// ============================================================
//
// Automatically detects content items with status 'APPROVED' whose
// scheduledAt timestamp has passed (<= now).
//
// When due:
// 1. Updates status to 'PUBLISHED' in DB with publishedAt.
// 2. Publishes and syncs the article to the connected external site.
// ============================================================

import { db } from '@/lib/db';
import { publishArticleToConnectedSite } from '@/lib/connection/site-publisher';

let isPublishing = false;
let autoPublishIntervalStarted = false;

export async function publishDueScheduledArticles(): Promise<number> {
  if (isPublishing) return 0;
  isPublishing = true;

  try {
    const now = new Date();

    // 1. Find all content items whose scheduledAt is due and status is 'APPROVED'
    const dueArticles = await db.contentItem.findMany({
      where: {
        status: 'APPROVED',
        scheduledAt: { not: null, lte: now },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        siteId: true,
        scheduledAt: true,
      },
    });

    if (dueArticles.length > 0) {
      console.log(`[SCHEDULED_PUBLISHER] Found ${dueArticles.length} due article(s) to publish:`, dueArticles.map((a) => a.title));
    }

    for (const article of dueArticles) {
      try {
        await db.contentItem.update({
          where: { id: article.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: article.scheduledAt || now,
          },
        });

        if (article.siteId) {
          try {
            await publishArticleToConnectedSite(article.id, article.siteId);
            console.log(`[SCHEDULED_PUBLISHER] Successfully published & synced: "${article.title}" to site ${article.siteId}`);
          } catch (syncErr: any) {
            console.error(`[SCHEDULED_PUBLISHER:SYNC_FAILED] Article ${article.id} (${article.title}):`, syncErr?.message || syncErr);
          }
        }
      } catch (itemErr: any) {
        console.error(`[SCHEDULED_PUBLISHER:PUBLISH_FAILED] Article ${article.id} (${article.title}):`, itemErr?.message || itemErr);
      }
    }

    // 2. Also check any due newsletter campaigns
    try {
      const dueCampaigns = await db.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { not: null, lte: now },
        },
        select: { id: true, scheduledAt: true },
      });

      for (const campaign of dueCampaigns) {
        await db.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'SENT',
            sentAt: campaign.scheduledAt || now,
          },
        });
      }
    } catch {}

    return dueArticles.length;
  } catch (err: any) {
    console.error('[SCHEDULED_PUBLISHER:RUN_ERROR]', err?.message || err);
    return 0;
  } finally {
    isPublishing = false;
  }
}

/**
 * Initializes a lightweight background timer on the server (checks every 20 seconds).
 */
export function ensureScheduledPublisherDaemon() {
  if (autoPublishIntervalStarted) return;
  autoPublishIntervalStarted = true;

  // Run initial check immediately (unawaited)
  publishDueScheduledArticles().catch(() => {});

  // Set recurring 20-second interval
  setInterval(() => {
    publishDueScheduledArticles().catch(() => {});
  }, 20_000);
}
