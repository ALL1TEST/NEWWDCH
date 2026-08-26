// ============================================================
// GET  /api/backups/storage      — List storage configs
// POST /api/backups/storage      — Create a storage config
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const listIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less').trim(),
  provider: z.enum(['LOCAL', 'AMAZON_S3', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'BACKBLAZE_B2', 'FTP', 'SFTP']),
  config: z.string().default('{}'),
  isActive: z.boolean().default(true),
  siteId: z.string().optional(),
  createdById: z.string().min(1, 'Creator ID is required').optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'name', 'provider', 'isActive', 'lastTestAt']);

// ---------- provider labels (for search matching) --------------------
// Maps the raw provider enum (stored in the DB, e.g. "AMAZON_S3") to the
// human-readable label shown in the UI (e.g. "Amazon S3"). Used by the
// search filter so that typing "amazon", "s3", "cloudflare r2", "drive",
// etc. matches storage destinations by their displayed provider — not
// just by the raw enum string or the destination name.

const PROVIDER_LABELS: Record<string, string> = {
  LOCAL: 'Local',
  AMAZON_S3: 'Amazon S3',
  GOOGLE_DRIVE: 'Google Drive',
  DROPBOX: 'Dropbox',
  ONEDRIVE: 'OneDrive',
  CLOUDFLARE_R2: 'Cloudflare R2',
  BACKBLAZE_B2: 'Backblaze B2',
  FTP: 'FTP',
  SFTP: 'SFTP',
};

// ---------- validation helpers for config JSON -----------------------

function validateConfigJson(configStr: string, provider: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(configStr);
  } catch {
    return { valid: false, errors: ['Config must be valid JSON'] };
  }

  switch (provider) {
    case 'AMAZON_S3': {
      if (!config.bucket) errors.push('S3 config requires "bucket"');
      if (!config.region) errors.push('S3 config requires "region"');
      if (!config.accessKeyId) errors.push('S3 config requires "accessKeyId"');
      if (!config.secretAccessKey) errors.push('S3 config requires "secretAccessKey"');
      break;
    }
    case 'GOOGLE_DRIVE': {
      if (!config.folderId) errors.push('Google Drive config requires "folderId"');
      if (!config.credentials) errors.push('Google Drive config requires "credentials"');
      break;
    }
    case 'DROPBOX': {
      if (!config.accessToken) errors.push('Dropbox config requires "accessToken"');
      break;
    }
    case 'ONEDRIVE': {
      if (!config.clientId) errors.push('OneDrive config requires "clientId"');
      if (!config.clientSecret) errors.push('OneDrive config requires "clientSecret"');
      break;
    }
    case 'CLOUDFLARE_R2': {
      if (!config.accountId) errors.push('Cloudflare R2 config requires "accountId"');
      if (!config.bucket) errors.push('Cloudflare R2 config requires "bucket"');
      if (!config.accessKeyId) errors.push('Cloudflare R2 config requires "accessKeyId"');
      if (!config.secretAccessKey) errors.push('Cloudflare R2 config requires "secretAccessKey"');
      break;
    }
    case 'BACKBLAZE_B2': {
      if (!config.bucket) errors.push('Backblaze B2 config requires "bucket"');
      if (!config.keyId) errors.push('Backblaze B2 config requires "keyId"');
      if (!config.applicationKey) errors.push('Backblaze B2 config requires "applicationKey"');
      break;
    }
    case 'FTP':
    case 'SFTP': {
      if (!config.host) errors.push(`${provider} config requires "host"`);
      if (!config.port) errors.push(`${provider} config requires "port"`);
      if (!config.username) errors.push(`${provider} config requires "username"`);
      break;
    }
    case 'LOCAL': {
      // Local path is optional — uses default backup directory if not specified
      break;
    }
  }

  return { valid: errors.length === 0, errors };
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
    const provider = sp.get('provider');
    const isActive = sp.get('isActive');
    const search = sp.get('search')?.trim();

    const where: Record<string, unknown> = { ...(await getSiteWhere(request)) };

    if (provider) where.provider = provider;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      // Search matches the destination Name OR the Provider. Provider
      // matching is label-aware: the user types what they SEE in the UI
      // (e.g. "amazon", "s3", "cloudflare r2", "dropbox", "drive"), so we
      // resolve the search term against both the raw enum ("AMAZON_S3")
      // and the human label ("Amazon S3") and OR it with a name contains.
      const lower = search.toLowerCase();
      const matchedProviders = Object.entries(PROVIDER_LABELS)
        .filter(
          ([enumKey, label]) =>
            enumKey.toLowerCase().includes(lower) ||
            label.toLowerCase().includes(lower),
        )
        .map(([enumKey]) => enumKey);

      const orClauses: Record<string, unknown>[] = [
        { name: { contains: search } },
      ];
      if (matchedProviders.length > 0) {
        orClauses.push({ provider: { in: matchedProviders } });
      }
      where.OR = orClauses;
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.backupStorage.findMany({
        where,
        include: listIncludes,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.backupStorage.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      meta: {
        requestId: id,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
    });
  } catch (error) {
    console.error(`[BACKUP_STORAGE:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch storage configs' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create OR test connection (action=test)
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

    // Validate config JSON structure based on provider
    const configValidation = validateConfigJson(d.config, d.provider);
    if (!configValidation.valid) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CONFIG',
            message: 'Storage config validation failed',
            details: configValidation.errors,
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    // ---- Test Connection action ----
    if ((body as Record<string, unknown>).action === 'test') {
      const { testStorageConnection } = await import('@/lib/backup/backup-service');
      let configObj: Record<string, unknown>;
      try {
        configObj = JSON.parse(d.config);
      } catch {
        configObj = {};
      }
      const result = await testStorageConnection(d.provider, configObj);
      return NextResponse.json({ data: result, meta: { requestId: id } });
    }

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

    // Check for duplicate name
    const nameExists = await db.backupStorage.findUnique({ where: { name: d.name } });
    if (nameExists) {
      return NextResponse.json(
        { error: { code: 'DUPLICATE_NAME', message: 'A storage config with this name already exists' }, meta: { requestId: id } },
        { status: 409 },
      );
    }

    // Encrypt sensitive config fields before storing
    let configObj: Record<string, unknown>;
    try {
      configObj = JSON.parse(d.config);
    } catch {
      configObj = {};
    }
    const { encryptConfigForStorage } = await import('@/lib/backup/providers');
    const encryptedConfig = await encryptConfigForStorage(configObj);

    const item = await db.backupStorage.create({
      data: {
        name: d.name,
        provider: d.provider,
        config: encryptedConfig,
        isActive: d.isActive,
        createdById,
        siteId: d.siteId ?? null,
      },
      include: listIncludes,
    });

    // Mask secrets in the response
    const { maskConfigSecrets } = await import('@/lib/backup/providers');
    let responseConfig: Record<string, unknown>;
    try {
      responseConfig = JSON.parse(item.config);
    } catch {
      responseConfig = {};
    }
    const maskedItem = { ...item, config: JSON.stringify(maskConfigSecrets(responseConfig)) };

    return NextResponse.json({ data: maskedItem, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[BACKUP_STORAGE:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create storage config' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
