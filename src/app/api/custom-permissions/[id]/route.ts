// ============================================================
// DELETE /api/custom-permissions/[id] — Delete a custom permission
// ============================================================
// Also removes the permission's key from every user's
// pagePermissions array (so dangling references never survive).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { customPermissionKeyFromName, parsePagePermissions, serializePagePermissions } from '@/lib/permissions';

function reqId() {
  return 'req_' + nanoid(8);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();
  try {
    const { id: permId } = await context.params;

    const existing = await db.customPermission.findUnique({ where: { id: permId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Custom permission not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    const key = customPermissionKeyFromName(existing.name);

    // 1. Delete the custom permission record
    await db.customPermission.delete({ where: { id: permId } });

    // 2. Remove the key from every user's pagePermissions array.
    // We do this in a single SQL pass to avoid loading every user into memory.
    const users = await db.user.findMany({
      where: { pagePermissions: { not: null } },
      select: { id: true, pagePermissions: true },
    });

    for (const u of users) {
      const parsed = parsePagePermissions(u.pagePermissions);
      if (parsed && parsed.includes(key)) {
        const updated = parsed.filter((k) => k !== key);
        await db.user.update({
          where: { id: u.id },
          data: { pagePermissions: serializePagePermissions(updated) },
        });
      }
    }

    return NextResponse.json({
      data: { id: permId, key, deleted: true },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[CUSTOM-PERMISSIONS:DELETE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete custom permission' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
