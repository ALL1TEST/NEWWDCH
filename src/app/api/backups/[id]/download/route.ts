// ============================================================
// GET /api/backups/[id]/download — Download a backup file
// ============================================================
// Streams the actual backup file from disk to the client. Increments
// the backup's downloadCount and writes a BackupLog entry
// (action=download) so the Logs page reflects every download.
// Gated by requirePlatformAdmin when ?scope=platform is passed so
// platform-wide backups cannot be downloaded by client-side users.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { existsSync, createReadStream, stat } from 'node:fs';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — download
// =====================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: backupId } = await context.params;

    // -------- scope=platform: gate with requirePlatformAdmin. The
    // platform admin UI passes `scope=platform` as a query param on
    // the download URL. When absent, behave EXACTLY as before (no
    // RBAC change) — client-side backups remain downloadable by the
    // site's admins.
    const scopeParam = new URL(request.url).searchParams.get('scope');
    let downloaderId: string | null = null;
    if (scopeParam === 'platform') {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      downloaderId = auth.user.id;
    }

    const backup = await db.backup.findUnique({ where: { id: backupId } });
    if (!backup) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Backup not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    if (!backup.storagePath || !existsSync(backup.storagePath)) {
      return NextResponse.json(
        { error: { code: 'FILE_NOT_FOUND', message: 'Backup file does not exist on disk' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Increment download count
    await db.backup.update({
      where: { id: backupId },
      data: { downloadCount: { increment: 1 } },
    });

    // Write a BackupLog entry for the download action so the Logs
    // page reflects every download. The log carries the storage
    // provider + the downloader's id (when known) so the audit trail
    // is complete.
    try {
      await db.backupLog.create({
        data: {
          backupId,
          action: 'download',
          status: 'success',
          archiveSize: backup.size,
          storageProvider: backup.storageProvider,
          createdById: downloaderId,
          siteId: backup.siteId,
        },
      });
    } catch (logErr) {
      // A log failure must never block the download itself.
      console.warn(`[BACKUP:DOWNLOAD] Failed to write log for ${backupId}:`, logErr);
    }

    // Get file stats for Content-Length
    const fileStat = await new Promise<import('node:fs').Stats>((resolve, reject) => {
      stat(backup.storagePath!, (err, stats) => {
        if (err) reject(err);
        else resolve(stats);
      });
    });

    // Create read stream
    const fileStream = createReadStream(backup.storagePath);

    // Return the file as an attachment
    return new NextResponse(fileStream as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${backup.filename}"`,
        'Content-Length': String(fileStat.size),
        'X-Request-Id': id,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error(`[BACKUP:DOWNLOAD] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to download backup' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
