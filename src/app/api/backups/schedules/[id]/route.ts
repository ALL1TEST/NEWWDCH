// ============================================================
// GET    /api/backups/schedules/[id] — Get single schedule
// PATCH  /api/backups/schedules/[id] — Update schedule
// DELETE /api/backups/schedules/[id] — Delete schedule
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const fullIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
  _count: { select: { backups: true } },
} as const;

type RouteContext = { params: Promise<{ id: string }> };

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  frequency: z.enum(['HOURLY', 'EVERY_6_HOURS', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM_CRON']).optional(),
  cronExpression: z.string().max(100).nullable().optional(),
  scope: z.enum(['FULL', 'DATABASE_ONLY', 'MEDIA_ONLY', 'FILES_ONLY', 'SETTINGS_ONLY']).optional(),
  storageProvider: z.enum(['LOCAL', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'FTP']).optional(),
  encryptionEnabled: z.boolean().optional(),
  verificationEnabled: z.boolean().optional(),
  retentionCount: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
});

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
      now.setHours(2, 0, 0, 0);
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
      now.setHours(now.getHours() + 24);
      break;
  }
  return now;
}

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: scheduleId } = await context.params;

    const item = await db.backupSchedule.findUnique({
      where: { id: scheduleId },
      include: fullIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Backup schedule not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUP_SCHEDULES:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch backup schedule' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: scheduleId } = await context.params;

    const existing = await db.backupSchedule.findUnique({ where: { id: scheduleId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Backup schedule not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = updateSchema.safeParse(body);
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
    const updateData: Record<string, unknown> = {};
    if (d.name !== undefined) updateData.name = d.name;
    if (d.description !== undefined) updateData.description = d.description;
    if (d.frequency !== undefined) {
      updateData.frequency = d.frequency;
      // Recompute nextRunAt when frequency changes
      updateData.nextRunAt = computeNextRunAt(d.frequency, d.cronExpression ?? existing.cronExpression);
    }
    if (d.cronExpression !== undefined) updateData.cronExpression = d.cronExpression;
    if (d.scope !== undefined) updateData.scope = d.scope;
    if (d.storageProvider !== undefined) updateData.storageProvider = d.storageProvider;
    if (d.encryptionEnabled !== undefined) updateData.encryptionEnabled = d.encryptionEnabled;
    if (d.verificationEnabled !== undefined) updateData.verificationEnabled = d.verificationEnabled;
    if (d.retentionCount !== undefined) updateData.retentionCount = d.retentionCount;
    if (d.isActive !== undefined) updateData.isActive = d.isActive;

    const updated = await db.backupSchedule.update({
      where: { id: scheduleId },
      data: updateData,
      include: fullIncludes,
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUP_SCHEDULES:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update backup schedule' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: scheduleId } = await context.params;

    const existing = await db.backupSchedule.findUnique({
      where: { id: scheduleId },
      include: { _count: { select: { backups: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Backup schedule not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Disassociate any linked backups
    if (existing._count.backups > 0) {
      await db.backup.updateMany({
        where: { scheduleId },
        data: { scheduleId: null },
      });
    }

    await db.backupSchedule.delete({ where: { id: scheduleId } });

    return NextResponse.json({ data: { id: scheduleId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUP_SCHEDULES:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete backup schedule' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
