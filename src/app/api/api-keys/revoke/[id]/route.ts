// ============================================================
// POST /api/api-keys/revoke/[id] — Revoke an API key
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
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
        { error: { code: 'ALREADY_REVOKED', message: 'Key is already revoked' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    // Reset rate limits
    rateLimiter.reset(keyId);

    const item = await db.apiKey.update({
      where: { id: keyId },
      data: { status: 'REVOKED', isActive: false },
      include: fullIncludes,
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'API_KEY_REVOKED',
          resourceType: 'API_KEY',
          resourceId: keyId,
          details: JSON.stringify({ name: existing.name }),
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[API_KEYS:REVOKE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke API key' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
