// ============================================================
// GET    /api/media-folders/[id] — Get single media folder
// PATCH  /api/media-folders/[id] — Update media folder
// DELETE /api/media-folders/[id] — Delete media folder
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

// ---------- validation ------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim().optional(),
  parentId: z.string().optional().or(z.literal('')),
});

type RouteContext = { params: Promise<{ id: string }> };

const folderIncludes = {
  parent: { select: { id: true, name: true } },
  children: {
    include: { _count: { select: { media: true, children: true } } },
    orderBy: { name: 'asc' as const },
  },
  _count: { select: { media: true, children: true } },
} as const;

// =====================================================================
// GET — single
// =====================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: folderId } = await context.params;

    const item = await db.mediaFolder.findUnique({
      where: { id: folderId },
      include: folderIncludes,
    });

    if (!item) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Media folder not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MEDIA_FOLDERS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch media folder' }, meta: { requestId: id } },
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
    const { id: folderId } = await context.params;

    const existing = await db.mediaFolder.findUnique({ where: { id: folderId } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Media folder not found' }, meta: { requestId: id } },
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
    if (d.name !== undefined) updateData.name = d.name;
    if (d.parentId !== undefined) updateData.parentId = d.parentId === '' ? null : d.parentId;

    // Prevent circular reference
    if (d.parentId && d.parentId !== '' && d.parentId === folderId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Folder cannot be its own parent' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const item = await db.mediaFolder.update({
      where: { id: folderId },
      data: updateData,
      include: folderIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MEDIA_FOLDERS:UPDATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update media folder' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================// DELETE — cascade delete (folder + all media + all subfolders recursively)// =====================================================================

async function deleteFolderRecursive(folderId: string) {
  // 1. Collect all descendant folder IDs recursively
  const stack = [folderId];
  const allFolderIds: string[] = [];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    allFolderIds.push(currentId);
    const children = await db.mediaFolder.findMany({
      where: { parentId: currentId },
      select: { id: true },
    });
    for (const child of children) {
      stack.push(child.id);
    }
  }

  // 2. Delete all media in all collected folders
  await db.media.deleteMany({
    where: { folderId: { in: allFolderIds } },
  });

  // 3. Delete all subfolders (leaf-first order via reverse)
  //    allFolderIds has parent first, children after, so reverse for safe deletion
  for (const fid of allFolderIds.reverse()) {
    await db.mediaFolder.delete({ where: { id: fid } });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const id = reqId();

  try {
    const { id: folderId } = await context.params;

    const existing = await db.mediaFolder.findUnique({
      where: { id: folderId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Media folder not found' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    await deleteFolderRecursive(folderId);

    return NextResponse.json({ data: { id: folderId, deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MEDIA_FOLDERS:DELETE] ${id} -`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete media folder' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
