// ============================================================
// CAMPAIGN SEND SERVICE
// ============================================================
//
// Sends a newsletter campaign to all eligible subscribers using the
// linked Email Template + SMTP settings. Creates CampaignDelivery
// records for tracking individual sends, opens, and clicks.
//
// Flow:
//   1. Load campaign + template + SMTP config
//   2. Resolve eligible subscribers (status=SUBSCRIBED)
//   3. Create CampaignDelivery rows (one per subscriber)
//   4. Set campaign status=SENDING
//   5. For each subscriber: send email via SMTP, mark delivery SENT/FAILED
//   6. Update campaign openCount/clickCount/recipientCount
//   7. Set campaign status=SENT (or FAILED if all deliveries failed)
// ============================================================

import { db } from '@/lib/db';
import { createSmtpTransport, resolveFromAddress, type SmtpConfigInput } from '@/lib/smtp/transport';
import type { Transporter } from 'nodemailer';

// -------------------- Types --------------------

export interface SendCampaignResult {
  campaignId: string;
  status: 'SENT' | 'FAILED' | 'PARTIAL';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  error?: string;
}

// -------------------- Helpers --------------------

/**
 * Load the default SMTP settings from the database.
 * Returns null if SMTP is not configured.
 */
async function getSmtpConfig(): Promise<SmtpConfigInput | null> {
  const record = await db.smtpSetting.findFirst({
    where: { isDefault: true, isActive: true },
  });
  if (!record) return null;

  return {
    provider: record.provider,
    host: record.host,
    port: record.port,
    encryption: (record.encryption as 'none' | 'SSL' | 'STARTTLS') || 'STARTTLS',
    username: record.username,
    password: record.password,
    fromName: record.fromName,
    fromEmail: record.fromEmail,
    replyTo: record.replyTo,
    timeout: record.timeout,
    isActive: record.isActive,
  };
}

/**
 * Resolve the HTML body to send: use the campaign's contentOverride if
 * set, otherwise fall back to the template's htmlBody. This ensures
 * editing a campaign never modifies the original template.
 */
function resolveHtmlBody(campaign: { contentOverride: string | null; content: string | null }, template: { htmlBody: string } | null): string {
  if (campaign.contentOverride && campaign.contentOverride.trim()) {
    return campaign.contentOverride;
  }
  if (template?.htmlBody) {
    return template.htmlBody;
  }
  if (campaign.content) {
    return campaign.content;
  }
  return '<p>No content available.</p>';
}

// -------------------- Main Send Function --------------------

/**
 * Send a campaign to all eligible subscribers.
 *
 * This function is idempotent — if called on a campaign that's already
 * SENDING, it returns early. If called on a SENT campaign, it refuses.
 */
