// ============================================================
// GET    /api/backups/[id] — Get single backup
// PATCH  /api/backups/[id] — Update backup (note, name)
// DELETE /api/backups/[id] — Delete backup + file cleanup
// ============================================================
// DELETE is gated by requirePlatformAdmin when ?scope=platform is
// passed — platform-wide backups cannot be deleted by client-side
// users. Every delete also writes a BackupLog entry (action=delete)
// so the audit trail in the Logs page reflects every deletion.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { requirePlatformAdmin, requireFeature } from '@/lib/platform/platform-auth';

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

  // Gated by the plan's Backups feature entitlement (server-side
  // enforced; owner bypass passes).
  const featureAuth = await requireFeature(request, 'backups');
  if ('response' in featureAuth) return featureAuth.response;

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

export async function DELETE(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: backupId } = await context.params;

    // -------- scope=platform: gate with requirePlatformAdmin. The
    // platform admin UI passes `scope=platform` as a query param on
    // the DELETE URL. When absent, behave EXACTLY as before (no
    // RBAC change) — client-side backups remain deletable by the
    // site's admins.
    const scopeParam = new URL(request.url).searchParams.get('scope');
    let deleterId: string | null = null;
    if (scopeParam === 'platform') {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      deleterId = auth.user.id;
    } else {
      // Client-side delete — gated by the plan's Backups feature
      // entitlement (server-side enforced; owner bypass passes).
      const featureAuth = await requireFeature(request, 'backups');
      if ('response' in featureAuth) return featureAuth.response;
      deleterId = featureAuth.user.id;
    }

    const existing = await db.backup.findUnique({ where: { id: backupId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Backup not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Refuse to delete a backup that is currently being restored — the
    // restore flow reads the file from disk mid-operation; deleting it
    // mid-flight would corrupt the in-progress restore.
    if (existing.status === 'RESTORING') {
      return NextResponse.json(
        { error: { code: 'LOCKED', message: 'Backup is currently being restored — try again later.' }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    // Delete the physical backup file if it exists. The backup's
    // storagePath may point to either the .zip (CREATING state, before
    // encryption) or .enc (final state after encryption). For robustness,
    // try the canonical path first, then the encrypted variant if the
    // canonical path doesn't exist.
    let fileDeleted = false;
    const tryPaths = [
      existing.storagePath,
      existing.storagePath?.replace(/\.zip$/, '.enc'),
      existing.storagePath?.replace(/\.enc$/, '.zip'),
    ].filter((p, i, arr): p is string => typeof p === 'string' && arr.indexOf(p) === i);
    for (const p of tryPaths) {
      if (existsSync(p)) {
        try {
          await unlink(p);
          fileDeleted = true;
          break;
        } catch (fileErr) {
          console.warn(`[BACKUPS:DELETE] Failed to delete file ${p}:`, fileErr);
        }
      }
    }

    await db.backup.delete({ where: { id: backupId } });

    // Write a BackupLog entry for the delete action so the Logs page
    // reflects every deletion. The log is written AFTER the row delete
    // (so the backup record itself is gone first) but with backupId
    // carried via the BackupLog's nullable backupId FK — the FK has
    // onDelete: Cascade, so we delete the backup BEFORE writing the
    // log to avoid the cascade wiping the log we just wrote. We use
    // a separate non-cascading field via `action='delete'` and set
    // backupId=null since the backup no longer exists.
    try {
      await db.backupLog.create({
        data: {
          backupId: null, // backup row already deleted
          action: 'delete',
          status: 'success',
          archiveSize: existing.size,
          storageProvider: existing.storageProvider,
          warnings: fileDeleted ? undefined : 'Backup file was not present on disk at deletion time',
          createdById: deleterId,
          siteId: existing.siteId,
        },
      });
    } catch (logErr) {
      console.warn(`[BACKUPS:DELETE] Failed to write log for ${backupId}:`, logErr);
    }

    return NextResponse.json({ data: { id: backupId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUPS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete backup' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
