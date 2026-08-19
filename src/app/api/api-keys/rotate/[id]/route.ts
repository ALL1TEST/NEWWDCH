// ============================================================
// POST /api/api-keys/rotate/[id] — Rotate an API key
// Generates a new key, invalidates the old one
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { generateApiKey } from '@/lib/api/api-service';
import { rateLimiter } from '@/lib/api/rate-limiter';

function reqId() { return 'req_' + nanoid(8); }

const fullIncludes = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  site: { select: { id: true, name: true, slug: true } },
  _count: { select: { apiLogs: true } },
} as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: keyId } = await context.params;

    const existing = await db.apiKey.findUnique({ where: { id: keyId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'API key not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    if (existing.status === 'REVOKED') {
      return NextResponse.json(
        { error: { code: 'KEY_REVOKED', message: 'Cannot rotate a revoked key' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Generate new key
    const { raw, hash, prefix } = generateApiKey(existing.type);

    // Reset rate limits for this key
    rateLimiter.reset(keyId);

    const item = await db.apiKey.update({
      where: { id: keyId },
      data: {
        keyHash: hash,
        keyPrefix: prefix,
        status: 'ACTIVE',
        isActive: true,
      },
      include: fullIncludes,
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'API_KEY_ROTATED',
          resourceType: 'API_KEY',
          resourceId: keyId,
          details: JSON.stringify({ name: existing.name, oldPrefix: existing.keyPrefix, newPrefix: prefix }),
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ data: { ...item, rawKey: raw }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[API_KEYS:ROTATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to rotate API key' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
