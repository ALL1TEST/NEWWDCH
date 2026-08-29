// ============================================================
// GET /api/backups/stats — Dashboard statistics
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { getSiteWhere } from '@/lib/site-context';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// =====================================================================
// GET — stats
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const scope = sp.get('scope');

    // -------- scope=platform: platform-admin-only stats across ALL
    // sites (no site filter). Falls through to the default client
    // behavior (site-scoped via getSiteWhere) when the param is absent
    // so existing callers keep working as before. `siteWhere` is
    // computed ONCE and spread into EVERY `where:` clause below so the
    // platform scope applies uniformly across all stats queries.
    let siteWhere: Record<string, unknown> = {};
    if (scope === 'platform') {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      // Platform scope: no site filter — stats reflect ALL backups
      // across all sites.
      siteWhere = {};
    } else {
      siteWhere = await getSiteWhere(request);
    }

    const [
      totalCount,
      totalSizeResult,
      completedCount,
      failedCount,
      creatingCount,
      restoredCount,
      avgDurationResult,
      lastBackup,
      nextScheduled,
      statusCounts,
      scopeCounts,
      typeCounts,
      recentLogs,
    ] = await Promise.all([
      // Total number of backups
      db.backup.count({ where: siteWhere }),

      // Total storage used (sum of sizes for backups that actually have
      // files on disk — COMPLETED or RESTORED. Backups in CREATING /
      // FAILED / VERIFYING / DELETING / RESTORING are in-flight or
      // failed and may not have a complete file.)
      db.backup.aggregate({
        where: { ...siteWhere, status: { in: ['COMPLETED', 'RESTORED'] } },
        _sum: { size: true },
      }),

      // Completed backups
      db.backup.count({ where: { ...siteWhere, status: 'COMPLETED' } }),

      // Failed backups
      db.backup.count({ where: { ...siteWhere, status: 'FAILED' } }),

      // Currently creating
      db.backup.count({ where: { ...siteWhere, status: 'CREATING' } }),

      // Restored backups (have real files on disk + a successful restore log)
      db.backup.count({ where: { ...siteWhere, status: 'RESTORED' } }),

      // Average duration of completed backups
      db.backup.aggregate({
        where: { ...siteWhere, status: { in: ['COMPLETED', 'RESTORED'] }, durationMs: { not: null } },
        _avg: { durationMs: true },
      }),

      // Last created backup
      db.backup.findFirst({
        where: siteWhere,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, filename: true, status: true, createdAt: true, size: true },
      }),

      // Next scheduled backup
      db.backupSchedule.findFirst({
        where: { ...siteWhere, isActive: true, nextRunAt: { not: null } },
        orderBy: { nextRunAt: 'asc' },
        select: { id: true, name: true, frequency: true, nextRunAt: true },
      }),

      // Count by status
      db.backup.groupBy({
        by: ['status'],
        where: siteWhere,
        _count: true,
      }),

      // Count by scope
      db.backup.groupBy({
        by: ['scope'],
        where: siteWhere,
        _count: true,
      }),

      // Count by type
      db.backup.groupBy({
        by: ['type'],
        where: siteWhere,
        _count: true,
      }),

      // Recent log entries (last 5)
      db.backupLog.findMany({
        where: siteWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, action: true, status: true, createdAt: true, errorMessage: true },
      }),
    ]);

    const totalSize = totalSizeResult._sum.size ?? 0;
    const successRate = totalCount > 0 ? ((completedCount / totalCount) * 100) : 0;
    const avgDurationMs = avgDurationResult._avg.durationMs ?? 0;

    // Format size to human readable
    const formatBytes = (bytes: number): string => {
      if (bytes === 0 || !bytes || !isFinite(bytes)) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Build status distribution
    const statusDistribution: Record<string, number> = {};
    for (const s of statusCounts) {
      statusDistribution[s.status] = s._count;
    }

    // Build scope distribution
    const scopeDistribution: Record<string, number> = {};
    for (const s of scopeCounts) {
      scopeDistribution[s.scope] = s._count;
    }

    // Build type distribution
    const typeDistribution: Record<string, number> = {};
    for (const t of typeCounts) {
      typeDistribution[t.type] = t._count;
    }

    // Storage trend: last 7 days of backup sizes — includes COMPLETED
    // AND RESTORED backups (both have real on-disk files). The dashboard
    // chart counts backups per day from this trend.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const storageTrend = await db.backup.findMany({
      where: { ...siteWhere, status: { in: ['COMPLETED', 'RESTORED'] }, completedAt: { gte: sevenDaysAgo } },
      select: { completedAt: true, size: true },
      orderBy: { completedAt: 'asc' },
    });

    const data = {
      totalBackups: totalCount,
      totalStorageBytes: totalSize,
      totalStorageFormatted: formatBytes(totalSize),
      completedBackups: completedCount,
      failedBackups: failedCount,
      creatingBackups: creatingCount,
      restoredBackups: restoredCount,
      successRate: Math.round(successRate * 100) / 100,
      avgDurationMs,
      avgDurationFormatted: avgDurationMs >= 1000
        ? `${(avgDurationMs / 1000).toFixed(2)}s`
        : `${avgDurationMs}ms`,
      lastBackup,
      nextScheduled,
      statusDistribution,
      scopeDistribution,
      typeDistribution,
      storageTrend,
      recentLogs,
      activeSchedulesCount: await db.backupSchedule.count({ where: { ...siteWhere, isActive: true } }),
    };

    return NextResponse.json({ data, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUPS:STATS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch backup stats' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
