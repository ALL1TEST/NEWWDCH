// ============================================================
// POST /api/personal-access-tokens/revoke/[id] — Revoke PAT
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

function reqId() { return 'req_' + nanoid(8); }

const fullIncludes = {
  user: { select: { id: true, name: true, email: true, avatar: true } },
  _count: { select: { apiLogs: true } },
} as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const id = reqId();
  try {
    const { id: tokenId } = await context.params;
    const existing = await db.personalAccessToken.findUnique({ where: { id: tokenId } });
    if (!existing) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Token not found' }, meta: { requestId: id } }, { status: 404 });
    }
    const item = await db.personalAccessToken.update({
      where: { id: tokenId },
      data: { isActive: false },
      include: fullIncludes,
    });
    try {
      await db.auditLog.create({ data: { action: 'PAT_REVOKED', resourceType: 'PERSONAL_ACCESS_TOKEN', resourceId: tokenId, details: JSON.stringify({ name: existing.name }) } });
    } catch { /* non-critical */ }
    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[PAT:REVOKE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke token' }, meta: { requestId: id } }, { status: 500 });
  }
}
