// ============================================================
// POST /api/backups/[id]/restore — Restore a backup
// ============================================================
// Calls the backup-service restoreBackup() function which:
//   1. Validates the backup is COMPLETED.
//   2. Marks the backup as RESTORING.
//   3. Decrypts the archive if encrypted (AES-256-GCM).
//   4. Extracts `database.sqlite3` from the zip and copies it to
//      DB_PATH (with a `.pre-restore` safety-net backup first).
//   5. Updates the backup status to RESTORED.
//   6. Writes a BackupLog entry (action=restore, status=success/failed).
// Never copies the raw (possibly encrypted) backup file directly to
// DB_PATH — that would corrupt the database.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { requirePlatformAdmin, requireFeature } from '@/lib/platform/platform-auth';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

// ---------- validation ------------------------------------------------

const restoreSchema = z.object({
  createdById: z.string().min(1, 'Creator ID is required'),
  // `scope` is a sentinel marker used by the platform admin UI to indicate
  // platform-wide intent. It is OPTIONAL — when absent the request behaves
  // EXACTLY as before (existing client behavior preserved). When present
  // and equal to 'platform', the request is gated by requirePlatformAdmin.
  scope: z.literal('platform').optional(),
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

    // -------- scope=platform: gate with requirePlatformAdmin. The
    // platform admin UI marks the request with `scope: 'platform'` in
    // the body. When absent, behave EXACTLY as before.
    if (parsed.data.scope === 'platform') {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
    } else {
      // Client-side restore — gated by the plan's Backups feature
      // entitlement (server-side enforced; owner bypass passes).
      const featureAuth = await requireFeature(request, 'backups');
      if ('response' in featureAuth) return featureAuth.response;
    }

    const userId = parsed.data.createdById;

    // Prevent concurrent restores
    if (backup.status === 'RESTORING') {
      return NextResponse.json(
        { error: { code: 'ALREADY_RESTORING', message: 'Backup is already being restored' }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    // Only COMPLETED backups can be restored (the service re-validates
    // this, but checking here lets us return a clean 400 instead of a 500).
    if (backup.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: `Only completed backups can be restored (current: ${backup.status})` }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Delegate to the service — it handles decrypt + extract + DB
    // replace + status update + log entry atomically.
    try {
      const { restoreBackup } = await import('@/lib/backup/backup-service');
      const result = await restoreBackup(backupId, userId);

      return NextResponse.json({
        data: { id: backupId, status: 'RESTORED', ...result },
        meta: { requestId: id },
      });
    } catch (restoreError) {
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
