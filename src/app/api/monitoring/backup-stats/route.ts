// ============================================================
// GET /api/monitoring/backup-stats — Backup statistics aggregation
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// =====================================================================
// GET — backup stats
// =====================================================================

export async function GET(_request: NextRequest) {
  const id = reqId();

  try {
    const [
      lastBackup,
      nextScheduledBackup,
      totalBackups,
      completedBackups,
      failedBackups,
      totalStorageUsed,
      verifiedCount,
      unverifiedCount,
      pendingVerificationCount,
      activeSchedulesCount,
      schedules,
      storageProviders,
      recentLogs,
    ] = await Promise.all([
      // Last completed backup
      db.backup.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { id: true, name: true, createdAt: true, completedAt: true, size: true, storageProvider: true },
      }),
      // Next scheduled backup
      db.backupSchedule.findFirst({
        where: { isActive: true, nextRunAt: { gte: new Date() } },
        orderBy: { nextRunAt: 'asc' },
        select: { id: true, name: true, nextRunAt: true, frequency: true },
      }),
      db.backup.count(),
      db.backup.count({ where: { status: 'COMPLETED' } }),
      db.backup.count({ where: { status: 'FAILED' } }),
      db.backup.aggregate({ _sum: { size: true } }),
      db.backup.count({ where: { verificationStatus: 'VERIFIED' } }),
      db.backup.count({ where: { verificationStatus: { in: ['FAILED', 'WARNING'] } } }),
      db.backup.count({ where: { verificationStatus: 'PENDING' } }),
      db.backupSchedule.count({ where: { isActive: true } }),
      // All schedules
      db.backupSchedule.findMany({
        select: { id: true, name: true, frequency: true, isActive: true, lastRunAt: true, nextRunAt: true },
      }),
      // Storage providers
      db.backupStorage.findMany({
        select: { id: true, name: true, provider: true, isActive: true, lastTestAt: true, lastTestResult: true },
      }),
      // Recent backup logs (last 10)
      db.backupLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, status: true, errorMessage: true, durationMs: true, createdAt: true },
      }),
    ]);

    // Restore points = completed backups with VERIFIED verification
    const restorePoints = await db.backup.count({
      where: { status: 'COMPLETED', verificationStatus: { in: ['VERIFIED', 'WARNING'] } },
    });

    // Cloud sync status
    const cloudStorages = storageProviders.filter((s) => s.provider !== 'LOCAL');
    const cloudSyncStatus = cloudStorages.length === 0
      ? 'NO_CLOUD_STORAGE'
      : cloudStorages.every((s) => s.lastTestResult === 'passed')
        ? 'SYNCED'
        : 'PARTIAL';

    return NextResponse.json({
      data: {
        lastBackup,
        nextScheduledBackup,
        totalBackups,
        completedBackups,
        failedBackups,
        successRate: totalBackups > 0 ? Math.round((completedBackups / totalBackups) * 10000) / 100 : 0,
        storageUsedBytes: totalStorageUsed._sum.size ?? 0,
        verification: {
          verified: verifiedCount,
          failed: unverifiedCount,
          pending: pendingVerificationCount,
        },
        restorePoints,
        activeSchedulesCount,
        schedules,
        storageProviders,
        cloudSyncStatus,
        recentLogs,
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:BACKUP_STATS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch backup stats' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
