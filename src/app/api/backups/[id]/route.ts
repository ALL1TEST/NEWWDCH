// ============================================================
// GET    /api/backups/[id] — Get single backup
// PATCH  /api/backups/[id] — Update backup (note, name)
// DELETE /api/backups/[id] — Delete backup + file cleanup
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const fullIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
  schedule: { select: { id: true, name: true } },
  logs: { orderBy: { createdAt: 'desc' }, take: 10 },
} as const;

type RouteContext = { params: Promise<{ id: string }> };

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().max(500).optional(),
  note: z.string().max(2000).optional().or(z.literal('')),
});

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: backupId } = await context.params;

    const item = await db.backup.findUnique({
      where: { id: backupId },
      include: fullIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Backup not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUPS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch backup' }, meta: { requestId: id } },
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
    const { id: backupId } = await context.params;

    const existing = await db.backup.findUnique({ where: { id: backupId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Backup not found' }, meta: { requestId: id } },
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
    if (d.note !== undefined) updateData.note = d.note === '' ? null : d.note;

    const updated = await db.backup.update({
      where: { id: backupId },
      data: updateData,
      include: fullIncludes,
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUPS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update backup' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — delete backup + file cleanup
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: backupId } = await context.params;

    const existing = await db.backup.findUnique({ where: { id: backupId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Backup not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Delete the physical backup file if it exists
    if (existing.storagePath && existsSync(existing.storagePath)) {
      try {
        await unlink(existing.storagePath);
      } catch (fileErr) {
        console.warn(`[BACKUPS:DELETE] Failed to delete file ${existing.storagePath}:`, fileErr);
      }
    }

    await db.backup.delete({ where: { id: backupId } });

    return NextResponse.json({ data: { id: backupId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUPS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete backup' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
