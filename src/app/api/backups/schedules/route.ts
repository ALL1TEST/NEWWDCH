// ============================================================
// GET  /api/backups/schedules      — List backup schedules
// POST /api/backups/schedules      — Create a backup schedule
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const listIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
  _count: { select: { backups: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim(),
  description: z.string().max(1000).default(''),
  frequency: z.enum(['HOURLY', 'EVERY_6_HOURS', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM_CRON']).default('DAILY'),
  cronExpression: z.string().max(100).optional(),
  customCron: z.string().max(100).optional(), // alias for cronExpression
  scope: z.enum(['FULL', 'DATABASE_ONLY', 'MEDIA_ONLY', 'FILES_ONLY', 'SETTINGS_ONLY']).default('FULL'),
  storageProvider: z.enum(['LOCAL', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'FTP']).default('LOCAL'),
  encryptionEnabled: z.boolean().default(false),
  verificationEnabled: z.boolean().default(true),
  retentionCount: z.number().int().min(1).max(1000).default(10),
  isActive: z.boolean().default(true),
  siteId: z.string().optional(),
  createdById: z.string().min(1, 'Creator ID is required').optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'name', 'frequency', 'isActive', 'lastRunAt', 'nextRunAt']);

// ---------- utility: compute next run time ---------------------------

function computeNextRunAt(frequency: string, cronExpression?: string | null): Date {
  const now = new Date();
  switch (frequency) {
    case 'HOURLY':
      now.setHours(now.getHours() + 1);
      break;
    case 'EVERY_6_HOURS':
      now.setHours(now.getHours() + 6);
      break;
    case 'DAILY':
      now.setDate(now.getDate() + 1);
      now.setHours(2, 0, 0, 0); // 2 AM next day
      break;
    case 'WEEKLY':
      now.setDate(now.getDate() + 7);
      now.setHours(2, 0, 0, 0);
      break;
    case 'MONTHLY':
      now.setMonth(now.getMonth() + 1);
      now.setDate(1);
      now.setHours(2, 0, 0, 0);
      break;
    case 'CUSTOM_CRON':
    default:
      // Fallback: 24 hours from now
      now.setHours(now.getHours() + 24);
      break;
  }
  return now;
}

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? (sp.get('sort') as string) : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';

    // Filters
    const isActive = sp.get('isActive');
    const frequency = sp.get('frequency');
    const search = sp.get('search')?.trim();
    const scope = sp.get('scope');

    // -------- scope=platform: platform-admin-only view of ALL schedules
    // across all sites (no site filter). Falls through to the default
    // client behavior (site-scoped via getSiteWhere) when the param is
    // absent so existing callers keep working as before. Note: 'platform'
    // is NOT a valid BackupScope enum value, so it must be intercepted
    // here BEFORE the `where.scope = scope` filter line below.
    let siteFilter: Record<string, unknown> = {};
    if (scope === 'platform') {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      // Platform scope: no site filter — return ALL schedules across all sites.
      siteFilter = {};
    } else {
      siteFilter = await getSiteWhere(request);
    }

    const where: Record<string, unknown> = { ...siteFilter };

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (frequency) where.frequency = frequency;
    if (scope && scope !== 'platform') where.scope = scope;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.backupSchedule.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.backupSchedule.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[BACKUP_SCHEDULES:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch backup schedules' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create
// =====================================================================

export async function POST(request: NextRequest) {
  const id = reqId();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // -------- scope=platform: platform admin can create platform-wide
    // schedules (siteId = null, createdById = authenticated admin). When
    // scope is absent, behave EXACTLY as before — client-side schedules
    // pick up siteId from the query string / context. Note: 'platform'
    // is NOT a valid BackupScope enum value (the zod schema below will
    // reject it), so we peek at the raw body BEFORE zod validation and
    // rewrite the scope field to the actual BackupScope (default FULL).
    // The platform dialog sends `scope: 'platform'` as a marker AND
    // `backupScope: <BackupScope>` for the real data-scope choice.
    const isPlatformScope =
      typeof body === 'object' && body !== null && (body as { scope?: unknown }).scope === 'platform';

    let platformUser: { id: string } | null = null;
    let preparedBody: unknown = body;
    if (isPlatformScope) {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      platformUser = { id: auth.user.id };

      // Rewrite the body so zod sees a valid BackupScope. Default to
      // FULL when the platform dialog did not supply a `backupScope`.
      const rawBody = (body as Record<string, unknown>) ?? {};
      const backupScope = rawBody.backupScope;
      const validBackupScopes = ['FULL', 'DATABASE_ONLY', 'MEDIA_ONLY', 'FILES_ONLY', 'SETTINGS_ONLY'];
      const resolvedScope =
        typeof backupScope === 'string' && validBackupScopes.includes(backupScope) ? backupScope : 'FULL';
      const { ...rest } = rawBody;
      delete rest.scope;
      delete rest.backupScope;
      preparedBody = { ...rest, scope: resolvedScope };
    }

    const parsed = createSchema.safeParse(preparedBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const resolvedCron = d.cronExpression ?? d.customCron ?? null;
    const nextRunAt = computeNextRunAt(d.frequency, resolvedCron);

    // Resolve createdById — for platform scope, use the authenticated
    // admin's id (override client-supplied). For client scope, fall
    // back to first user if not provided (existing behavior preserved).
    let createdById: string | undefined;
    if (isPlatformScope && platformUser) {
      createdById = platformUser.id;
    } else {
      createdById = d.createdById;
      if (!createdById) {
        const firstUser = await db.user.findFirst({ select: { id: true } });
        createdById = firstUser?.id;
        if (!createdById) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'No users exist in the system. Create a user first.' }, meta: { requestId: id } },
            { status: 400 },
          );
        }
      }
    }

    // Platform scope: force siteId = null (platform-wide). Client scope:
    // leave siteId exactly as the caller provided (or null) — existing
    // behavior preserved.
    const siteId = isPlatformScope ? null : (d.siteId ?? null);

    const item = await db.backupSchedule.create({
      data: {
        name: d.name,
        description: d.description,
        frequency: d.frequency,
        cronExpression: resolvedCron,
        scope: d.scope,
        storageProvider: d.storageProvider,
        encryptionEnabled: d.encryptionEnabled,
        verificationEnabled: d.verificationEnabled,
        retentionCount: d.retentionCount,
        isActive: d.isActive,
        nextRunAt,
        createdById,
        siteId,
      },
      include: listIncludes,
    });

    // Write a BackupLog entry for the schedule creation so the audit
    // trail reflects every configured schedule. The action='schedule'
    // value matches the Schedule filter option in the Logs page.
    try {
      await db.backupLog.create({
        data: {
          backupId: null,
          action: 'schedule',
          status: 'success',
          storageProvider: d.storageProvider,
          warnings: `Schedule "${d.name}" created (${d.frequency}, retention=${d.retentionCount})`,
          createdById,
          siteId,
        },
      });
    } catch (logErr) {
      console.warn(`[BACKUP_SCHEDULES:CREATE] Failed to write log:`, logErr);
    }

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[BACKUP_SCHEDULES:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create backup schedule' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
