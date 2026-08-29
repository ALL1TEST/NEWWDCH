// ============================================================
// GET  /api/backups/storage      — List storage configs
// POST /api/backups/storage      — Create a storage config
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';

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
  provider: z.enum([
    'LOCAL',
    'AMAZON_S3',
    'GOOGLE_CLOUD_STORAGE',
    'MICROSOFT_AZURE_BLOB',
    'CLOUDFLARE_R2',
    'WASABI',
    'BACKBLAZE_B2',
    'GOOGLE_DRIVE',
    'DROPBOX',
    'ONEDRIVE',
    'FTP',
  ]),
  config: z.string().default('{}'),
  isActive: z.boolean().default(true),
  siteId: z.string().optional(),
  createdById: z.string().min(1, 'Creator ID is required').optional(),
});

// ---------- allowed sort columns -------------------------------------

const SORTABLE = new Set(['createdAt', 'name', 'provider', 'isActive', 'lastTestAt']);

// ---------- provider labels (for search matching) --------------------
// Maps the raw provider enum (stored in the DB, e.g. "CLOUDFLARE_R2") to
// the human-readable label shown in the UI (e.g. "Cloudflare R2"). Used by
// the search filter so that typing "cloudflare r2", "dropbox", "drive",
// "ftp", "local" matches storage destinations by their displayed provider
// — not just by the raw enum string or the destination name.

