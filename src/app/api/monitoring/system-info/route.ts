// ============================================================
// GET /api/monitoring/system-info — Extended system information
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { statSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function tryReadGitCommit(): string {
  try {
    const headPath = join(process.cwd(), '.git', 'HEAD');
    const head = readFileSync(headPath, 'utf-8').trim();
    if (head.startsWith('ref:')) {
      const refPath = join(process.cwd(), '.git', head.replace('ref: ', ''));
      return readFileSync(refPath, 'utf-8').trim().substring(0, 8);
    }
    return head.substring(0, 8);
  } catch {
    return 'unknown';
  }
}

function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const result: { private: string[]; public: string[] } = { private: [], public: [] };
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name] ?? [];
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        // Heuristic: 10.x, 172.16-31.x, 192.168.x are private
        const octets = addr.address.split('.').map(Number);
        if (octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168)) {
          if (!result.private.includes(addr.address)) result.private.push(addr.address);
        } else {
          if (!result.public.includes(addr.address)) result.public.push(addr.address);
        }
      }
    }
  }
  return result;
}

// =====================================================================
// GET — system info
// =====================================================================

export async function GET(_request: NextRequest) {
  const id = reqId();

  try {
    // ---- OS-level info ----
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 10000) / 100 : 0;

    // DB file size
    let dbSize = 0;
    let diskInfo: { dbSizeFormatted: string } = { dbSizeFormatted: '0 B' };
    try {
      const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '';
      if (dbPath) {
        dbSize = statSync(dbPath).size;
        diskInfo = { dbSizeFormatted: formatBytes(dbSize) };
      }
    } catch {
      // ignore
    }

    const networkIps = getNetworkInterfaces();

    // ---- DB record counts ----
    const [
      contentItems,
      users,
      media,
      comments,
      sessions,
      categories,
      tags,
      forms,
      submissions,
      campaigns,
      subscribers,
      webhooks,
      webhookDeliveries,
      backups,
      jobs,
      auditLogs,
      notifications,
      analyticsEvents,
      navigations,
    ] = await Promise.all([
      db.contentItem.count({ where: { deletedAt: null } }),
      db.user.count(),
      db.media.count(),
      db.comment.count(),
      db.session.count(),
      db.category.count(),
      db.tag.count(),
      db.form.count(),
      db.formSubmission.count(),
      db.newsletterCampaign.count(),
      db.newsletterSubscriber.count(),
      db.webhook.count(),
      db.webhookDelivery.count(),
      db.backup.count(),
      db.queueJob.count(),
      db.auditLog.count(),
      db.notification.count(),
      db.analyticsEvent.count(),
      db.navigation.count(),
    ]);

    const activeSessions = await db.session.count({
      where: { expiresAt: { gt: new Date() } },
    });

    const totalRecords = contentItems + users + media + comments + sessions + categories + tags + forms + submissions + campaigns + subscribers + webhooks + webhookDeliveries + backups + jobs + auditLogs + notifications + analyticsEvents + navigations;

    return NextResponse.json({
      data: {
        // CPU info
        cpu: {
          model: cpus[0]?.model || 'Unknown',
          cores: cpus.length,
          speed: cpus[0]?.speed || 0, // MHz
        },
        // RAM
        memory: {
          totalBytes: totalMem,
          usedBytes: usedMem,
          freeBytes: freeMem,
          usagePercent: ramPercent,
          totalFormatted: formatBytes(totalMem),
          usedFormatted: formatBytes(usedMem),
          freeFormatted: formatBytes(freeMem),
        },
        // Disk
        disk: diskInfo,
        // Node & OS
        nodeVersion: process.version,
        os: {
          platform: os.platform(),
          release: os.release(),
          type: os.type(),
          arch: os.arch(),
          hostname: os.hostname(),
        },
        environment: process.env.NODE_ENV || 'development',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        // Git
        gitCommit: tryReadGitCommit(),
        // Network
        network: networkIps,
        // Database
        databaseSize: dbSize,
        totalRecords,
        activeSessions,
        recordCounts: {
          contentItems,
          users,
          media,
          comments,
          sessions,
          categories,
          tags,
          forms,
          submissions,
          campaigns,
          subscribers,
          webhooks,
          webhookDeliveries,
          backups,
          jobs,
          auditLogs,
          notifications,
          analyticsEvents,
          navigations,
        },
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:SYSTEM_INFO] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch system info' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
