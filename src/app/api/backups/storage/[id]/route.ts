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
  provider: z.enum(['LOCAL', 'AMAZON_S3', 'GOOGLE_DRIVE', 'DROPBOX', 'ONEDRIVE', 'CLOUDFLARE_R2', 'FTP', 'SFTP']).optional(),
  config: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ---------- config validation ----------------------------------------

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
      if (!config.path) errors.push('Local config requires "path"');
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

    return NextResponse.json({ data: item, meta: { requestId: id } });
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
      const configValidation = validateConfigJson(d.config, provider);
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
      updateData.config = d.config;
    }
    if (d.isActive !== undefined) updateData.isActive = d.isActive;

    const updated = await db.backupStorage.update({
      where: { id: storageId },
      data: updateData,
      include: fullIncludes,
    });

    return NextResponse.json({ data: updated, meta: { requestId: id } });
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

  try {
    const { id: storageId } = await context.params;

    const storage = await db.backupStorage.findUnique({ where: { id: storageId } });
    if (!storage) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Storage config not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Validate config JSON structure
    const configValidation = validateConfigJson(storage.config, storage.provider);

    const now = new Date();

    if (!configValidation.valid) {
      // Update with failed test result
      await db.backupStorage.update({
        where: { id: storageId },
        data: {
          lastTestAt: now,
          lastTestResult: JSON.stringify({ success: false, errors: configValidation.errors }),
        },
      });

      return NextResponse.json({
        data: {
          success: false,
          message: 'Config validation failed',
          errors: configValidation.errors,
          testedAt: now.toISOString(),
        },
        meta: { requestId: id },
      });
    }

    // For LOCAL provider, verify the path exists and is writable
    if (storage.provider === 'LOCAL') {
      try {
        const config = JSON.parse(storage.config);
        const fs = await import('node:fs/promises');
        const { existsSync } = await import('node:fs');
        const targetPath = config.path as string;

        if (!existsSync(targetPath)) {
          await fs.mkdir(targetPath, { recursive: true });
        }

        // Test write by creating a temp file
        const testFile = targetPath + '/.backup-test-' + Date.now();
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);

        const result = { success: true, message: 'Local storage path is accessible and writable' };
        await db.backupStorage.update({
          where: { id: storageId },
          data: {
            lastTestAt: now,
            lastTestResult: JSON.stringify(result),
          },
        });

        return NextResponse.json({ data: { ...result, testedAt: now.toISOString() }, meta: { requestId: id } });
      } catch (fsError) {
        const result = {
          success: false,
          message: 'Failed to access local storage path',
          errors: [fsError instanceof Error ? fsError.message : 'Unknown error'],
        };
        await db.backupStorage.update({
          where: { id: storageId },
          data: {
            lastTestAt: now,
            lastTestResult: JSON.stringify(result),
          },
        });

        return NextResponse.json({ data: { ...result, testedAt: now.toISOString() }, meta: { requestId: id } });
      }
    }

    // For remote providers, validate config structure only (no real connection test in sandbox)
    const result = {
      success: true,
      message: `Config validation passed for ${storage.provider}. Note: Actual connection test requires network access to the remote provider.`,
    };
    await db.backupStorage.update({
      where: { id: storageId },
      data: {
        lastTestAt: now,
        lastTestResult: JSON.stringify(result),
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
