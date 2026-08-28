// ============================================================
// POST /api/backups/[id]/verify — Verify a backup (checksum)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

// ---------- validation ------------------------------------------------

const verifySchema = z.object({
  createdById: z.string().min(1, 'Creator ID is required'),
  // `scope` is a sentinel marker used by the platform admin UI to indicate
  // platform-wide intent. It is OPTIONAL — when absent the request behaves
  // EXACTLY as before (existing client behavior preserved). When present
  // and equal to 'platform', the request is gated by requirePlatformAdmin.
  scope: z.literal('platform').optional(),
});

// ---------- utility: compute sha256 ----------------------------------

async function computeFileSha256(filePath: string): Promise<string> {
 const fileBuffer = await readFile(filePath);
 return createHash('sha256').update(fileBuffer).digest('hex');
}

// =====================================================================
// POST — verify
// =====================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: backupId } = await context.params;

    const backup = await db.backup.findUnique({ where: { id: backupId } });
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

    const parsed = verifySchema.safeParse(body);
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
    }

    const userId = parsed.data.createdById;
    const startedAt = Date.now();

    // Mark as VERIFYING
    await db.backup.update({
      where: { id: backupId },
      data: { status: 'VERIFYING' },
    });

    try {
      // Check if file exists
      if (!backup.storagePath || !existsSync(backup.storagePath)) {
        const durationMs = Date.now() - startedAt;
        await db.backup.update({
          where: { id: backupId },
          data: { verificationStatus: 'FAILED' },
        });

        await db.backupLog.create({
          data: {
            backupId,
            action: 'verify',
            status: 'failed',
            durationMs,
            storageProvider: backup.storageProvider,
            errorMessage: 'Backup file not found on disk',
            createdById: userId,
            siteId: backup.siteId,
          },
        });

        return NextResponse.json(
          {
            error: { code: 'FILE_NOT_FOUND', message: 'Backup file does not exist on disk' },
            meta: { requestId: id },
          },
          { status: 400 },
        );
      }

      // Re-compute checksum
      const currentChecksum = await computeFileSha256(backup.storagePath);
      const durationMs = Date.now() - startedAt;

      // Compare with stored checksum
      let verificationStatus: 'VERIFIED' | 'FAILED' | 'WARNING';
      let verificationMessage: string;

      if (!backup.checksum) {
        // No stored checksum — save it and mark as VERIFIED
        verificationStatus = 'VERIFIED';
        verificationMessage = 'No previous checksum found. Current checksum has been stored.';
        await db.backup.update({
          where: { id: backupId },
          data: { checksum: currentChecksum, verificationStatus: 'VERIFIED' },
        });
      } else if (currentChecksum === backup.checksum) {
        verificationStatus = 'VERIFIED';
        verificationMessage = 'Checksum matches. Backup integrity verified.';
        await db.backup.update({
          where: { id: backupId },
          data: { verificationStatus: 'VERIFIED' },
        });
      } else {
        verificationStatus = 'FAILED';
        verificationMessage = 'Checksum mismatch. Backup file may be corrupted.';
        await db.backup.update({
          where: { id: backupId },
          data: { verificationStatus: 'FAILED' },
        });
      }

      // Restore status if it was VERIFYING
      const restoreStatus = backup.status === 'VERIFYING' || backup.status === 'COMPLETED'
        ? 'COMPLETED'
        : backup.status;
      await db.backup.update({
        where: { id: backupId },
        data: { status: restoreStatus },
      });

      // Create BackupLog
      await db.backupLog.create({
        data: {
          backupId,
          action: 'verify',
          status: verificationStatus === 'VERIFIED' ? 'success' : 'failed',
          durationMs,
          storageProvider: backup.storageProvider,
          verificationResult: verificationStatus,
          createdById: userId,
          siteId: backup.siteId,
          warnings: verificationStatus === 'WARNING' ? verificationMessage : undefined,
        },
      });

      return NextResponse.json({
        data: {
          id: backupId,
          verificationStatus,
          message: verificationMessage,
          storedChecksum: backup.checksum,
          currentChecksum,
          matches: currentChecksum === (backup.checksum ?? currentChecksum),
          durationMs,
        },
        meta: { requestId: id },
      });
    } catch (verifyError) {
      const durationMs = Date.now() - startedAt;

      await db.backup.update({
        where: { id: backupId },
        data: { verificationStatus: 'FAILED', status: backup.status === 'VERIFYING' ? 'COMPLETED' : backup.status },
      });

      await db.backupLog.create({
        data: {
          backupId,
          action: 'verify',
          status: 'failed',
          durationMs,
          storageProvider: backup.storageProvider,
          errorMessage: verifyError instanceof Error ? verifyError.message : 'Unknown verification error',
          createdById: userId,
          siteId: backup.siteId,
        },
      });

      return NextResponse.json(
        {
          error: {
            code: 'VERIFY_FAILED',
            message: 'Backup verification failed',
            details: verifyError instanceof Error ? verifyError.message : 'Unknown error',
          },
          meta: { requestId: id },
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error(`[BACKUP:VERIFY] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to verify backup' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