// Human-readable labels for every supported provider. Used by the search
// filter so typing "s3", "wasabi", "drive", "ftp" matches destinations by
// their displayed provider — not just the raw enum or name.
const PROVIDER_LABELS: Record<string, string> = {
  LOCAL: 'Local',
  AMAZON_S3: 'Amazon S3',
  GOOGLE_CLOUD_STORAGE: 'Google Cloud Storage',
  MICROSOFT_AZURE_BLOB: 'Microsoft Azure Blob Storage',
  CLOUDFLARE_R2: 'Cloudflare R2',
  WASABI: 'Wasabi',
  BACKBLAZE_B2: 'Backblaze B2',
  GOOGLE_DRIVE: 'Google Drive',
  DROPBOX: 'Dropbox',
  ONEDRIVE: 'OneDrive',
  FTP: 'FTP',
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

  // The mask placeholder returned by the GET routes for secret fields.
  // On CREATE this value should never legitimately appear (the user must
  // supply a real secret). On PATCH the merge logic strips it before
  // validation, so it should not reach here either.
  const MASK = '••••••••';

  const has = (k: string) => {
    const v = config[k];
    return v !== undefined && v !== null && v !== '' && v !== MASK;
  };

  switch (provider) {
    case 'LOCAL': {
      // Local path is optional — uses default backup directory if not specified
      break;
    }
    case 'AMAZON_S3': {
      if (!has('accessKeyId')) errors.push('Amazon S3 config requires "accessKeyId"');
      if (!has('secretAccessKey')) errors.push('Amazon S3 config requires "secretAccessKey"');
      if (!has('bucket')) errors.push('Amazon S3 config requires "bucket"');
      if (!has('region')) errors.push('Amazon S3 config requires "region"');
      // endpoint is optional
      break;
    }
    case 'GOOGLE_CLOUD_STORAGE': {
      if (!has('projectId')) errors.push('Google Cloud Storage config requires "projectId"');
      if (!has('serviceAccountEmail')) errors.push('Google Cloud Storage config requires "serviceAccountEmail"');
      if (!has('privateKey')) errors.push('Google Cloud Storage config requires "privateKey"');
      if (!has('bucket')) errors.push('Google Cloud Storage config requires "bucket"');
      // folder optional
      break;
    }
    case 'MICROSOFT_AZURE_BLOB': {
      if (!has('storageAccount')) errors.push('Azure Blob Storage config requires "storageAccount"');
      if (!has('accessKey')) errors.push('Azure Blob Storage config requires "accessKey"');
      if (!has('container')) errors.push('Azure Blob Storage config requires "container"');
      // endpoint optional (derived from storageAccount if omitted)
      break;
    }
    case 'CLOUDFLARE_R2': {
      if (!has('accountId')) errors.push('Cloudflare R2 config requires "accountId"');
      if (!has('accessKeyId')) errors.push('Cloudflare R2 config requires "accessKeyId"');
      if (!has('secretAccessKey')) errors.push('Cloudflare R2 config requires "secretAccessKey"');
      if (!has('bucket')) errors.push('Cloudflare R2 config requires "bucket"');
      // endpoint optional (derived from accountId if omitted); region
      // defaults to "auto" and is not surfaced in the form.
      break;
    }
    case 'WASABI': {
      if (!has('accessKeyId')) errors.push('Wasabi config requires "accessKeyId"');
      if (!has('secretAccessKey')) errors.push('Wasabi config requires "secretAccessKey"');
      if (!has('bucket')) errors.push('Wasabi config requires "bucket"');
      if (!has('region')) errors.push('Wasabi config requires "region"');
      // endpoint optional (derived from region)
      break;
    }
    case 'BACKBLAZE_B2': {
      if (!has('keyId')) errors.push('Backblaze B2 config requires "keyId"');
      if (!has('applicationKey')) errors.push('Backblaze B2 config requires "applicationKey"');
      if (!has('bucket')) errors.push('Backblaze B2 config requires "bucket"');
      // endpoint optional (account-specific; recommended)
      break;
    }
    case 'GOOGLE_DRIVE': {
      if (!has('clientId')) errors.push('Google Drive config requires "clientId"');
      if (!has('clientSecret')) errors.push('Google Drive config requires "clientSecret"');
      if (!has('refreshToken')) errors.push('Google Drive config requires "refreshToken"');
      if (!has('folderId')) errors.push('Google Drive config requires "folderId"');
      break;
    }
    case 'DROPBOX': {
      if (!has('appKey')) errors.push('Dropbox config requires "appKey"');
      if (!has('appSecret')) errors.push('Dropbox config requires "appSecret"');
      if (!has('refreshToken')) errors.push('Dropbox config requires "refreshToken"');
      if (!has('folder')) errors.push('Dropbox config requires "folder"');
      break;
    }
    case 'ONEDRIVE': {
      if (!has('clientId')) errors.push('OneDrive config requires "clientId"');
      if (!has('clientSecret')) errors.push('OneDrive config requires "clientSecret"');
      if (!has('refreshToken')) errors.push('OneDrive config requires "refreshToken"');
      if (!has('folder')) errors.push('OneDrive config requires "folder"');
      break;
    }
    case 'FTP': {
      if (!has('host')) errors.push('FTP config requires "host"');
      if (!has('username')) errors.push('FTP config requires "username"');
      if (!has('password')) errors.push('FTP config requires "password"');
      // port, remoteDirectory, secure are optional
      break;
    }
    default: {
      errors.push(`Unsupported provider: ${provider}`);
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
    const scope = sp.get('scope');

    // -------- scope=platform: platform-admin-only view of ALL storage
    // destinations across all sites (no site filter). Falls through to
    // the default client behavior (site-scoped via getSiteWhere) when
    // the param is absent so existing callers keep working as before.
    let siteFilter: Record<string, unknown> = {};
    if (scope === 'platform') {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      // Platform scope: no site filter — return ALL storage across all sites.
      siteFilter = {};
    } else {
      siteFilter = await getSiteWhere(request);
    }

    const where: Record<string, unknown> = { ...siteFilter };

    if (provider) where.provider = provider;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      // Search matches the destination Name OR the Provider. Provider
      // matching is label-aware: the user types what they SEE in the UI
      // (e.g. "cloudflare r2", "dropbox", "drive", "ftp", "local"), so we
      // resolve the search term against both the raw enum (e.g. "FTP")
      // and the human label (e.g. "Cloudflare R2") and OR it with a name
      // contains.
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

    // Mask secrets in every item's config before returning. Secrets are
    // stored encrypted at rest; here we decrypt + mask so the response
    // never exposes real credential values. The Storage table only renders
    // Name/Provider/Status/LastTest columns (never the config), but the
    // edit form reads `row.config` — returning masked values lets the form
    // display "••••••••" placeholders and the PATCH merge logic detect
    // unchanged secrets by matching the mask.
    const { decryptConfigFields, maskConfigSecrets } = await import('@/lib/backup/providers');
    const maskedItems = await Promise.all(
      items.map(async (it) => {
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(it.config || '{}'); } catch { parsed = {}; }
        const decrypted = await decryptConfigFields(parsed);
        return { ...it, config: JSON.stringify(maskConfigSecrets(decrypted)) };
      }),
    );

    return NextResponse.json({
      data: maskedItems,
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

    // -------- scope=platform: platform admin can create / test platform-
    // wide storage destinations (siteId = null, createdById =
    // authenticated admin). When scope is absent, behave EXACTLY as
    // before — client-side storage picks up siteId from the query
    // string / context. The peek happens BEFORE zod so the createSchema
    // never sees the `scope` field.
    const isPlatformScope =
      typeof body === 'object' && body !== null && (body as { scope?: unknown }).scope === 'platform';

    let platformUser: { id: string } | null = null;
    let preparedBody: unknown = body;
    if (isPlatformScope) {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
      platformUser = { id: auth.user.id };

      // Strip the scope marker so it does not interfere with downstream
      // parsing. The test-connection branch and the create branch both
      // receive the rewritten body.
      const rawBody = (body as Record<string, unknown>) ?? {};
      const { scope: _omit, ...rest } = rawBody;
      void _omit;
      preparedBody = rest;
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
    // The modal's Test Connection / Connect button POSTs to this route
    // with `?action=test` in the query string (the body carries the
    // candidate config). Detect the action from the URL search params —
    // NOT the body — so a test never accidentally creates a storage row.
    // The test runs the real provider adapter against the (unpersisted)
    // form config; no row is written.
    const urlAction = new URL(request.url).searchParams.get('action');
    if (urlAction === 'test' || (body as Record<string, unknown>).action === 'test') {
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

    // Resolve createdById — for platform scope, use the authenticated
    // admin's id (override client-supplied). For client scope, fall back
    // to first user if not provided (existing behavior preserved).
    let createdById: string | undefined;
    if (isPlatformScope && platformUser) {
      createdById = platformUser.id;
    } else {
      createdById = d.createdById;
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

    // Platform scope: force siteId = null (platform-wide). Client scope:
    // leave siteId exactly as the caller provided (or null) — existing
    // behavior preserved.
    const siteId = isPlatformScope ? null : (d.siteId ?? null);

    const item = await db.backupStorage.create({
      data: {
        name: d.name,
        provider: d.provider,
        config: encryptedConfig,
        isActive: d.isActive,
        createdById,
        siteId,
      },
      include: listIncludes,
    });

    // Write a BackupLog entry for the storage destination creation so
    // the audit trail reflects every configured destination.
    try {
      await db.backupLog.create({
        data: {
          backupId: null,
          action: 'storage_create',
          status: 'success',
          storageProvider: d.provider,
          warnings: `Storage destination "${d.name}" created`,
          createdById,
          siteId,
        },
      });
    } catch (logErr) {
      console.warn(`[BACKUP_STORAGE:CREATE] Failed to write log:`, logErr);
    }

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
