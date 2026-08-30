// ============================================================
// SYSTEM HEALTH — real platform infrastructure monitoring.
// ============================================================
// Every value returned here is computed from a real source
// (live DB query, filesystem probe, persisted provider/SMTP
// state, ErrorLog rows, SystemMetric rows). Nothing is mocked.
//
// This module is the single source of truth consumed by:
//   - /api/platform/admin/system-health  (detailed page)
//   - getOverview()                     (summary tiles)
// Both therefore always show the SAME status per service.
// ============================================================

import { db } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';
import type { SystemHealthItem } from '@/lib/platform/platform-data';

// -------------------- Types --------------------

export type ServiceHealthKey = 'api' | 'database' | 'storage' | 'jobs' | 'email' | 'ai';
export type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unknown';

export interface ServiceMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface ServiceHealthCheck {
  key: ServiceHealthKey;
  label: string;
  category: 'core' | 'data' | 'infrastructure' | 'integrations';
  status: ServiceStatus;
  latencyMs: number | null;
  message: string;
  lastCheckedAt: string; // ISO
  metrics: ServiceMetric[];
  lastError?: string | null;
}

export interface HealthIncident {
  id: string;
  service: string;
  serviceName: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'investigating' | 'degraded' | 'resolved';
  startedAt: string;
  resolvedAt: string | null;
  durationSec: number | null;
  description: string;
}

export interface HealthHistoryRow {
  timestamp: string;
  api: ServiceStatus;
  database: ServiceStatus;
  storage: ServiceStatus;
  jobs: ServiceStatus;
  email: ServiceStatus;
  ai: ServiceStatus;
}

export interface HealthSnapshot {
  overall: 'operational' | 'degraded' | 'major_outage';
  healthyCount: number;
  totalCount: number;
  lastCheckedAt: string;
  services: ServiceHealthCheck[];
  incidents: HealthIncident[];
  history: HealthHistoryRow[];
  historyEnabled: boolean;
}

// -------------------- Helpers --------------------

function statusToValue(s: ServiceStatus): number {
  switch (s) {
    case 'operational': return 1;
    case 'degraded': return 0.5;
    case 'down': return 0;
    default: return -1; // unknown
  }
}

function valueToStatus(v: number | null | undefined): ServiceStatus {
  if (v === null || v === undefined) return 'unknown';
  switch (v) {
    case 1: return 'operational';
    case 0.5: return 'degraded';
    case 0: return 'down';
    default: return 'unknown';
  }
}

