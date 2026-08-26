// ============================================================
// GET    /api/backups/storage/[id]              — Get single storage
// PATCH  /api/backups/storage/[id]              — Update storage
// DELETE /api/backups/storage/[id]              — Delete storage
// POST   /api/backups/storage/[id]/test-connection — Test connection
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const fullIncludes = {
  createdBy: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
} as const;

type RouteContext = { params: Promise<{ id: string }> };

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
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
  ]).optional(),
  config: z.string().optional(),
  isActive: z.boolean().optional(),
});

// The mask placeholder used by the GET routes for secret fields. When the
// PATCH receives a config containing this value for a secret field, it is
// stripped by the merge logic (the old stored/encrypted value is kept).
const MASK = '••••••••';

// ---------- config validation ----------------------------------------

function validateConfigJson(configStr: string, provider: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(configStr);
  } catch {
    return { valid: false, errors: ['Config must be valid JSON'] };
  }

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
      break;
    }
    case 'GOOGLE_CLOUD_STORAGE': {
      if (!has('projectId')) errors.push('Google Cloud Storage config requires "projectId"');
      if (!has('serviceAccountEmail')) errors.push('Google Cloud Storage config requires "serviceAccountEmail"');
      if (!has('privateKey')) errors.push('Google Cloud Storage config requires "privateKey"');
      if (!has('bucket')) errors.push('Google Cloud Storage config requires "bucket"');
      break;
    }
    case 'MICROSOFT_AZURE_BLOB': {
      if (!has('storageAccount')) errors.push('Azure Blob Storage config requires "storageAccount"');
      if (!has('accessKey')) errors.push('Azure Blob Storage config requires "accessKey"');
      if (!has('container')) errors.push('Azure Blob Storage config requires "container"');
      break;
    }
    case 'CLOUDFLARE_R2': {
      if (!has('accountId')) errors.push('Cloudflare R2 config requires "accountId"');
      if (!has('accessKeyId')) errors.push('Cloudflare R2 config requires "accessKeyId"');
      if (!has('secretAccessKey')) errors.push('Cloudflare R2 config requires "secretAccessKey"');
      if (!has('bucket')) errors.push('Cloudflare R2 config requires "bucket"');
      break;
    }
    case 'WASABI': {
      if (!has('accessKeyId')) errors.push('Wasabi config requires "accessKeyId"');
      if (!has('secretAccessKey')) errors.push('Wasabi config requires "secretAccessKey"');
      if (!has('bucket')) errors.push('Wasabi config requires "bucket"');
      if (!has('region')) errors.push('Wasabi config requires "region"');
      break;
    }
    case 'BACKBLAZE_B2': {
      if (!has('keyId')) errors.push('Backblaze B2 config requires "keyId"');
      if (!has('applicationKey')) errors.push('Backblaze B2 config requires "applicationKey"');
      if (!has('bucket')) errors.push('Backblaze B2 config requires "bucket"');
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
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: storageId } = await context.params;

    const item = await db.backupStorage.findUnique({
      where: { id: storageId },
      include: fullIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Storage config not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Mask secrets before returning (same as the list route). Secrets are
    // stored encrypted; decrypt + mask so the response never exposes real
    // credential values.
    const { decryptConfigFields, maskConfigSecrets } = await import('@/lib/backup/providers');
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(item.config || '{}'); } catch { parsed = {}; }
    const decrypted = await decryptConfigFields(parsed);
    const maskedItem = { ...item, config: JSON.stringify(maskConfigSecrets(decrypted)) };

    return NextResponse.json({ data: maskedItem, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUP_STORAGE:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch storage config' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// PATCH — update
// =====================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: storageId } = await context.params;

    const existing = await db.backupStorage.findUnique({ where: { id: storageId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Storage config not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const parsed = updateSchema.safeParse(body);
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
    const updateData: Record<string, unknown> = {};

    if (d.name !== undefined) {
      // Check for duplicate name if changing
      if (d.name !== existing.name) {
        const nameExists = await db.backupStorage.findUnique({ where: { name: d.name } });
        if (nameExists) {
          return NextResponse.json(
            { error: { code: 'DUPLICATE_NAME', message: 'A storage config with this name already exists' }, meta: { requestId: id } },
            { status: 409 },
          );
        }
      }
      updateData.name = d.name;
    }
    if (d.provider !== undefined) updateData.provider = d.provider;
    if (d.config !== undefined) {
      const provider = d.provider ?? existing.provider;
      // Merge the incoming config into the stored one. The incoming config
      // may contain mask placeholders ('••••••••') for secret fields the
      // user did NOT re-enter (the GET routes return secrets masked, and
      // the edit form passes them through unchanged). To avoid wiping or
      // double-encrypting those secrets, we decrypt the old config, overlay
      // only the genuinely-changed (non-mask, non-empty) new values, then
      // re-encrypt the merged result. This preserves unchanged secrets
      // exactly while letting the user update individual fields.
      const { decryptConfigFields, encryptConfigForStorage } = await import('@/lib/backup/providers');
      let oldConfig: Record<string, unknown> = {};
      try { oldConfig = JSON.parse(existing.config || '{}'); } catch { oldConfig = {}; }
      const decryptedOld = await decryptConfigFields(oldConfig);
      let newConfig: Record<string, unknown> = {};
      try { newConfig = JSON.parse(d.config); } catch { newConfig = {}; }
      const merged: Record<string, unknown> = { ...decryptedOld };
      for (const [k, v] of Object.entries(newConfig)) {
        if (typeof v === 'string' && (v === MASK || v.trim() === '')) {
          // Unchanged or cleared — keep the old decrypted value.
          continue;
        }
        merged[k] = v;
      }
      const mergedStr = JSON.stringify(merged);
      const configValidation = validateConfigJson(mergedStr, provider);
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
      updateData.config = await encryptConfigForStorage(merged);
    }
    if (d.isActive !== undefined) updateData.isActive = d.isActive;

    const updated = await db.backupStorage.update({
      where: { id: storageId },
      data: updateData,
      include: fullIncludes,
    });

    // Mask secrets in the response (decrypt + mask).
    const { decryptConfigFields: dcf2, maskConfigSecrets: mcs2 } = await import('@/lib/backup/providers');
    let parsedUp: Record<string, unknown> = {};
    try { parsedUp = JSON.parse(updated.config || '{}'); } catch { parsedUp = {}; }
    const decryptedUp = await dcf2(parsedUp);
    const maskedUpdated = { ...updated, config: JSON.stringify(mcs2(decryptedUp)) };

    return NextResponse.json({ data: maskedUpdated, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUP_STORAGE:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update storage config' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// DELETE — delete
// =====================================================================

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: storageId } = await context.params;

    const existing = await db.backupStorage.findUnique({ where: { id: storageId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Storage config not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await db.backupStorage.delete({ where: { id: storageId } });

    return NextResponse.json({ data: { id: storageId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUP_STORAGE:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete storage config' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — test connection
// =====================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  const id = reqId();

  // `request` is currently unused — the test runs against the persisted
  // config. Keeping the signature so the route handler shape stays stable.
  void request;

  try {
    const { id: storageId } = await context.params;

    const storage = await db.backupStorage.findUnique({ where: { id: storageId } });
    if (!storage) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Storage config not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Validate the stored config structure for the provider. The stored
    // config is encrypted; validateConfigJson reads it as-is (encrypted
    // strings are non-empty, so presence checks still pass; the mask check
    // only applies to values coming FROM the client, not the stored ones).
    const configValidation = validateConfigJson(storage.config, storage.provider);

    const now = new Date();

    if (!configValidation.valid) {
      const failedResult = { success: false, message: 'Config validation failed', errors: configValidation.errors };
      await db.backupStorage.update({
        where: { id: storageId },
        data: {
          lastTestAt: now,
          lastTestResult: JSON.stringify(failedResult),
          // A failed validation means the storage is not usable — reflect
          // that in the Status column (isActive = connection state).
          isActive: false,
        },
      });

      return NextResponse.json({
        data: { ...failedResult, testedAt: now.toISOString() },
        meta: { requestId: id },
      });
    }

    // Parse the stored (encrypted) config to hand to the provider adapter.
    // createStorageProvider decrypts internally before constructing the
    // adapter, so we pass the encrypted values straight through. Every
    // supported provider has a REAL adapter that performs an actual
    // round-trip — no structural-only "connected" shortcut.
    let storedConfig: Record<string, unknown> = {};
    try { storedConfig = JSON.parse(storage.config || '{}'); } catch { storedConfig = {}; }

    const { testStorageConnection } = await import('@/lib/backup/backup-service');
    const result = await testStorageConnection(storage.provider, storedConfig);

    await db.backupStorage.update({
      where: { id: storageId },
      data: {
        lastTestAt: now,
        lastTestResult: JSON.stringify(result),
        // The Status column reflects the actual connection state — a passed
        // test marks the storage Active; a failed test marks it Inactive.
        isActive: result.success,
      },
    });

    return NextResponse.json({ data: { ...result, testedAt: now.toISOString() }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[BACKUP_STORAGE:TEST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to test storage connection' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