export async function sendCampaign(campaignId: string): Promise<SendCampaignResult> {
  // 1. Load campaign + template
  const campaign = await db.newsletterCampaign.findUnique({
    where: { id: campaignId },
    include: {
      template: { select: { id: true, name: true, subject: true, htmlBody: true, fromName: true, fromEmail: true, replyTo: true } },
    },
  });

  if (!campaign) {
    return { campaignId, status: 'FAILED', recipientCount: 0, sentCount: 0, failedCount: 0, error: 'Campaign not found' };
  }

  if (campaign.status === 'SENT') {
    return { campaignId, status: 'SENT', recipientCount: campaign.recipientCount, sentCount: campaign.openCount, failedCount: 0, error: 'Campaign already sent' };
  }

  if (campaign.status === 'SENDING') {
    return { campaignId, status: 'SENT', recipientCount: campaign.recipientCount, sentCount: 0, failedCount: 0, error: 'Campaign is already sending' };
  }

  // 2. Resolve eligible subscribers (only SUBSCRIBED)
  const subscribers = await db.newsletterSubscriber.findMany({
    where: { status: 'SUBSCRIBED' },
    select: { id: true, email: true, name: true },
  });

  if (subscribers.length === 0) {
    await db.newsletterCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED', errorMessage: 'No eligible subscribers found (status=SUBSCRIBED)' },
    });
    return { campaignId, status: 'FAILED', recipientCount: 0, sentCount: 0, failedCount: 0, error: 'No eligible subscribers' };
  }

  // 3. Load SMTP config
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig) {
    await db.newsletterCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED', errorMessage: 'SMTP not configured. Set up SMTP Settings first.', recipientCount: subscribers.length },
    });
    return { campaignId, status: 'FAILED', recipientCount: subscribers.length, sentCount: 0, failedCount: subscribers.length, error: 'SMTP not configured' };
  }

  // 4. Set campaign to SENDING + create delivery records
  await db.newsletterCampaign.update({
    where: { id: campaignId },
    data: {
      status: 'SENDING',
      recipientCount: subscribers.length,
      errorMessage: null,
    },
  });

  // Create delivery records (upsert — safe if called multiple times)
  for (const sub of subscribers) {
    await db.campaignDelivery.upsert({
      where: {
        campaignId_subscriberId: { campaignId, subscriberId: sub.id },
      },
      update: { status: 'PENDING', errorMessage: null },
      create: { campaignId, subscriberId: sub.id, status: 'PENDING' },
    });
  }

  // 5. Create SMTP transport
  let transporter: Transporter;
  try {
    transporter = await createSmtpTransport(smtpConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create SMTP transport';
    await db.newsletterCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED', errorMessage: msg },
    });
    return { campaignId, status: 'FAILED', recipientCount: subscribers.length, sentCount: 0, failedCount: subscribers.length, error: msg };
  }

  // 6. Send emails
  const htmlBody = resolveHtmlBody(campaign, campaign.template);
  const fromAddress = resolveFromAddress({
    fromName: campaign.template?.fromName || smtpConfig.fromName,
    fromEmail: campaign.template?.fromEmail || smtpConfig.fromEmail,
  });
  const replyTo = campaign.template?.replyTo || smtpConfig.replyTo || undefined;

  let sentCount = 0;
  let failedCount = 0;

  for (const sub of subscribers) {
    try {
      // Personalize: replace {{name}} and {{email}} placeholders
      const personalizedHtml = htmlBody
        .replace(/\{\{name\}\}/g, sub.name || 'there')
        .replace(/\{\{email\}\}/g, sub.email);

      await transporter.sendMail({
        from: fromAddress,
        to: sub.name ? `${sub.name} <${sub.email}>` : sub.email,
        subject: campaign.subject,
        html: personalizedHtml,
        replyTo,
      });

      sentCount++;
      await db.campaignDelivery.update({
        where: { campaignId_subscriberId: { campaignId, subscriberId: sub.id } },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      failedCount++;
      const msg = err instanceof Error ? err.message : 'Send failed';
      await db.campaignDelivery.update({
        where: { campaignId_subscriberId: { campaignId, subscriberId: sub.id } },
        data: { status: 'FAILED', errorMessage: msg },
      });
    }
  }

  // 7. Update campaign status + counts
  const finalStatus = sentCount === 0 ? 'FAILED' : (failedCount > 0 ? 'SENT' : 'SENT');
  await db.newsletterCampaign.update({
    where: { id: campaignId },
    data: {
      status: finalStatus,
      sentAt: new Date(),
      recipientCount: subscribers.length,
      openCount: 0, // opens tracked via pixel — starts at 0
      clickCount: 0,
      errorMessage: failedCount > 0 ? `${failedCount} of ${subscribers.length} deliveries failed` : null,
    },
  });

  return {
    campaignId,
    status: finalStatus as 'SENT' | 'FAILED',
    recipientCount: subscribers.length,
    sentCount,
    failedCount,
  };
}

/**
 * Count eligible subscribers (status=SUBSCRIBED) for the audience preview.
 * Used by the Create Campaign dialog to show "N subscribers will receive this campaign".
 */
export async function countEligibleSubscribers(): Promise<number> {
  return db.newsletterSubscriber.count({ where: { status: 'SUBSCRIBED' } });
}
