// ============================================================
// GET  /api/backups      — List backups with filters & pagination
// POST /api/backups      — Create a real SQLite backup
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DB_PATH = path.join(process.cwd(), 'db', 'custom.db');

const listIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
  schedule: { select: { id: true, name: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().max(200).optional(),
  scope: z.enum(['FULL', 'DATABASE_ONLY', 'MEDIA_ONLY', 'FILES_ONLY', 'SETTINGS_ONLY']).default('FULL'),
  type: z.enum(['AUTOMATED', 'MANUAL']).default('MANUAL'),
  note: z.string().max(2000).optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')), // alias for note
  siteId: z.string().optional(),
  scheduleId: z.string().optional(),
  storageProvider: z.enum(['LOCAL', 'AMAZON_S3', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'BACKBLAZE_B2', 'FTP', 'SFTP']).default('LOCAL'),
  storageId: z.string().optional(), // ID of a configured BackupStorage destination
  encryptionEnabled: z.boolean().optional(),
  verifyAfterUpload: z.boolean().optional(),
  createdById: z.string().min(1, 'Creator ID is required').optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'filename', 'type', 'status', 'size', 'scope', 'completedAt', 'durationMs']);

// ---------- utility: compute sha256 ----------------------------------

async function computeFileSha256(filePath: string): Promise<string> {
  const crypto = await import('node:crypto');
  const fs = await import('node:fs/promises');
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// ---------- utility: format timestamp ---------------------------------

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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
    const status = sp.get('status');
    const type = sp.get('type');
    const scope = sp.get('scope');
    const provider = sp.get('storageProvider');
    const search = sp.get('search')?.trim();

    const where: Record<string, unknown> = { ...(await getSiteWhere(request)) };

    if (status) where.status = status;
    if (type) where.type = type;
    if (scope) where.scope = scope;
    if (provider) where.storageProvider = provider;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { filename: { contains: search } },
        { note: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.backup.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.backup.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[BACKUPS:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch backups' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create a real SQLite backup
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

    // Use the backup service for real backup creation (archive → encrypt → upload → verify → log)
    try {
      const { createBackup } = await import('@/lib/backup/backup-service');
      const backup = await createBackup({
        name: d.name,
        scope: d.scope,
        type: d.type,
        note: d.note || d.description,
        storageId: d.storageId,
        storageProvider: d.storageProvider,
        encryptionEnabled: d.encryptionEnabled,
        verifyAfterUpload: d.verifyAfterUpload ?? true,
        createdById: d.createdById,
        siteId: d.siteId,
        scheduleId: d.scheduleId,
      });

      // Fetch with includes for the response
      const result = await db.backup.findUnique({ where: { id: backup.id }, include: listIncludes });
      return NextResponse.json({ data: result, meta: { requestId: id } }, { status: 201 });
    } catch (backupError) {
      return NextResponse.json(
        {
          error: {
            code: 'BACKUP_FAILED',
            message: 'Backup creation failed',
            details: backupError instanceof Error ? backupError.message : 'Unknown error',
          },
          meta: { requestId: id },
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error(`[BACKUPS:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create backup' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
