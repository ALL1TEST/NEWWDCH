// ============================================================
// GET  /api/backups      — List backups with filters & pagination
// POST /api/backups      — Create a real SQLite backup
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';
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
  storageProvider: z.enum(['LOCAL', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'FTP']).default('LOCAL'),
  storageId: z.string().optional(), // ID of a configured BackupStorage destination
  encryptionEnabled: z.boolean().optional(),
  verifyAfterUpload: z.boolean().optional(),
  createdById: z.string().min(1, 'Creator ID is required').optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'filename', 'type', 'status', 'size', 'scope', 'completedAt', 'durationMs']);

// ---------- enum value sets (for `in`-based search) ------------------
// Prisma forbids `contains` on enum columns, so enum-field search works by
// computing the subset of enum values that include the query string.

const BACKUP_SCOPE_VALUES = ['FULL', 'DATABASE_ONLY', 'MEDIA_ONLY', 'FILES_ONLY', 'SETTINGS_ONLY'] as const;
const BACKUP_TYPE_VALUES = ['AUTOMATED', 'MANUAL'] as const;
const BACKUP_STORAGE_PROVIDER_VALUES = ['LOCAL', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'FTP'] as const;
const BACKUP_STATUS_VALUES = ['CREATING', 'COMPLETED', 'FAILED', 'RESTORING', 'RESTORED', 'VERIFYING', 'VERIFIED', 'DELETING'] as const;
const BACKUP_ENCRYPTION_VALUES = ['NONE', 'ENCRYPTED', 'DECRYPTED'] as const;

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

    // -------- scope=platform: platform-admin-only view of ALL backups
    // across all sites (no site filter). Falls through to the default
    // client behavior (site-scoped via getSiteWhere) when the param is
    // absent so existing callers keep working as before. Note: 'platform'
    // is NOT a valid BackupScope enum value, so it must be intercepted
    // here BEFORE the `where.scope = scope` filter line below.
    let siteFilter: Record<string, unknown> = {};
    if (scope === 'platform') {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      // Platform scope: no site filter — return ALL backups across all sites.
      siteFilter = {};
    } else {
      siteFilter = await getSiteWhere(request);
    }

    const where: Record<string, unknown> = { ...siteFilter };

    if (status) where.status = status;
    if (type) where.type = type;
    if (scope && scope !== 'platform') where.scope = scope;
    if (provider) where.storageProvider = provider;
    if (search) {
      // Search across text fields (name, filename, note) AND enum-ish fields
      // (scope, type, storageProvider, status, encryptionStatus).
      //
      // Prisma does NOT support `contains` on enum columns, so for enum
      // fields we compute the subset of enum values whose string form
      // includes the (upper-cased, space→underscore) query and match with `in`.
      // This lets "manual" → "MANUAL", "database only" → "DATABASE_ONLY",
      // "r2" → "CLOUDFLARE_R2", "completed" → "COMPLETED".
      //
      // SQLite's Prisma `contains` uses LIKE, which is ASCII case-insensitive
      // by default, so "manual" matches "Manual Pre-Release Snapshot" too.
      const enumQuery = search.toUpperCase().replace(/\s+/g, '_');
      const matchEnum = <T extends string>(values: readonly T[]) =>
        values.filter((v) => v.includes(enumQuery));

      const orClauses: Record<string, unknown>[] = [
        { name: { contains: search } },
        { filename: { contains: search } },
        { note: { contains: search } },
      ];

      const matchingScopes = matchEnum(BACKUP_SCOPE_VALUES);
      if (matchingScopes.length) orClauses.push({ scope: { in: matchingScopes } });
      const matchingTypes = matchEnum(BACKUP_TYPE_VALUES);
      if (matchingTypes.length) orClauses.push({ type: { in: matchingTypes } });
      const matchingProviders = matchEnum(BACKUP_STORAGE_PROVIDER_VALUES);
      if (matchingProviders.length) orClauses.push({ storageProvider: { in: matchingProviders } });
      const matchingStatuses = matchEnum(BACKUP_STATUS_VALUES);
      if (matchingStatuses.length) orClauses.push({ status: { in: matchingStatuses } });
      const matchingEncryption = matchEnum(BACKUP_ENCRYPTION_VALUES);
      if (matchingEncryption.length) orClauses.push({ encryptionStatus: { in: matchingEncryption } });

      where.OR = orClauses;
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

    // -------- scope=platform: platform admin can create platform-wide
    // backups (siteId = null, createdById = authenticated admin). When
    // scope is absent, behave EXACTLY as before — client-side backups
    // pick up siteId from the query string / context. Note: 'platform'
    // is NOT a valid BackupScope enum value (the zod schema below will
    // reject it), so we peek at the raw body BEFORE zod validation and
    // rewrite the scope field to the actual BackupScope (default FULL).
    // The platform dialog sends `scope: 'platform'` as a marker AND
    // `backupScope: <BackupScope>` for the real data-scope choice.
    const isPlatformScope =
      typeof body === 'object' && body !== null && (body as { scope?: unknown }).scope === 'platform';

    let platformUser: { id: string } | null = null;
    let preparedBody: unknown = body;
    if (isPlatformScope) {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      platformUser = { id: auth.user.id };

      // Rewrite the body so zod sees a valid BackupScope. Default to
      // FULL when the platform dialog did not supply a `backupScope`.
      const rawBody = (body as Record<string, unknown>) ?? {};
      const backupScope = rawBody.backupScope;
      const validBackupScopes = ['FULL', 'DATABASE_ONLY', 'MEDIA_ONLY', 'FILES_ONLY', 'SETTINGS_ONLY'];
      const resolvedScope =
        typeof backupScope === 'string' && validBackupScopes.includes(backupScope) ? backupScope : 'FULL';
      const { ...rest } = rawBody;
      delete rest.scope;
      delete rest.backupScope;
      preparedBody = { ...rest, scope: resolvedScope };
    }

    const parsed = createSchema.safeParse(preparedBody);
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

    // Platform scope: force siteId = null (platform-wide) and use the
    // authenticated admin's id as createdById. Client scope: leave
    // siteId/createdById exactly as the caller provided — existing
    // behavior preserved.
    const siteId = isPlatformScope ? null : d.siteId;
    const createdById = isPlatformScope && platformUser ? platformUser.id : d.createdById;

    // Use the backup service's startBackup() — a fire-and-forget entry
    // point that creates the CREATING record synchronously (fast, the
    // admin UI does not freeze) and schedules the long-running
    // archive → encrypt → upload → verify operation in the background.
    // The operation transitions the record to COMPLETED or FAILED on
    // completion; the client's TanStack Query invalidation + 10s
    // staleTime ensures the UI picks up the new status without manual
    // refresh.
    try {
      const { startBackup } = await import('@/lib/backup/backup-service');
      const backup = await startBackup({
        name: d.name,
        scope: d.scope,
        type: d.type,
        note: d.note || d.description,
        storageId: d.storageId,
        storageProvider: d.storageProvider,
        encryptionEnabled: d.encryptionEnabled,
        verifyAfterUpload: d.verifyAfterUpload ?? true,
        createdById,
        siteId,
        scheduleId: d.scheduleId,
      });

      // Fetch with includes for the response — the record is CREATING
      // at this point (the operation is still running in the background).
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
