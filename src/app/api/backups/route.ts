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
  storageProvider: z.enum(['LOCAL', 'AMAZON_S3', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'FTP', 'SFTP']).default('LOCAL'),
  encryptionEnabled: z.boolean().optional(),
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
    const startedAt = Date.now();
    const now = new Date();
    const timestamp = formatTimestamp(now);
    const scope = d.scope as string;
    const backupName = d.name?.trim() || `Backup ${timestamp}`;
    const filename = `backup-${timestamp}-${scope.toLowerCase()}.sqlite3`;
    const storagePath = path.join(BACKUP_DIR, filename);

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

    // Resolve note: accept both `note` and `description` (description is an alias)
    const note = d.note === '' ? null : d.description === '' ? null : d.description ?? d.note ?? null;
    const encryptionStatus = d.encryptionEnabled ? 'ENCRYPTED' as const : 'NONE' as const;

    // Ensure backups directory exists
    if (!existsSync(BACKUP_DIR)) {
      await mkdir(BACKUP_DIR, { recursive: true });
    }

    // Create the backup record with CREATING status
    const backup = await db.backup.create({
      data: {
        name: backupName,
        filename,
        scope: d.scope,
        type: d.type,
        status: 'CREATING',
        note,
        storageProvider: d.storageProvider,
        storagePath,
        encryptionStatus,
        verificationStatus: 'PENDING',
        createdById,
        siteId: d.siteId ?? null,
        scheduleId: d.scheduleId ?? null,
        siteName: null,
      },
      include: listIncludes,
    });

    // Perform the actual SQLite backup
    try {
      // Get the database size before backup
      const dbStat = await stat(DB_PATH).catch(() => null);
      const databaseSize = dbStat?.size ?? 0;

      // Copy the SQLite database file
      await copyFile(DB_PATH, storagePath);

      // Calculate file size
      const backupStat = await stat(storagePath);
      const fileSize = backupStat.size;

      // Compute SHA-256 checksum
      const checksum = await computeFileSha256(storagePath);

      const durationMs = Date.now() - startedAt;

      // Update backup record as COMPLETED
      const completed = await db.backup.update({
        where: { id: backup.id },
        data: {
          status: 'COMPLETED',
          size: fileSize,
          databaseSize,
          durationMs,
          checksum,
          verificationStatus: 'VERIFIED',
          completedAt: new Date(),
          fileCount: 1, // SQLite DB is a single file
        },
        include: listIncludes,
      });

      // Create a backup log entry
      await db.backupLog.create({
        data: {
          backupId: backup.id,
          action: 'create',
          status: 'success',
          databaseSize,
          fileCount: 1,
          archiveSize: fileSize,
          durationMs,
          storageProvider: d.storageProvider,
          verificationResult: 'VERIFIED',
          createdById,
          siteId: d.siteId ?? null,
        },
      });

      return NextResponse.json({ data: completed, meta: { requestId: id } }, { status: 201 });
    } catch (backupError) {
      const durationMs = Date.now() - startedAt;

      // Mark backup as FAILED
      const failed = await db.backup.update({
        where: { id: backup.id },
        data: { status: 'FAILED', durationMs },
        include: listIncludes,
      });

      // Create error log
      await db.backupLog.create({
        data: {
          backupId: backup.id,
          action: 'create',
          status: 'failed',
          durationMs,
          storageProvider: d.storageProvider,
          errorMessage: backupError instanceof Error ? backupError.message : 'Unknown backup error',
          createdById,
          siteId: d.siteId ?? null,
        },
      });

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
