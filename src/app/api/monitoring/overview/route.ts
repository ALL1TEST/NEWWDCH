// ============================================================
// GET /api/monitoring/overview — Aggregated monitoring overview
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import os from 'os';
import { statSync } from 'fs';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// Simple in-memory cache (10s TTL)
let cached: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 10_000;

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function computeCpuUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      const t = cpu.times[type as keyof typeof cpu.times];
      totalTick += t;
      if (type === 'idle') totalIdle += t;
    }
  }
  return totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 10000) / 100 : 0;
}

// =====================================================================
// GET — overview
// =====================================================================

export async function GET(_request: NextRequest) {
  const id = reqId();

  // Serve from cache if still valid
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ data: cached.data, meta: { requestId: id } });
  }

  try {
    // ---- System resources via OS ----
    const cpuUsage = computeCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 10000) / 100 : 0;

    // DB file size
    let dbSize = 0;
    try {
      const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '';
      if (dbPath) dbSize = statSync(dbPath).size;
    } catch {
      // ignore
    }

    // ---- Parallel DB queries ----
    const [
      healthRecords,
      queueByStatus,
      recentErrorCount,
      activeAlertCount,
      aiProviderSummary,
      backupSummary,
      totalSites,
    ] = await Promise.all([
      // System health from DependencyHealth
      db.dependencyHealth.findMany({ orderBy: { name: 'asc' } }),

      // Queue stats by status
      db.queueJob.groupBy({ by: ['status'], _count: { status: true } }),

      // Recent error count (last 24h, unresolved)
      db.errorLog.count({
        where: {
          isResolved: false,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),

      // Active alert count (TRIGGERED + ACKNOWLEDGED + SNOOZED)
      db.alert.count({
        where: {
          status: { in: ['TRIGGERED', 'ACKNOWLEDGED', 'SNOOZED'] },
        },
      }),

      // AI provider status summary
      db.aiProvider.groupBy({
        by: ['connectionStatus', 'isActive'],
        _count: { id: true },
      }),

      // Backup summary
      db.backup.groupBy({
        by: ['status'],
        _count: { status: true, id: true },
        _sum: { size: true },
      }),

      db.site.count(),
    ]);

    // Derive overall health
    const overallStatus = healthRecords.every((d) => d.status === 'UP')
      ? 'UP'
      : healthRecords.some((d) => d.status === 'DOWN')
        ? 'DOWN'
        : 'DEGRADED';

    // Queue stats map
    const queueStats: Record<string, number> = {};
    for (const g of queueByStatus) {
      queueStats[g.status] = g._count.status;
    }

    // AI provider summary
    const aiConnected = aiProviderSummary
      .filter((g) => g.isActive && g.connectionStatus === 'CONNECTED')
      .reduce((sum, g) => sum + g._count.id, 0);
    const aiTotal = aiProviderSummary.reduce((sum, g) => sum + g._count.id, 0);

    // Backup summary
    const backupStats: Record<string, { count: number; totalSize: number }> = {};
    for (const g of backupSummary) {
      backupStats[g.status] = {
        count: g._count.status,
        totalSize: g._sum.size ?? 0,
      };
    }

    const data = {
      timestamp: new Date().toISOString(),
      systemHealth: {
        status: overallStatus,
        totalDependencies: healthRecords.length,
        healthyCount: healthRecords.filter((d) => d.status === 'UP').length,
        degradedCount: healthRecords.filter((d) => d.status === 'DEGRADED').length,
        downCount: healthRecords.filter((d) => d.status === 'DOWN').length,
      },
      resources: {
        cpu: {
          usagePercent: cpuUsage,
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || 'Unknown',
        },
        ram: {
          totalBytes: totalMem,
          usedBytes: usedMem,
          freeBytes: freeMem,
          usagePercent: ramPercent,
          totalFormatted: formatBytes(totalMem),
          usedFormatted: formatBytes(usedMem),
          freeFormatted: formatBytes(freeMem),
        },
        disk: {
          dbSizeBytes: dbSize,
          dbSizeFormatted: formatBytes(dbSize),
        },
      },
      queue: queueStats,
      errors: {
        recentUnresolved24h: recentErrorCount,
      },
      alerts: {
        activeCount: activeAlertCount,
      },
      ai: {
        totalProviders: aiTotal,
        connectedProviders: aiConnected,
      },
      backups: backupStats,
      sites: { total: totalSites },
    };

    cached = { data, ts: Date.now() };

    return NextResponse.json({ data, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MONITORING:OVERVIEW] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch monitoring overview' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
