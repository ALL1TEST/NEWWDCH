// ============================================================
// GET /api/backups/[id]/download — Download a backup file
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { existsSync } from 'node:fs';
import { createReadStream, stat } from 'node:fs';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

// =====================================================================
// GET — download
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
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