function rollUpOverall(statuses: ServiceStatus[]): 'operational' | 'degraded' | 'major_outage' {
  if (statuses.includes('down')) return 'major_outage';
  if (statuses.includes('degraded') || statuses.includes('unknown')) return 'degraded';
  return 'operational';
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(sec: number | null): string {
  if (sec === null || sec < 0) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

interface Timed<T> {
  result: T | null;
  ms: number;
  error: Error | null;
}

async function time<T>(fn: () => Promise<T>): Promise<Timed<T>> {
  const start = Date.now();
  try {
    const result = await fn();
    return { result, ms: Date.now() - start, error: null };
  } catch (e) {
    return { result: null, ms: Date.now() - start, error: e as Error };
  }
}

// -------------------- Per-service checkers --------------------

/**
 * API service check.
 *
 * We are inside the API process itself, so the very fact that
 * this code runs proves the request handler is responsive. We
 * additionally time a small DB-backed call to represent the
 * typical API → DB round-trip cost of a normal request.
 *
 * Status thresholds:
 *   < 200ms    operational
 *   < 1000ms   degraded (slower than expected)
 *   >= 1000ms  down
 */
async function checkApi(): Promise<ServiceHealthCheck> {
  const t = await time(() => db.user.count());
  let status: ServiceStatus;
  if (t.error) status = 'down';
  else if (t.ms >= 1000) status = 'down';
  else if (t.ms >= 200) status = 'degraded';
  else status = 'operational';

  const uptimeSec = Math.floor(process.uptime());
  const metrics: ServiceMetric[] = [
    { label: 'Request handler', value: 'Responsive', hint: 'This endpoint just answered' },
    { label: 'Round-trip latency', value: t.error ? 'Failed' : `${t.ms}ms`, hint: 'API → DB → response' },
    { label: 'Process uptime', value: formatDuration(uptimeSec) },
  ];
  return {
    key: 'api',
    label: 'API',
    category: 'core',
    status,
    latencyMs: t.error ? null : t.ms,
    message: t.error ? `Self-test failed: ${t.error.message}` : status === 'operational' ? 'All endpoints responding' : 'Higher than expected latency',
    lastCheckedAt: new Date().toISOString(),
    metrics,
    lastError: t.error?.message ?? null,
  };
}

/**
 * Database service check.
 *
 * Runs `SELECT 1` and measures latency, gets DB file size on disk,
 * counts recent ErrorLog rows tagged as database errors.
 */
async function checkDatabase(): Promise<ServiceHealthCheck> {
  const t = await time(() => db.$queryRaw`SELECT 1 AS ok`);
  let status: ServiceStatus;
  if (t.error) status = 'down';
  else if (t.ms >= 1000) status = 'down';
  else if (t.ms >= 200) status = 'degraded';
  else status = 'operational';

  let dbSizeBytes = 0;
  let dbPathStr = '';
  try {
    const dbPath = path.join(process.cwd(), 'db', 'custom.db');
    dbPathStr = dbPath;
    const stat = await fs.stat(dbPath);
    dbSizeBytes = stat.size;
  } catch {
    // ignore — filesystem probe optional
  }

  let recentErrors = 0;
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    recentErrors = await db.errorLog.count({
      where: {
        createdAt: { gte: since },
        OR: [
          { module: { contains: 'database' } },
          { module: { contains: 'db' } },
          { module: { contains: 'prisma' } },
        ],
      },
    });
  } catch { /* ignore */ }

  const metrics: ServiceMetric[] = [
    { label: 'Connection', value: t.error ? 'Failed' : 'Active' },
    { label: 'Latency', value: t.error ? '—' : `${t.ms}ms` },
    { label: 'Database size', value: formatBytes(dbSizeBytes), hint: dbPathStr || undefined },
    { label: 'Errors (24h)', value: `${recentErrors}` },
  ];
  return {
    key: 'database',
    label: 'Database',
    category: 'data',
    status,
    latencyMs: t.error ? null : t.ms,
    message: t.error ? `Connection failed: ${t.error.message}` : status === 'operational' ? 'SQLite connection healthy' : 'Slow query detected',
    lastCheckedAt: new Date().toISOString(),
    metrics,
    lastError: t.error?.message ?? null,
  };
}

/**
 * Storage check.
 *
 * Aggregates real Media.size bytes from the DB (sum across all
 * non-deleted media), tests the local filesystem upload directory
 * for read/write availability, and compares usage to a configured
 * limit (env STORAGE_LIMIT_BYTES, default 10 GiB).
 */
async function checkStorage(): Promise<ServiceHealthCheck> {
  // 1. Real aggregate of media bytes from DB.
  let usedBytes = 0;
  let usedError: Error | null = null;
  try {
    const agg = await db.media.aggregate({
      _sum: { size: true },
      where: { deletedAt: null },
    });
    usedBytes = (agg._sum.size ?? 0) as number;
  } catch (e) {
    usedError = e as Error;
  }

  // 2. Filesystem probe — write + read a small marker file in /public/uploads.
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  let fsWritable = false;
  let fsError: string | null = null;
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    const probePath = path.join(uploadDir, `.health-probe-${Date.now()}`);
    await fs.writeFile(probePath, 'ok', { encoding: 'utf-8' });
    await fs.readFile(probePath, 'utf-8');
    await fs.unlink(probePath);
    fsWritable = true;
  } catch (e) {
    fsError = (e as Error).message;
  }

  const limitBytes = Number(process.env.STORAGE_LIMIT_BYTES ?? 10 * 1024 * 1024 * 1024);
  const usagePct = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

  let status: ServiceStatus;
  if (usedError || !fsWritable) status = 'down';
  else if (usagePct >= 90) status = 'degraded';
  else status = 'operational';

  const metrics: ServiceMetric[] = [
    { label: 'Provider', value: 'Local filesystem' },
    { label: 'Used', value: formatBytes(usedBytes) },
    { label: 'Available', value: formatBytes(Math.max(0, limitBytes - usedBytes)), hint: `Limit ${formatBytes(limitBytes)}` },
    { label: 'Usage', value: `${usagePct.toFixed(1)}%` },
    { label: 'Read / write', value: fsWritable ? 'Available' : 'Unavailable', hint: fsError ?? undefined },
  ];
  return {
    key: 'storage',
    label: 'Storage',
    category: 'infrastructure',
    status,
    latencyMs: null,
    message: usedError
      ? `Aggregation failed: ${usedError.message}`
      : !fsWritable
        ? `Filesystem unavailable: ${fsError}`
        : status === 'degraded'
          ? 'Storage usage high'
          : 'Local storage available',
    lastCheckedAt: new Date().toISOString(),
    metrics,
    lastError: usedError?.message ?? fsError ?? null,
  };
}

