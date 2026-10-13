// ============================================================
// Regression Tests: Backup Storage Persistence & Scoping Suite
// Covers:
// 1. Successful creation and database persistence in db.backupStorage
// 2. Encryption of credentials at rest (clientSecret & refreshToken encrypted in DB)
// 3. Response secrecy masking (no plaintext secrets returned in API response)
// 4. Query visibility across site scope and global scope (getSiteWhereIncludeGlobal)
// 5. Tenant isolation (siteA does not see siteB-exclusive destinations)
// 6. Request query siteId fallback when body omits siteId
// 7. Validation error handling (missing folderId or invalid JSON returns 400 without DB insertion)
// 8. Duplicate name collision prevention (returns 409 DUPLICATE_NAME)
// ============================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { db } from '../src/lib/db.ts';
import { GET, POST } from '../src/app/api/backups/storage/route.ts';
import { PATCH, GET as GET_SINGLE } from '../src/app/api/backups/storage/[id]/route.ts';
import { POST as POST_TEST_CONN } from '../src/app/api/backups/storage/[id]/test-connection/route.ts';
import { decryptConfigFields } from '../src/lib/backup/providers/index.ts';

describe('Backup Storage Persistence & Scoping Regression Suite', () => {
  let testUser: { id: string };
  let testSessionToken: string;
  let testSiteA: { id: string };
  let testSiteB: { id: string };

  const createdStorageIds: string[] = [];

  before(async () => {
    // Ensure an owner user exists so requireFeature and scoping pass cleanly
    let user = await db.user.findFirst({ where: { role: 'OWNER' }, select: { id: true } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: `test-backup-owner-${Date.now()}@example.com`,
          name: 'Test Backup Owner',
          role: 'OWNER',
          billingMode: 'EXEMPT',
        },
        select: { id: true },
      });
    }
    testUser = user;

    // Create a valid session token for authentication
    testSessionToken = `session_token_${Date.now()}`;
    await db.session.create({
      data: {
        token: testSessionToken,
        userId: testUser.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Ensure two test sites exist for scoping verification
    let siteA = await db.site.findFirst({ where: { slug: 'site-a-test' } });
    if (!siteA) {
      siteA = await db.site.create({
        data: {
          name: 'Test Site A',
          slug: 'site-a-test',
          ownerId: testUser.id,
          status: 'ACTIVE',
        },
      });
    }
    testSiteA = siteA;

    let siteB = await db.site.findFirst({ where: { slug: 'site-b-test' } });
    if (!siteB) {
      siteB = await db.site.create({
        data: {
          name: 'Test Site B',
          slug: 'site-b-test',
          ownerId: testUser.id,
          status: 'ACTIVE',
        },
      });
    }
    testSiteB = siteB;
  });

  after(async () => {
    // Clean up created test storage rows, session, and logs
    if (createdStorageIds.length > 0) {
      await db.backupLog.deleteMany({
        where: { warnings: { contains: 'Storage destination' } },
      });
      await db.backupStorage.deleteMany({
        where: { id: { in: createdStorageIds } },
      });
    }
    if (testSessionToken) {
      await db.session.deleteMany({
        where: { token: testSessionToken },
      });
    }
  });

  function authHeaders(extraHeaders: Record<string, string> = {}) {
    return {
      cookie: `cms_session_token=${testSessionToken}`,
      ...extraHeaders,
    };
  }

  // -------------------------------------------------------------------------
  // 1. Successful creation with Google Drive and DB persistence
  // -------------------------------------------------------------------------
  it('1. Successfully creates Google Drive storage, persists to database, and encrypts secrets', async () => {
    const uniqueName = `Google Drive Backup - ${Date.now()}`;
    const rawConfig = {
      clientId: '123456789-test.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-superSecretKey123',
      refreshToken: '1//04testRefreshTokenABC',
      folderId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
    };

    const req = new NextRequest('http://localhost:3000/api/backups/storage', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        name: uniqueName,
        provider: 'GOOGLE_DRIVE',
        config: JSON.stringify(rawConfig),
        isActive: true,
        siteId: testSiteA.id,
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 201);

    const json = await res.json();
    assert.ok(json.data);
    assert.strictEqual(json.data.name, uniqueName);
    assert.strictEqual(json.data.provider, 'GOOGLE_DRIVE');
    assert.strictEqual(json.data.siteId, testSiteA.id);

    const createdId = json.data.id;
    createdStorageIds.push(createdId);

    // Verify secrets are masked in API response
    const parsedResponseConfig = JSON.parse(json.data.config);
    assert.strictEqual(parsedResponseConfig.clientSecret, '••••••••');
    assert.strictEqual(parsedResponseConfig.refreshToken, '••••••••');
    assert.strictEqual(parsedResponseConfig.clientId, rawConfig.clientId);
    assert.strictEqual(parsedResponseConfig.folderId, rawConfig.folderId);

    // Verify database row actually exists and is persisted
    const dbRow = await db.backupStorage.findUnique({
      where: { id: createdId },
    });
    assert.ok(dbRow, 'Storage destination must be persisted in db.backupStorage');
    assert.strictEqual(dbRow.name, uniqueName);
    assert.strictEqual(dbRow.siteId, testSiteA.id);

    // Verify stored config in DB is encrypted (not plaintext)
    const storedConfig = JSON.parse(dbRow.config);
    assert.notStrictEqual(storedConfig.clientSecret, rawConfig.clientSecret);
    assert.notStrictEqual(storedConfig.refreshToken, rawConfig.refreshToken);

    // Verify decryption recovers original credentials
    const decrypted = await decryptConfigFields(storedConfig);
    assert.strictEqual(decrypted.clientSecret, rawConfig.clientSecret);
    assert.strictEqual(decrypted.refreshToken, rawConfig.refreshToken);
  });

  // -------------------------------------------------------------------------
  // 2. Query list visibility for site-scoped destination
  // -------------------------------------------------------------------------
  it('2. Storage list query retrieves the created site-scoped destination immediately', async () => {
    const listReq = new NextRequest(`http://localhost:3000/api/backups/storage?siteId=${testSiteA.id}`, {
      headers: authHeaders(),
    });
    const listRes = await GET(listReq);
    assert.strictEqual(listRes.status, 200);

    const json = await listRes.json();
    assert.ok(Array.isArray(json.data));
    const found = json.data.find((item: any) => createdStorageIds.includes(item.id));
    assert.ok(found, 'Created site-scoped destination must be visible when querying with siteId');
    assert.strictEqual(found.siteId, testSiteA.id);
  });

  // -------------------------------------------------------------------------
  // 3. Global storage destination persistence and visibility (siteId: null)
  // -------------------------------------------------------------------------
  it('3. Successfully persists global storage destination (null siteId) and retrieves it under site context', async () => {
    const globalName = `Global S3 Backup - ${Date.now()}`;
    const rawConfig = {
      accessKeyId: 'AKIA_TEST_ACCESS_KEY',
      secretAccessKey: 'testSecretAccessKey123456789',
      bucket: 'my-global-backups',
      region: 'us-east-1',
    };

    const req = new NextRequest('http://localhost:3000/api/backups/storage', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        name: globalName,
        provider: 'AMAZON_S3',
        config: JSON.stringify(rawConfig),
        isActive: true,
        siteId: null,
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 201);

    const json = await res.json();
    const globalId = json.data.id;
    createdStorageIds.push(globalId);

    // Verify row in DB has siteId null
    const dbRow = await db.backupStorage.findUnique({ where: { id: globalId } });
    assert.ok(dbRow);
    assert.strictEqual(dbRow.siteId, null);

    // Verify GET /api/backups/storage?siteId=... retrieves global storage (getSiteWhereIncludeGlobal)
    const listReq = new NextRequest(`http://localhost:3000/api/backups/storage?siteId=${testSiteA.id}`, {
      headers: authHeaders(),
    });
    const listRes = await GET(listReq);
    assert.strictEqual(listRes.status, 200);

    const listJson = await listRes.json();
    const foundGlobal = listJson.data.find((item: any) => item.id === globalId);
    assert.ok(foundGlobal, 'Global storage destination must be visible when querying under a site scope');
    assert.strictEqual(foundGlobal.siteId, null);
  });

  // -------------------------------------------------------------------------
  // 4. Request query siteId fallback when body omits siteId
  // -------------------------------------------------------------------------
  it('4. Resolves siteId from request query param when body omits siteId', async () => {
    const fallbackName = `OneDrive Storage - ${Date.now()}`;
    const rawConfig = {
      clientId: 'onedrive-client-id-123',
      clientSecret: 'onedrive-client-secret-456',
      refreshToken: 'onedrive-refresh-token-789',
      folder: '/backups',
    };

    // Body does NOT pass siteId; query string passes ?siteId=...
    const req = new NextRequest(`http://localhost:3000/api/backups/storage?siteId=${testSiteA.id}`, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        name: fallbackName,
        provider: 'ONEDRIVE',
        config: JSON.stringify(rawConfig),
        isActive: true,
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 201);

    const json = await res.json();
    const storageId = json.data.id;
    createdStorageIds.push(storageId);

    // Verify DB row received siteId from the request query param
    const dbRow = await db.backupStorage.findUnique({ where: { id: storageId } });
    assert.ok(dbRow);
    assert.strictEqual(dbRow.siteId, testSiteA.id);
  });

  // -------------------------------------------------------------------------
  // 5. Tenant / site isolation: Site A does NOT see Site B exclusive destinations
  // -------------------------------------------------------------------------
  it('5. Enforces site scoping so Site A query does NOT return Site B exclusive destinations', async () => {
    const siteBName = `Site B Dedicated B2 - ${Date.now()}`;
    const rawConfig = {
      keyId: 'b2-key-id-123',
      applicationKey: 'b2-app-key-456',
      bucket: 'site-b-exclusive-backups',
    };

    const req = new NextRequest('http://localhost:3000/api/backups/storage', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        name: siteBName,
        provider: 'BACKBLAZE_B2',
        config: JSON.stringify(rawConfig),
        isActive: true,
        siteId: testSiteB.id,
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const siteBStorageId = json.data.id;
    createdStorageIds.push(siteBStorageId);

    // Query for Site A
    const listReqSiteA = new NextRequest(`http://localhost:3000/api/backups/storage?siteId=${testSiteA.id}`, {
      headers: authHeaders(),
    });
    const listResSiteA = await GET(listReqSiteA);
    const jsonA = await listResSiteA.json();

    const leakedToSiteA = jsonA.data.find((item: any) => item.id === siteBStorageId);
    assert.strictEqual(leakedToSiteA, undefined, 'Site B storage destination must not leak into Site A queries');

    // Query for Site B
    const listReqSiteB = new NextRequest(`http://localhost:3000/api/backups/storage?siteId=${testSiteB.id}`, {
      headers: authHeaders(),
    });
    const listResSiteB = await GET(listReqSiteB);
    const jsonB = await listResSiteB.json();

    const foundInSiteB = jsonB.data.find((item: any) => item.id === siteBStorageId);
    assert.ok(foundInSiteB, 'Site B storage destination must be visible in Site B queries');
  });

  // -------------------------------------------------------------------------
  // 6. Validation failure handling (missing destination folderId on create)
  // -------------------------------------------------------------------------
  it('6. Rejects Google Drive creation missing destination folderId with 400 without persisting', async () => {
    const invalidName = `Invalid Drive - ${Date.now()}`;
    const countBefore = await db.backupStorage.count({ where: { name: invalidName } });

    const req = new NextRequest('http://localhost:3000/api/backups/storage', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        name: invalidName,
        provider: 'GOOGLE_DRIVE',
        config: JSON.stringify({
          clientId: 'client-id',
          clientSecret: 'client-secret',
          refreshToken: 'refresh-token',
          // folderId omitted!
        }),
        isActive: true,
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 400);

    const json = await res.json();
    assert.strictEqual(json.error.code, 'INVALID_CONFIG');
    assert.ok(json.error.message.includes('folderId'));

    // Verify row was NOT inserted into DB
    const countAfter = await db.backupStorage.count({ where: { name: invalidName } });
    assert.strictEqual(countAfter, countBefore);
  });

  // -------------------------------------------------------------------------
  // 7. Duplicate name collision prevention (409 DUPLICATE_NAME)
  // -------------------------------------------------------------------------
  it('7. Rejects duplicate storage name with 409 DUPLICATE_NAME without overwriting', async () => {
    assert.ok(createdStorageIds[0], 'A storage ID should have been created in test 1');
    const existing = await db.backupStorage.findUnique({
      where: { id: createdStorageIds[0] },
    });
    assert.ok(existing);

    const req = new NextRequest('http://localhost:3000/api/backups/storage', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        name: existing.name, // same name!
        provider: 'LOCAL',
        config: JSON.stringify({ path: '/tmp/backups' }),
        isActive: true,
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 409);

    const json = await res.json();
    assert.strictEqual(json.error.code, 'DUPLICATE_NAME');
  });

  // -------------------------------------------------------------------------
  // 8. Test Connection returns 404 for nonexistent destination
  // -------------------------------------------------------------------------
  it('8. Test Connection endpoint returns 404 for nonexistent storage destination', async () => {
    const fakeId = 'nonexistent_storage_id_999';
    const req = new NextRequest(`http://localhost:3000/api/backups/storage/${fakeId}/test-connection`, {
      method: 'POST',
      headers: authHeaders(),
    });

    const res = await POST_TEST_CONN(req, { params: Promise.resolve({ id: fakeId }) });
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // 9. Test Connection enforces site scoping (returns 404 for other site)
  // -------------------------------------------------------------------------
  it('9. Test Connection enforces site scoping and rejects destinations from other sites', async () => {
    // We created siteBStorageId in test 5 (site-scoped to testSiteB)
    const siteBRow = await db.backupStorage.findFirst({
      where: { siteId: testSiteB.id },
    });
    assert.ok(siteBRow, 'Site B destination should exist');

    // Attempt to test siteB destination while scoped to Site A
    const req = new NextRequest(
      `http://localhost:3000/api/backups/storage/${siteBRow.id}/test-connection?siteId=${testSiteA.id}`,
      {
        method: 'POST',
        headers: authHeaders(),
      },
    );

    const res = await POST_TEST_CONN(req, { params: Promise.resolve({ id: siteBRow.id }) });
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // 10. Test Connection successfully validates local storage and records lastTestAt/lastTestResult
  // -------------------------------------------------------------------------
  it('10. Test Connection runs real test on local destination, updates lastTestAt and lastTestResult in DB', async () => {
    // Create a local storage destination for testing
    const localName = `Local Test Backup - ${Date.now()}`;
    const localRow = await db.backupStorage.create({
      data: {
        name: localName,
        provider: 'LOCAL',
        config: JSON.stringify({ path: process.cwd() }),
        isActive: false,
        siteId: testSiteA.id,
        createdById: testUser.id,
      },
    });
    createdStorageIds.push(localRow.id);

    const req = new NextRequest(
      `http://localhost:3000/api/backups/storage/${localRow.id}/test-connection?siteId=${testSiteA.id}`,
      {
        method: 'POST',
        headers: authHeaders(),
      },
    );

    const res = await POST_TEST_CONN(req, { params: Promise.resolve({ id: localRow.id }) });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.ok(json.data);
    assert.strictEqual(json.data.success, true);
    assert.ok(json.data.testedAt);

    // Verify database record was updated with test timestamp and result
    const updated = await db.backupStorage.findUnique({ where: { id: localRow.id } });
    assert.ok(updated);
    assert.ok(updated.lastTestAt);
    assert.ok(updated.lastTestResult);
    const parsedResult = JSON.parse(updated.lastTestResult);
    assert.strictEqual(parsedResult.success, true);
    assert.strictEqual(updated.isActive, true);
  });

  // -------------------------------------------------------------------------
  // 11. Test Connection fails cleanly on invalid credentials and updates DB with failure
  // -------------------------------------------------------------------------
  it('11. Test Connection fails on invalid credentials without throwing 500, recording failure in DB', async () => {
    // Storage destination created in test 1 has test dummy credentials
    assert.ok(createdStorageIds[0]);
    const driveId = createdStorageIds[0];

    const req = new NextRequest(
      `http://localhost:3000/api/backups/storage/${driveId}/test-connection?siteId=${testSiteA.id}`,
      {
        method: 'POST',
        headers: authHeaders(),
      },
    );

    const res = await POST_TEST_CONN(req, { params: Promise.resolve({ id: driveId }) });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.ok(json.data);
    assert.strictEqual(json.data.success, false);
    assert.ok(json.data.message);

    // Verify DB recorded the failure result and deactivated
    const updated = await db.backupStorage.findUnique({ where: { id: driveId } });
    assert.ok(updated);
    assert.ok(updated.lastTestAt);
    assert.ok(updated.lastTestResult);
    const parsedResult = JSON.parse(updated.lastTestResult);
    assert.strictEqual(parsedResult.success, false);
    assert.strictEqual(updated.isActive, false);
  });

  // -------------------------------------------------------------------------
  // 12. Edit only the storage name: credentials and folder remain unchanged
  // -------------------------------------------------------------------------
  it('12. Edit only storage name: saved secrets and destination folder remain unchanged in DB', async () => {
    assert.ok(createdStorageIds[0]);
    const driveId = createdStorageIds[0];

    // Read current state from DB
    const beforeUpdate = await db.backupStorage.findUnique({ where: { id: driveId } });
    assert.ok(beforeUpdate);
    const beforeConfig = await decryptConfigFields(JSON.parse(beforeUpdate.config));

    const newName = `Production Backups Renamed - ${Date.now()}`;
    const req = new NextRequest(`http://localhost:3000/api/backups/storage/${driveId}?siteId=${testSiteA.id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ name: newName }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: driveId }) });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.data.name, newName);
    // Response config must have masked secrets
    const resConfig = JSON.parse(json.data.config);
    assert.strictEqual(resConfig.clientSecret, '••••••••');
    assert.strictEqual(resConfig.refreshToken, '••••••••');
    assert.strictEqual(resConfig.folderId, beforeConfig.folderId);
    assert.strictEqual(resConfig.clientId, beforeConfig.clientId);

    // Verify DB retains encrypted secrets and original folder
    const afterUpdate = await db.backupStorage.findUnique({ where: { id: driveId } });
    assert.ok(afterUpdate);
    assert.strictEqual(afterUpdate.name, newName);
    const afterDecrypted = await decryptConfigFields(JSON.parse(afterUpdate.config));
    assert.strictEqual(afterDecrypted.clientSecret, beforeConfig.clientSecret);
    assert.strictEqual(afterDecrypted.refreshToken, beforeConfig.refreshToken);
    assert.strictEqual(afterDecrypted.folderId, beforeConfig.folderId);
    assert.strictEqual(afterDecrypted.clientId, beforeConfig.clientId);
  });

  // -------------------------------------------------------------------------
  // 13. Edit non-secret setting (folderId) with empty/masked secrets: secrets preserved
  // -------------------------------------------------------------------------
  it('13. Edit folder ID with empty or masked secrets: preserves existing credentials in DB', async () => {
    assert.ok(createdStorageIds[0]);
    const driveId = createdStorageIds[0];

    const beforeUpdate = await db.backupStorage.findUnique({ where: { id: driveId } });
    assert.ok(beforeUpdate);
    const beforeConfig = await decryptConfigFields(JSON.parse(beforeUpdate.config));

    const updatedFolderId = '1NEW_Folder_Id_XYZ789';
    const req = new NextRequest(`http://localhost:3000/api/backups/storage/${driveId}?siteId=${testSiteA.id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        config: JSON.stringify({
          folderId: updatedFolderId,
          clientId: beforeConfig.clientId,
          clientSecret: '', // Left blank: must keep existing saved secret
          refreshToken: '••••••••', // Mask placeholder: must keep existing saved secret
        }),
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: driveId }) });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    const resConfig = JSON.parse(json.data.config);
    assert.strictEqual(resConfig.folderId, updatedFolderId);
    assert.strictEqual(resConfig.clientSecret, '••••••••');
    assert.strictEqual(resConfig.refreshToken, '••••••••');

    // Verify DB updated folderId while preserving credentials
    const afterUpdate = await db.backupStorage.findUnique({ where: { id: driveId } });
    assert.ok(afterUpdate);
    const afterDecrypted = await decryptConfigFields(JSON.parse(afterUpdate.config));
    assert.strictEqual(afterDecrypted.folderId, updatedFolderId);
    assert.strictEqual(afterDecrypted.clientSecret, beforeConfig.clientSecret);
    assert.strictEqual(afterDecrypted.refreshToken, beforeConfig.refreshToken);
  });

  // -------------------------------------------------------------------------
  // 14. Intentionally replace credentials: only updated secret changes
  // -------------------------------------------------------------------------
  it('14. Replace credentials intentionally: updates only the provided secret and encrypts it', async () => {
    assert.ok(createdStorageIds[0]);
    const driveId = createdStorageIds[0];

    const beforeUpdate = await db.backupStorage.findUnique({ where: { id: driveId } });
    assert.ok(beforeUpdate);
    const beforeConfig = await decryptConfigFields(JSON.parse(beforeUpdate.config));

    const newSecret = 'GOCSPX-ReplacedSecretValue999';
    const req = new NextRequest(`http://localhost:3000/api/backups/storage/${driveId}?siteId=${testSiteA.id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        config: JSON.stringify({
          clientSecret: newSecret, // Provided new secret
          refreshToken: '', // Omitted/blank: preserve existing refreshToken
        }),
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: driveId }) });
    assert.strictEqual(res.status, 200);

    const afterUpdate = await db.backupStorage.findUnique({ where: { id: driveId } });
    assert.ok(afterUpdate);
    const afterDecrypted = await decryptConfigFields(JSON.parse(afterUpdate.config));
    assert.strictEqual(afterDecrypted.clientSecret, newSecret);
    assert.strictEqual(afterDecrypted.refreshToken, beforeConfig.refreshToken);
    assert.strictEqual(afterDecrypted.folderId, beforeConfig.folderId);
  });

  // -------------------------------------------------------------------------
  // 15. Partial update does not overwrite omitted fields with null or undefined
  // -------------------------------------------------------------------------
  it('15. Partial update ignores null/undefined values without wiping existing config keys', async () => {
    assert.ok(createdStorageIds[0]);
    const driveId = createdStorageIds[0];

    const beforeUpdate = await db.backupStorage.findUnique({ where: { id: driveId } });
    assert.ok(beforeUpdate);
    const beforeConfig = await decryptConfigFields(JSON.parse(beforeUpdate.config));

    const req = new NextRequest(`http://localhost:3000/api/backups/storage/${driveId}?siteId=${testSiteA.id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        config: JSON.stringify({
          folderId: 'preserved-folder',
          clientSecret: null,
          refreshToken: undefined,
        }),
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: driveId }) });
    assert.strictEqual(res.status, 200);

    const afterUpdate = await db.backupStorage.findUnique({ where: { id: driveId } });
    assert.ok(afterUpdate);
    const afterDecrypted = await decryptConfigFields(JSON.parse(afterUpdate.config));
    assert.strictEqual(afterDecrypted.folderId, 'preserved-folder');
    assert.strictEqual(afterDecrypted.clientSecret, beforeConfig.clientSecret);
    assert.strictEqual(afterDecrypted.refreshToken, beforeConfig.refreshToken);
  });

  // -------------------------------------------------------------------------
  // 16. GET /api/backups/storage/[id] returns masked secrets, never plaintext
  // -------------------------------------------------------------------------
  it('16. GET /api/backups/storage/[id] returns masked secrets and exposes folderId', async () => {
    assert.ok(createdStorageIds[0]);
    const driveId = createdStorageIds[0];

    const req = new NextRequest(`http://localhost:3000/api/backups/storage/${driveId}?siteId=${testSiteA.id}`, {
      method: 'GET',
      headers: authHeaders(),
    });

    const res = await GET_SINGLE(req, { params: Promise.resolve({ id: driveId }) });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.ok(json.data);
    const parsed = JSON.parse(json.data.config);
    assert.strictEqual(parsed.clientSecret, '••••••••');
    assert.strictEqual(parsed.refreshToken, '••••••••');
    assert.notStrictEqual(parsed.clientSecret, 'GOCSPX-ReplacedSecretValue999');
    assert.strictEqual(parsed.folderId, 'preserved-folder');
    assert.ok(parsed.clientId);
  });
});
