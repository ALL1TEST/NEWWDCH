// ============================================================
// POST /api/backups/storage/[id]/test-connection — Test storage connection
// ============================================================

import { NextRequest, NextResponse } from 'next/server.js';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { requirePlatformAdmin, requireFeature } from '@/lib/platform/platform-auth';
import { getSiteWhereIncludeGlobal } from '@/lib/site-context';

function reqId() {
  return 'req_' + nanoid(8);
}

const MASK = '••••••••';

function validateConfigJson(configStr: string, provider: string, isTest = false): { valid: boolean; errors: string[] } {
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
      if (!isTest && !has('folderId')) errors.push('Google Drive config requires "folderId"');
      break;
    }
    case 'DROPBOX': {
      if (!has('appKey')) errors.push('Dropbox config requires "appKey"');
      if (!has('appSecret')) errors.push('Dropbox config requires "appSecret"');
      if (!has('refreshToken')) errors.push('Dropbox config requires "refreshToken"');
      if (!isTest && !has('folder')) errors.push('Dropbox config requires "folder"');
      break;
    }
    case 'ONEDRIVE': {
      if (!has('clientId')) errors.push('OneDrive config requires "clientId"');
      if (!has('clientSecret')) errors.push('OneDrive config requires "clientSecret"');
      if (!has('refreshToken')) errors.push('OneDrive config requires "refreshToken"');
      if (!isTest && !has('folder')) errors.push('OneDrive config requires "folder"');
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

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: storageId } = await context.params;

    // Check scope: platform or client
    const scopeParam = new URL(request.url).searchParams.get('scope');
    let bodyScope: unknown = undefined;
    try {
      const rawBody = await request.json();
      if (typeof rawBody === 'object' && rawBody !== null) {
        bodyScope = (rawBody as { scope?: unknown }).scope;
      }
    } catch {
      // No body or invalid JSON
    }

    const isPlatformScope = scopeParam === 'platform' || bodyScope === 'platform';

    if (isPlatformScope) {
      const auth = await requirePlatformAdmin(request);
      if ('response' in auth) return auth.response;
    } else {
      const featureAuth = await requireFeature(request, 'backups');
      if ('response' in featureAuth) return featureAuth.response;
    }

    // Verify storage destination exists
    const storage = await db.backupStorage.findUnique({ where: { id: storageId } });
    if (!storage) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Storage config not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Tenant / site isolation check for client requests
    if (!isPlatformScope) {
      const siteFilter = await getSiteWhereIncludeGlobal(request);
      if (Object.keys(siteFilter).length > 0) {
        const accessible = await db.backupStorage.findFirst({
          where: {
            id: storageId,
            ...siteFilter,
          },
        });
        if (!accessible) {
          return NextResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Storage config not found' }, meta: { requestId: id } },
            { status: 404 },
          );
        }
      }
    }

    // Validate the stored config structure
    const configValidation = validateConfigJson(storage.config, storage.provider, true);
    const now = new Date();

    if (!configValidation.valid) {
      const failedResult = {
        success: false,
        message: `Config validation failed: ${configValidation.errors.join('; ')}`,
        errors: configValidation.errors,
      };

      await db.backupStorage.update({
        where: { id: storageId },
        data: {
          lastTestAt: now,
          lastTestResult: JSON.stringify(failedResult),
          isActive: false,
        },
      });

      try {
        await db.backupLog.create({
          data: {
            backupId: null,
            action: 'storage_test',
            status: 'failed',
            storageProvider: storage.provider,
            verificationResult: 'FAILED',
            errorMessage: `Config validation failed: ${configValidation.errors.join('; ')}`,
            createdById: storage.createdById,
            siteId: storage.siteId,
          },
        });
      } catch (logErr) {
        console.warn(`[BACKUP_STORAGE:TEST] Failed to write log for ${storageId}:`, logErr);
      }

      return NextResponse.json({
        data: { ...failedResult, testedAt: now.toISOString() },
        meta: { requestId: id },
      });
    }

    // Parse stored config and run real connection test
    let storedConfig: Record<string, unknown> = {};
    try {
      storedConfig = JSON.parse(storage.config || '{}');
    } catch {
      storedConfig = {};
    }

    const { testStorageConnection } = await import('@/lib/backup/backup-service');
    const result = await testStorageConnection(storage.provider, storedConfig);

    // Update storage status and last test result
    await db.backupStorage.update({
      where: { id: storageId },
      data: {
        lastTestAt: now,
        lastTestResult: JSON.stringify(result),
        isActive: result.success,
      },
    });

    // Write audit log
    try {
      await db.backupLog.create({
        data: {
          backupId: null,
          action: 'storage_test',
          status: result.success ? 'success' : 'failed',
          storageProvider: storage.provider,
          verificationResult: result.success ? 'VERIFIED' : 'FAILED',
          errorMessage: result.success ? null : result.message,
          createdById: storage.createdById,
          siteId: storage.siteId,
        },
      });
    } catch (logErr) {
      console.warn(`[BACKUP_STORAGE:TEST] Failed to write log for ${storageId}:`, logErr);
    }

    return NextResponse.json({
      data: { ...result, testedAt: now.toISOString() },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[BACKUP_STORAGE:TEST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to test storage connection' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
