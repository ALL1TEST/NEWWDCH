// ============================================================
// GET /api/monitoring/performance — Performance metrics for charts
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

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// =====================================================================
// GET — performance metrics
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const type = sp.get('type') || undefined;
    const siteId = sp.get('siteId') || undefined;
    const rangeHours = Math.min(720, Math.max(1, Number(sp.get('rangeHours')) || 24));
    const since = new Date(Date.now() - rangeHours * 60 * 60 * 1000);

    // Real-time system metrics
    const cpuUsage = computeCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramPercent = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 10000) / 100 : 0;

    let dbFileSize = 0;
    try {
      const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '';
      if (dbPath) dbFileSize = statSync(dbPath).size;
    } catch { /* ignore */ }

    // Active sessions as proxy for active connections
    const activeConnections = await db.session.count({
      where: { expiresAt: { gt: new Date() } },
    });

    const realtime = {
      cpu: { usagePercent: cpuUsage, cores: os.cpus().length },
      memory: { usagePercent: ramPercent, usedBytes: totalMem - freeMem, totalBytes: totalMem, freeBytes: freeMem },
      disk: { dbFileSize, dbFileSizeFormatted: formatBytes(dbFileSize) },
      activeConnections,
    };

    // Historical metrics from SystemMetric table
    const metricWhere: Record<string, unknown> = { createdAt: { gte: since } };
    if (type) metricWhere.metricType = type;
    if (siteId) metricWhere.siteId = siteId;

    const metrics = await db.systemMetric.findMany({
      where: metricWhere,
      orderBy: { createdAt: 'asc' },
      take: 5000, // limit for charting
    });

    // Aggregate latest value per type for summary
    const latestByType: Record<string, { value: number; unit: string | null; timestamp: string }> = {};
    for (const m of metrics) {
      const existing = latestByType[m.metricType];
      if (!existing || m.createdAt > new Date(existing.timestamp)) {
        latestByType[m.metricType] = { value: m.value, unit: m.unit, timestamp: m.createdAt.toISOString() };
      }
    }

    // Average per metric type over the range
    const avgByType: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    const grouped: Record<string, number[]> = {};
    for (const m of metrics) {
      if (!grouped[m.metricType]) grouped[m.metricType] = [];
      grouped[m.metricType].push(m.value);
    }
    for (const [key, vals] of Object.entries(grouped)) {
      const sum = vals.reduce((a, b) => a + b, 0);
      avgByType[key] = {
        avg: Math.round((sum / vals.length) * 100) / 100,
        min: Math.min(...vals),
        max: Math.max(...vals),
        count: vals.length,
      };
    }

    return NextResponse.json({
      data: {
        realtime,
        historical: metrics,
        latestByType,
        avgByType,
        range: { hours: rangeHours, since: since.toISOString() },
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:PERFORMANCE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch performance metrics' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
