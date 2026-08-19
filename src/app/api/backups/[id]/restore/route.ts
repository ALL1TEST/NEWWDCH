// ============================================================
// POST /api/backups/[id]/restore — Restore a backup
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const DB_PATH = path.join(process.cwd(), 'db', 'custom.db');

type RouteContext = { params: Promise<{ id: string }> };

// ---------- validation ------------------------------------------------

const restoreSchema = z.object({
  createdById: z.string().min(1, 'Creator ID is required'),
});

// =====================================================================
// POST — restore
// =====================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: backupId } = await context.params;

    const backup = await db.backup.findUnique({
      where: { id: backupId },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    if (!backup) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Backup not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = restoreSchema.safeParse(body);
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

    const userId = parsed.data.createdById;

    // Verify backup file exists
    if (!backup.storagePath || !existsSync(backup.storagePath)) {
      return NextResponse.json(
        { error: { code: 'FILE_NOT_FOUND', message: 'Backup file does not exist on disk' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    if (backup.status === 'RESTORING') {
      return NextResponse.json(
        { error: { code: 'ALREADY_RESTORING', message: 'Backup is already being restored' }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    const startedAt = Date.now();

    // Mark as RESTORING
    await db.backup.update({
      where: { id: backupId },
      data: { status: 'RESTORING' },
    });

    try {
      // Copy the backup file back to the database location
      await copyFile(backup.storagePath, DB_PATH);

      const durationMs = Date.now() - startedAt;
      const restoredStat = await stat(DB_PATH);

      // Update backup status
      const updated = await db.backup.update({
        where: { id: backupId },
        data: {
          status: 'RESTORED',
          databaseSize: restoredStat.size,
        },
      });

      // Create BackupLog entry
      await db.backupLog.create({
        data: {
          backupId,
          action: 'restore',
          status: 'success',
          databaseSize: restoredStat.size,
          fileCount: 1,
          archiveSize: restoredStat.size,
          durationMs,
          storageProvider: backup.storageProvider,
          createdById: userId,
          siteId: backup.siteId,
        },
      });

      return NextResponse.json({
        data: { id: backupId, status: 'RESTORED', durationMs },
        meta: { requestId: id },
      });
    } catch (restoreError) {
      const durationMs = Date.now() - startedAt;

      // Mark as FAILED
      await db.backup.update({
        where: { id: backupId },
        data: { status: 'FAILED' },
      });

      // Create error log
      await db.backupLog.create({
        data: {
          backupId,
          action: 'restore',
          status: 'failed',
          durationMs,
          storageProvider: backup.storageProvider,
          errorMessage: restoreError instanceof Error ? restoreError.message : 'Unknown restore error',
          createdById: userId,
          siteId: backup.siteId,
        },
      });

      return NextResponse.json(
        {
          error: {
            code: 'RESTORE_FAILED',
            message: 'Failed to restore backup',
            details: restoreError instanceof Error ? restoreError.message : 'Unknown error',
          },
          meta: { requestId: id },
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error(`[BACKUP:RESTORE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to restore backup' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