/**
 * Background Jobs check.
 *
 * Real QueueJob table aggregates by status, plus last successful
 * (COMPLETED) execution time.
 */
async function checkJobs(): Promise<ServiceHealthCheck> {
  const t = await time(async () => {
    const groups = await db.queueJob.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const g of groups) map.set(g.status, g._count._all);

    const lastCompleted = await db.queueJob.findFirst({
      where: { status: 'COMPLETED', completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const failed1h = await db.queueJob.count({
      where: { status: 'FAILED', updatedAt: { gte: oneHourAgo } },
    });
    const failed24h = await db.queueJob.count({
      where: { status: 'FAILED', updatedAt: { gte: oneDayAgo } },
    });

    return {
      waiting: map.get('WAITING') ?? 0,
      running: map.get('ACTIVE') ?? 0,
      completed: map.get('COMPLETED') ?? 0,
      failed: map.get('FAILED') ?? 0,
      retrying: map.get('RETRYING') ?? 0,
      lastCompletedAt: lastCompleted?.completedAt ?? null,
      failed1h,
      failed24h,
    };
  });

  if (t.error) {
    return {
      key: 'jobs',
      label: 'Background Jobs',
      category: 'infrastructure',
      status: 'down',
      latencyMs: null,
      message: `Queue probe failed: ${t.error.message}`,
      lastCheckedAt: new Date().toISOString(),
      metrics: [{ label: 'Queue', value: 'Unavailable' }],
      lastError: t.error.message,
    };
  }

  const r = t.result!;
  let status: ServiceStatus;
  if (r.failed1h > 0) status = 'degraded';
  else if (r.failed24h > 5) status = 'degraded';
  else status = 'operational';

  const metrics: ServiceMetric[] = [
    { label: 'Queue (waiting)', value: `${r.waiting}` },
    { label: 'Running', value: `${r.running}` },
    { label: 'Completed', value: `${r.completed}` },
    { label: 'Failed (24h)', value: `${r.failed24h}`, hint: r.failed1h > 0 ? `${r.failed1h} in the last hour` : undefined },
    { label: 'Last success', value: r.lastCompletedAt ? new Date(r.lastCompletedAt).toISOString() : '—' },
  ];
  return {
    key: 'jobs',
    label: 'Background Jobs',
    category: 'infrastructure',
    status,
    latencyMs: t.ms,
    message: status === 'operational' ? 'Queue worker processing' : r.failed1h > 0 ? `${r.failed1h} job failure(s) in the last hour` : 'Recent job failures',
    lastCheckedAt: new Date().toISOString(),
    metrics,
    lastError: null,
  };
}

/**
 * Email Service check.
 *
 * Reads the configured default SMTP setting from the DB and reports
 * recent email-related errors. A live `transport.verify()` is NOT
 * executed automatically (it can be slow and the SMTP host may be
 * unreachable in sandboxes) — the operator can trigger that from the
 * SMTP Settings page. Here we only report configuration + recent
 * failures, both of which are real.
 */
async function checkEmail(): Promise<ServiceHealthCheck> {
  const t = await time(async () => {
    const smtp = await db.smtpSetting.findFirst({
      where: { isActive: true, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const recentErrors = await db.errorLog.count({
      where: {
        createdAt: { gte: since },
        OR: [
          { module: { contains: 'smtp' } },
          { module: { contains: 'email' } },
          { module: { contains: 'mail' } },
        ],
      },
    });

    // Last successful email-sent audit entry (best-effort)
    let lastDeliveryAt: string | null = null;
    try {
      const last = await db.auditLog.findFirst({
        where: { action: { contains: 'email' } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      lastDeliveryAt = last?.createdAt.toISOString() ?? null;
    } catch { /* ignore */ }

    return { smtp, recentErrors, lastDeliveryAt };
  });

  if (t.error) {
    return {
      key: 'email',
      label: 'Email Service',
      category: 'integrations',
      status: 'down',
      latencyMs: null,
      message: `Probe failed: ${t.error.message}`,
      lastCheckedAt: new Date().toISOString(),
      metrics: [{ label: 'Configuration', value: 'Unavailable' }],
      lastError: t.error.message,
    };
  }

  const r = t.result!;
  if (!r.smtp) {
    return {
      key: 'email',
      label: 'Email Service',
      category: 'integrations',
      status: 'unknown',
      latencyMs: null,
      message: 'No default SMTP configuration found. Configure one in SMTP Settings.',
      lastCheckedAt: new Date().toISOString(),
      metrics: [
        { label: 'Configuration', value: 'Not configured' },
        { label: 'Errors (24h)', value: `${r.recentErrors}` },
      ],
      lastError: null,
    };
  }

  const status: ServiceStatus = r.recentErrors > 0 ? 'degraded' : 'operational';
  // Mask host for security (show domain only)
  const hostDisplay = r.smtp.host ? r.smtp.host.replace(/^[^.@]+\.?/, '*.') : '—';
  const metrics: ServiceMetric[] = [
    { label: 'Provider', value: r.smtp.provider ?? 'SMTP' },
    { label: 'Host', value: hostDisplay },
    { label: 'Port / encryption', value: `${r.smtp.port} / ${r.smtp.encryption}` },
    { label: 'Errors (24h)', value: `${r.recentErrors}` },
    { label: 'Last delivery', value: r.lastDeliveryAt ?? '—' },
  ];
  return {
    key: 'email',
    label: 'Email Service',
    category: 'integrations',
    status,
    latencyMs: null,
    message: status === 'operational' ? `Configured — ${r.smtp.provider ?? 'SMTP'}` : 'Recent email delivery errors',
    lastCheckedAt: new Date().toISOString(),
    metrics,
    lastError: r.recentErrors > 0 ? `${r.recentErrors} email error(s) in the last 24h` : null,
  };
}

/**
 * Summarize a raw provider error into a concise human-readable
 * form for the card message + a one-line incident description.
 *
 * The persisted `lastError` on an AI provider can be very long
 * (e.g. `HTTP 403: {"error":{"code":"unsupported_country_region_territory",
 * "message":"Country, region, or territory not supported",...}}`).
 * Showing that raw text directly on the card makes the card
 * unnecessarily tall. This helper extracts the HTTP status code
 * (when present) and the inner JSON `message` (when present) so
 * the card can show e.g. "Provider health check failed (HTTP 403)"
 * and the Recent Incidents list can show e.g.
 * "HTTP 403 — Country, region, or territory not supported".
 * The full raw error stays available on the card under
 * "Last error" (collapsed by default with a Read more/Read less
 * toggle handled by the frontend).
 */
function summarizeProviderError(raw: string | null | undefined): {
  card: string;
  incident: string;
} {
  if (!raw) {
    return { card: 'Provider health check failed', incident: 'Provider health check failed' };
  }
  const httpMatch = raw.match(/HTTP\s+(\d{3})/i);
  const code = httpMatch?.[1];
  const msgMatch = raw.match(/"message"\s*:\s*"([^"]+)"/);
  const innerMsg = msgMatch?.[1];
  if (code && innerMsg) {
    return {
      card: `Provider health check failed (HTTP ${code})`,
      incident: `HTTP ${code} — ${innerMsg}`,
    };
  }
  if (code) {
    return {
      card: `Provider health check failed (HTTP ${code})`,
      incident: `HTTP ${code}`,
    };
  }
  // Fallback — strip raw JSON, keep the human-readable prefix.
  const cutoff = raw.indexOf('{');
  let trimmed: string;
  if (cutoff > 0) {
    trimmed = raw.slice(0, cutoff).replace(/[\s:]+$/, '').trim();
  } else {
    trimmed = raw.length > 80 ? `${raw.slice(0, 80)}…` : raw;
  }
  return {
    card: trimmed ? `Provider unavailable — ${trimmed}` : 'Provider health check failed',
    incident: trimmed || 'Provider health check failed',
  };
}

/**
 * AI Service check.
 *
 * Reads the default AI provider's persisted connection state.
 * The connectionStatus field is updated by the AI settings page
 * whenever the operator runs a real provider health check (which
 * pings the upstream API). We do NOT trigger that here to avoid
 * slow external HTTP calls on every page load, but the status we
 * report is the real persisted result of the last real check.
 */
async function checkAi(): Promise<ServiceHealthCheck> {
  const t = await time(async () => {
    const provider = await db.aiProvider.findFirst({
      where: { isActive: true, isDefault: true },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        kind: true,
        connectionStatus: true,
        latencyMs: true,
        lastHealthCheckAt: true,
        lastError: true,
        lastUsedAt: true,
        models: { where: { isActive: true }, select: { id: true } },
      },
    });
    const recentErrors = await db.aiLog.count({
      where: {
        status: { not: 'success' },
        createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
    });
    return { provider, recentErrors };
  });

  if (t.error) {
    return {
      key: 'ai',
      label: 'AI Service',
      category: 'integrations',
      status: 'down',
      latencyMs: null,
      message: `Probe failed: ${t.error.message}`,
      lastCheckedAt: new Date().toISOString(),
      metrics: [{ label: 'Provider', value: 'Unavailable' }],
      lastError: t.error.message,
    };
  }

  const r = t.result!;
  if (!r.provider) {
    return {
      key: 'ai',
      label: 'AI Service',
      category: 'integrations',
      status: 'unknown',
      latencyMs: null,
      message: 'No default AI provider configured. Add one in AI Providers.',
      lastCheckedAt: new Date().toISOString(),
      metrics: [
        { label: 'Provider', value: 'Not configured' },
        { label: 'Errors (24h)', value: `${r.recentErrors}` },
      ],
      lastError: null,
    };
  }

  const p = r.provider;
  let status: ServiceStatus;
  switch (p.connectionStatus) {
    case 'CONNECTED': status = 'operational'; break;
    case 'DISCONNECTED': status = 'unknown'; break;
    case 'ERROR': status = 'down'; break;
    default: status = 'unknown';
  }
  if (status === 'operational' && r.recentErrors >= 5) status = 'degraded';

  const metrics: ServiceMetric[] = [
    { label: 'Provider', value: p.name },
    { label: 'Kind', value: p.kind },
    { label: 'Active models', value: `${p.models.length}` },
    { label: 'Latency', value: p.latencyMs !== null ? `${p.latencyMs}ms` : '—', hint: 'Last provider check' },
    { label: 'Last check', value: p.lastHealthCheckAt ? new Date(p.lastHealthCheckAt).toISOString() : '—' },
    { label: 'Errors (24h)', value: `${r.recentErrors}` },
  ];
  // For the AI card we surface a concise human-readable summary of
  // any provider error (e.g. "Provider health check failed (HTTP
  // 403)") instead of dumping the full raw error text into the
  // message line. The full raw error stays available under
  // "Last error" (collapsed by default with a Read more/Read less
  // toggle handled by the frontend).
  const summary = p.lastError ? summarizeProviderError(p.lastError) : null;
  return {
    key: 'ai',
    label: 'AI Service',
    category: 'integrations',
    status,
    latencyMs: p.latencyMs,
    message: summary
      ? summary.card
      : status === 'operational'
        ? `${p.name} reachable`
        : status === 'unknown'
          ? 'Provider not yet verified — run a health check from AI Providers'
          : 'Provider reported an error',
    lastCheckedAt: new Date().toISOString(),
    metrics,
    lastError: p.lastError ?? null,
  };
}

// -------------------- Incidents --------------------

/**
 * Build the Recent Incidents feed from BOTH the current health-check
 * snapshot (live, active incidents) AND the historical ErrorLog rows
 * (recently resolved incidents). This is the single consistent source
 * used by the System Health page — no separate fake dataset.
 *
 * Derivation rules:
 *   - status === 'down'        → critical incident, status='investigating'
 *   - status === 'degraded'    → warning incident, status='degraded'
 *   - status === 'unknown'     → info incident (configuration gap such
 *                                as "SMTP not configured" or
 *                                "AI provider not configured"),
 *                                status='investigating'
 *   - status === 'operational' → no live incident
 *
 * For the AI service with a raw `lastError`, the incident description
 * is a concise human-readable summary (e.g.
 * "HTTP 403 — Country, region, or territory not supported") so the
 * feed stays readable; the full raw error stays available on the
 * service card under "Last error".
 */
async function loadIncidents(services: ServiceHealthCheck[]): Promise<HealthIncident[]> {
  const incidents: HealthIncident[] = [];

  // 1. Live incidents derived from the current health-check snapshot.
  for (const s of services) {
    if (s.status === 'operational') continue;
    const severity: HealthIncident['severity'] =
      s.status === 'down' ? 'critical' : s.status === 'degraded' ? 'warning' : 'info';
    const status: HealthIncident['status'] =
      s.status === 'degraded' ? 'degraded' : 'investigating';
    // For AI service with a raw lastError, use the concise summary as
    // the incident description (e.g. "HTTP 403 — Country, region, or
    // territory not supported"). For other services, fall back to
    // the service's own health message.
    let description = s.message;
    if (s.key === 'ai' && s.lastError) {
      description = summarizeProviderError(s.lastError).incident;
    } else if (s.lastError && s.status === 'down') {
      // For non-AI down services, prefer the persisted lastError over
      // the message line since the message is typically a generic
      // status sentence while lastError has the actual root cause.
      description = s.lastError;
    }
    incidents.push({
      id: `live-${s.key}`,
      service: s.key,
      serviceName: s.label,
      severity,
      status,
      startedAt: s.lastCheckedAt,
      resolvedAt: null,
      durationSec: null,
      description,
    });
  }

  // 2. Historical incidents from the ErrorLog (last 7 days, take 12).
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const errors = await db.errorLog.findMany({
      where: {
        createdAt: { gte: since },
        severity: { in: ['WARNING', 'ERROR', 'FATAL'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    for (const e of errors) {
      incidents.push({
        id: e.id,
        service: e.module ?? 'system',
        serviceName: e.module ? e.module.charAt(0).toUpperCase() + e.module.slice(1) : 'System',
        severity: e.severity === 'WARNING' ? 'warning' : 'critical',
        status: e.isResolved ? 'resolved' : 'investigating',
        startedAt: e.createdAt.toISOString(),
        resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
        durationSec:
          e.resolvedAt && e.createdAt
            ? Math.floor((e.resolvedAt.getTime() - e.createdAt.getTime()) / 1000)
            : null,
        description: [e.exception, e.message].filter(Boolean).join(' — ') || 'No details available',
      });
    }
  } catch {
    // ignore — best-effort
  }

  // 3. Sort: unresolved first, then by severity (critical → warning →
  // info), then by most recent startedAt. Cap at 24 rows so the feed
  // stays scannable.
  const sevRank: Record<HealthIncident['severity'], number> = {
    critical: 0, warning: 1, info: 2,
  };
  incidents.sort((a, b) => {
    const aResolved = a.status === 'resolved' ? 1 : 0;
    const bResolved = b.status === 'resolved' ? 1 : 0;
    if (aResolved !== bResolved) return aResolved - bResolved;
    const sevDiff = sevRank[a.severity] - sevRank[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  return incidents.slice(0, 24);
}

// -------------------- History --------------------

/**
 * Record a history snapshot to SystemMetric, rate-limited to one
 * snapshot per minute (so frequent page loads / refreshes do not
 * bloat the table). Best-effort — failures here never break the
 * main health response.
 */
async function recordHistorySnapshot(services: ServiceHealthCheck[]): Promise<void> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const recent = await db.systemMetric.findFirst({
      where: {
        metricType: { startsWith: 'service_health:' },
        createdAt: { gte: oneMinuteAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (recent) return; // throttled

    await db.systemMetric.createMany({
      data: services.map((s) => ({
        metricType: `service_health:${s.key}`,
        value: statusToValue(s.status),
        unit: 'status',
        labels: JSON.stringify({
          status: s.status,
          latencyMs: s.latencyMs ?? null,
          message: s.message,
        }),
        siteId: null,
      })),
    });
  } catch {
    // best-effort — never throw to the caller
  }
}

async function loadHistory(): Promise<HealthHistoryRow[]> {
  try {
    // 6 services per snapshot × 24 snapshots = 144 rows.
    const rows = await db.systemMetric.findMany({
      where: { metricType: { startsWith: 'service_health:' } },
      orderBy: { createdAt: 'desc' },
      take: 144,
    });
    if (rows.length === 0) return [];

    // Group by createdAt (down to the second — they were written in the same createMany call).
    const groups = new Map<string, Map<string, ServiceStatus>>();
    for (const r of rows) {
      const ts = r.createdAt.toISOString();
      const svcKey = r.metricType.replace('service_health:', '') as ServiceHealthKey;
      if (!groups.has(ts)) groups.set(ts, new Map());
      const val = typeof r.value === 'number' ? r.value : Number(r.value);
      groups.get(ts)!.set(svcKey, valueToStatus(val));
    }

    return Array.from(groups.entries())
      .slice(0, 24)
      .map(([ts, m]) => ({
        timestamp: ts,
        api: m.get('api') ?? 'unknown',
        database: m.get('database') ?? 'unknown',
        storage: m.get('storage') ?? 'unknown',
        jobs: m.get('jobs') ?? 'unknown',
        email: m.get('email') ?? 'unknown',
        ai: m.get('ai') ?? 'unknown',
      }));
  } catch {
    return [];
  }
}

// -------------------- Public API --------------------

/**
 * Run all service health checks and assemble the full snapshot.
 * This is the single source of truth for both the System Health
 * page (detailed) and the Overview summary (via getSystemHealthSummary).
 */
export async function runHealthChecks(): Promise<HealthSnapshot> {
  const now = new Date().toISOString();
  const services = await Promise.all([
    checkApi(),
    checkDatabase(),
    checkStorage(),
    checkJobs(),
    checkEmail(),
    checkAi(),
  ]);

  const statuses = services.map((s) => s.status);
  const overall = rollUpOverall(statuses);
  const healthyCount = services.filter((s) => s.status === 'operational').length;

  // Incidents are derived FROM the live service snapshot (plus
  // historical ErrorLog rows) so the Recent Incidents feed can NEVER
  // disagree with the service cards or the overall status — if AI is
  // down, an AI incident appears here; if Email is unconfigured, an
  // informational incident appears here. No fake "platform stable"
  // empty state when an actual service is failing.
  const incidents = await loadIncidents(services);

  // Record a history snapshot (best-effort, rate-limited).
  await recordHistorySnapshot(services);

  const history = await loadHistory();

  return {
    overall,
    healthyCount,
    totalCount: services.length,
    lastCheckedAt: now,
    services,
    incidents,
    history,
    historyEnabled: true,
  };
}

/**
 * Compact summary (same SystemHealthItem shape Overview already
 * consumes). Delegates to runHealthChecks so Overview and the
 * System Health page can NEVER disagree.
 */
export async function getSystemHealthSummary(): Promise<SystemHealthItem[]> {
  const snapshot = await runHealthChecks();
  return snapshot.services.map((s) => ({
    key: s.key,
    label: s.label,
    status: s.status,
    latencyMs: s.latencyMs ?? 0,
    note: s.message,
  }));
}

export function formatDurationHelper(sec: number | null): string {
  return formatDuration(sec);
}
