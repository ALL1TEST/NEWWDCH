// ============================================================
// GET /api/monitoring/api-status — External service status checks
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// =====================================================================
// GET — external service statuses
// =====================================================================

export async function GET(_request: NextRequest) {
  const id = reqId();

  try {
    const now = new Date();
    const services: Array<{
      name: string;
      status: string;
      latency: number | null;
      lastSuccess: string | null;
      lastError: string | null;
      quota?: unknown;
      remainingCredits?: unknown;
    }> = [];

    // 1. AI Providers
    const aiProviders = await db.aiProvider.findMany({
      select: {
        name: true,
        kind: true,
        isActive: true,
        connectionStatus: true,
        latencyMs: true,
        lastError: true,
        lastUsedAt: true,
        lastHealthCheckAt: true,
        pricingInfo: true,
      },
    });

    for (const p of aiProviders) {
      let pricing: { inputCostPer1k?: number; outputCostPer1k?: number } | null = null;
      try { pricing = p.pricingInfo ? JSON.parse(p.pricingInfo) : null; } catch { /* ignore */ }

      services.push({
        name: `AI: ${p.name} (${p.kind})`,
        status: !p.isActive ? 'DISABLED'
          : p.connectionStatus === 'CONNECTED' ? 'UP'
          : p.connectionStatus === 'ERROR' ? 'DOWN'
          : 'DEGRADED',
        latency: p.latencyMs,
        lastSuccess: p.lastUsedAt?.toISOString() ?? null,
        lastError: p.lastError,
        quota: pricing,
      });
    }

    // 2. SMTP settings
    const smtpSettings = await db.smtpSetting.findMany({
      where: { isActive: true },
      select: { id: true, name: true, provider: true, host: true, createdAt: true, updatedAt: true },
    });

    for (const s of smtpSettings) {
      services.push({
        name: `SMTP: ${s.name} (${s.provider})`,
        status: s.host ? 'UP' : 'DEGRADED',
        latency: null,
        lastSuccess: s.updatedAt.toISOString(),
        lastError: null,
      });
    }

    // 3. Search Console connections
    const searchConsoleConns = await db.searchConsoleConnection.findMany({
      select: {
        id: true,
        siteUrl: true,
        status: true,
        lastSyncAt: true,
        expiresAt: true,
      },
    });

    for (const c of searchConsoleConns) {
      const isExpired = c.expiresAt && c.expiresAt < now;
      services.push({
        name: `Search Console: ${c.siteUrl}`,
        status: c.status === 'CONNECTED' && !isExpired ? 'UP'
          : isExpired ? 'DOWN'
          : c.status === 'DISCONNECTED' ? 'DOWN'
          : 'DEGRADED',
        latency: null,
        lastSuccess: c.lastSyncAt?.toISOString() ?? null,
        lastError: isExpired ? 'Token expired' : null,
      });
    }

    // 4. Cloud Storage (BackupStorage providers)
    const backupStorages = await db.backupStorage.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        lastTestAt: true,
        lastTestResult: true,
      },
    });

    for (const s of backupStorages) {
      const testPassed = s.lastTestResult === 'passed';
      services.push({
        name: `Storage: ${s.name} (${s.provider})`,
        status: !s.isActive ? 'DISABLED'
          : s.lastTestAt && testPassed ? 'UP'
          : s.lastTestAt && !testPassed ? 'DOWN'
          : 'DEGRADED',
        latency: null,
        lastSuccess: testPassed && s.lastTestAt ? s.lastTestAt.toISOString() : null,
        lastError: s.lastTestResult === 'failed' ? 'Connection test failed' : null,
      });
    }

    // Summary
    const upCount = services.filter((s) => s.status === 'UP').length;
    const downCount = services.filter((s) => s.status === 'DOWN').length;
    const degradedCount = services.filter((s) => s.status === 'DEGRADED').length;
    const disabledCount = services.filter((s) => s.status === 'DISABLED').length;

    return NextResponse.json({
      data: {
        services,
        summary: { total: services.length, up: upCount, down: downCount, degraded: degradedCount, disabled: disabledCount },
        timestamp: now.toISOString(),
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[MONITORING:API_STATUS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch API status' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
