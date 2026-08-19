// ============================================================
// GET /api/monitoring/health — Full dependency health check
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { statSync } from 'fs';
import os from 'os';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

interface HealthEntry {
  name: string;
  status: string;
  lastCheck: string;
  latency: number;
  error?: string;
  version?: string;
  lastSuccess?: string | null;
  retryCount?: number;
}

function getDbFilePath(): string {
  const raw = process.env.DATABASE_URL?.replace('file:', '') || '';
  if (!raw) return '';
  if (path.isAbsolute(raw)) return raw;
  const resolved = path.resolve(process.cwd(), 'prisma', raw);
  if (existsSync(resolved)) return resolved;
  return path.resolve(process.cwd(), raw);
}

async function checkDatabase(): Promise<HealthEntry> {
  const start = Date.now();
  try {
    const dbPath = getDbFilePath();
    let size = 0;
    if (dbPath && existsSync(dbPath)) {
      try { size = statSync(dbPath).size; } catch { /* ignore */ }
    }
    await db.$queryRaw`SELECT 1`;
    return {
      name: 'Database (SQLite)',
      status: 'UP',
      lastCheck: new Date().toISOString(),
      latency: Date.now() - start,
      version: 'SQLite',
      lastSuccess: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: 'Database (SQLite)',
      status: 'DOWN',
      lastCheck: new Date().toISOString(),
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

async function checkStorage(): Promise<HealthEntry> {
  const start = Date.now();
  try {
    const dbPath = getDbFilePath();
    if (dbPath && existsSync(dbPath)) statSync(dbPath);
    return {
      name: 'Storage (Disk)',
      status: 'UP',
      lastCheck: new Date().toISOString(),
      latency: Date.now() - start,
      lastSuccess: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: 'Storage (Disk)',
      status: 'DOWN',
      lastCheck: new Date().toISOString(),
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : 'Disk check failed',
    };
  }
}

// =====================================================================
// GET — health
// =====================================================================

export async function GET(_request: NextRequest) {
  const id = reqId();

  try {
    const now = new Date().toISOString();
    const dependencies: HealthEntry[] = [];

    // 1. Real-time system checks
    const [dbHealth, storageHealth] = await Promise.all([
      checkDatabase(),
      checkStorage(),
    ]);
    dependencies.push(dbHealth, storageHealth);

    // 2. Existing DependencyHealth records
    const existingDeps = await db.dependencyHealth.findMany({
      orderBy: { name: 'asc' },
    });
    for (const d of existingDeps) {
      dependencies.push({
        name: d.name,
        status: d.status,
        lastCheck: d.lastCheckedAt.toISOString(),
        latency: d.responseTime ?? 0,
        lastSuccess: d.status === 'UP' ? d.lastCheckedAt.toISOString() : null,
      });
    }

    // 3. SMTP check from SmtpSetting
    const smtpSettings = await db.smtpSetting.findMany({
      where: { isActive: true },
    });
    if (smtpSettings.length > 0) {
      const hasConfig = smtpSettings.some((s) => s.host && s.host.length > 0);
      dependencies.push({
        name: 'SMTP',
        status: hasConfig ? 'UP' : 'DEGRADED',
        lastCheck: now,
        latency: 0,
        version: `${smtpSettings.length} provider(s) configured`,
        lastSuccess: hasConfig ? now : null,
      });
    }

    // 4. AI Providers from AiProvider table
    const aiProviders = await db.aiProvider.findMany({
      where: { isActive: true },
    });
    const aiConnected = aiProviders.filter((p) => p.connectionStatus === 'CONNECTED').length;
    dependencies.push({
      name: 'AI Providers',
      status: aiProviders.length === 0 ? 'DEGRADED' : aiConnected > 0 ? 'UP' : 'DOWN',
      lastCheck: now,
      latency: 0,
      version: `${aiConnected}/${aiProviders.length} connected`,
      lastSuccess: aiConnected > 0 ? now : null,
    });

    // 5. Webhooks from Webhook table
    const webhookCount = await db.webhook.count({ where: { isActive: true } });
    const webhookFailed = await db.webhook.count({
      where: { isActive: true, failureCount: { gt: 0 } },
    });
    dependencies.push({
      name: 'Webhooks',
      status: webhookCount === 0 ? 'DEGRADED' : webhookFailed > 0 ? 'DEGRADED' : 'UP',
      lastCheck: now,
      latency: 0,
      version: `${webhookCount} active, ${webhookFailed} with failures`,
      lastSuccess: webhookFailed === 0 && webhookCount > 0 ? now : null,
    });

    // 6. Cron / Scheduler from SchedulerLog
    const schedulerLogs = await db.schedulerLog.findMany();
    const failedSchedulers = schedulerLogs.filter((s) => s.status === 'FAILED' || s.status === 'RETRYING').length;
    dependencies.push({
      name: 'Scheduled Jobs',
      status: schedulerLogs.length === 0 ? 'DEGRADED' : failedSchedulers > 0 ? 'DEGRADED' : 'UP',
      lastCheck: now,
      latency: 0,
      version: `${schedulerLogs.length} jobs, ${failedSchedulers} failed`,
      lastSuccess: failedSchedulers === 0 && schedulerLogs.length > 0 ? now : null,
    });

    const allHealthy = dependencies.every((d) => d.status === 'UP');

    return NextResponse.json({
      data: {
        status: allHealthy ? 'UP' : dependencies.some((d) => d.status === 'DOWN') ? 'DOWN' : 'DEGRADED',
        dependencies,
        timestamp: now,
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:HEALTH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch health status' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
