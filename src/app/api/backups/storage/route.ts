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
  provider: z.enum(['LOCAL', 'AMAZON_S3', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'FTP', 'SFTP']),
  config: z.string().default('{}'),
  isActive: z.boolean().default(true),
  siteId: z.string().optional(),
  createdById: z.string().min(1, 'Creator ID is required').optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'name', 'provider', 'isActive', 'lastTestAt']);

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
    case 'FTP':
    case 'SFTP': {
      if (!config.host) errors.push(`${provider} config requires "host"`);
      if (!config.port) errors.push(`${provider} config requires "port"`);
      if (!config.username) errors.push(`${provider} config requires "username"`);
      break;
    }
    case 'LOCAL': {
      // Local requires a path
      if (!config.path) errors.push('Local config requires "path"');
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
      where.OR = [
        { name: { contains: search } },
      ];
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
// POST — create
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

    const item = await db.backupStorage.create({
      data: {
        name: d.name,
        provider: d.provider,
        config: d.config,
        isActive: d.isActive,
        createdById,
        siteId: d.siteId ?? null,
      },
      include: listIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[BACKUP_STORAGE:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create storage config' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
