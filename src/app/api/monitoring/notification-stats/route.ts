// ============================================================
// GET /api/monitoring/notification-stats — Notification/email stats
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// =====================================================================
// GET — notification stats
// =====================================================================

export async function GET(_request: NextRequest) {
  const id = reqId();

  try {
    const now = new Date();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Emails sent: AuditLog entries with action containing 'email'
    const [totalEmailSent, failedEmails, recentEmailSent] = await Promise.all([
      db.auditLog.count({
        where: {
          action: { contains: 'email' },
        },
      }),
      db.auditLog.count({
        where: {
          action: { contains: 'email' },
          details: { contains: 'failed' },
        },
      }),
      db.auditLog.count({
        where: {
          action: { contains: 'email' },
          createdAt: { gte: last24h },
        },
      }),
    ]);

    // In-app notifications
    const [totalNotifications, unreadNotifications, recentNotifications] = await Promise.all([
      db.notification.count(),
      db.notification.count({ where: { isRead: false } }),
      db.notification.count({ where: { createdAt: { gte: last24h } } }),
    ]);

    // Notification breakdown by channel
    const byChannel = await db.notification.groupBy({
      by: ['channel'],
      _count: { id: true },
    });

    // Notification breakdown by type
    const byType = await db.notification.groupBy({
      by: ['type'],
      _count: { id: true },
    });

    // Newsletter queue stats
    const [draftCampaigns, scheduledCampaigns, sendingCampaigns, sentCampaigns, failedCampaigns] = await Promise.all([
      db.newsletterCampaign.count({ where: { status: 'DRAFT' } }),
      db.newsletterCampaign.count({ where: { status: 'SCHEDULED' } }),
      db.newsletterCampaign.count({ where: { status: 'SENDING' } }),
      db.newsletterCampaign.count({ where: { status: 'SENT' } }),
      db.newsletterCampaign.count({ where: { status: 'FAILED' } }),
    ]);

    // SMTP status
    const smtpSettings = await db.smtpSetting.findMany({
      where: { isActive: true },
      select: { id: true, name: true, provider: true, host: true, fromEmail: true },
    });
    const smtpConfigured = smtpSettings.length > 0;
    const smtpProviders = smtpSettings.length;

    // Push notification count (PUSH channel notifications)
    const pushCount = await db.notification.count({ where: { channel: 'PUSH' } });

    return NextResponse.json({
      data: {
        emails: {
          totalSent: totalEmailSent,
          failed: failedEmails,
          sentInLast24h: recentEmailSent,
          failRate: totalEmailSent > 0 ? Math.round((failedEmails / totalEmailSent) * 10000) / 100 : 0,
        },
        notifications: {
          total: totalNotifications,
          unread: unreadNotifications,
          inLast24h: recentNotifications,
          pushCount,
          byChannel: byChannel.map((g) => ({ channel: g.channel, count: g._count.id })),
          byType: byType.map((g) => ({ type: g.type, count: g._count.id })),
        },
        newsletter: {
          draft: draftCampaigns,
          scheduled: scheduledCampaigns,
          sending: sendingCampaigns,
          sent: sentCampaigns,
          failed: failedCampaigns,
          total: draftCampaigns + scheduledCampaigns + sendingCampaigns + sentCampaigns + failedCampaigns,
        },
        smtp: {
          configured: smtpConfigured,
          providerCount: smtpProviders,
          providers: smtpSettings.map((s) => ({ name: s.name, provider: s.provider, fromEmail: s.fromEmail })),
        },
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:NOTIFICATION_STATS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notification stats' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
