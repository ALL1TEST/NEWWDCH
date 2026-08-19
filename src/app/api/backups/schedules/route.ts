// ============================================================
// GET  /api/backups/schedules      — List backup schedules
// POST /api/backups/schedules      — Create a backup schedule
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

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
  storageProvider: z.enum(['LOCAL', 'AMAZON_S3', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'FTP', 'SFTP']).default('LOCAL'),
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

    const where: Record<string, unknown> = { ...(await getSiteWhere(request)) };

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (frequency) where.frequency = frequency;
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

    const parsed = createSchema.safeParse(body);
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

    // Resolve createdById — fallback to first user if not provided
    let createdById = d.createdById;
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
        siteId: d.siteId ?? null,
      },
      include: listIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[BACKUP_SCHEDULES:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create backup schedule' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
