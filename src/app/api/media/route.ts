// ============================================================
// GET  /api/media — List media
// POST /api/media — Create media record
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';

// ---------- helpers ---------------------------------------------------

function reqId() {
  return 'req_' + nanoid(8);
}

const mediaIncludes = {
  folder: { select: { id: true, name: true, parentId: true } },
  uploadedBy: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  filename: z.string().min(1).max(500),
  originalName: z.string().min(1).max(500),
  mimeType: z.string().min(1),
  size: z.number().int().min(0),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  folderId: z.string().optional().or(z.literal('')),
  url: z.string().min(1, 'URL is required'),
  alt: z.string().trim().optional().or(z.literal('')),
  caption: z.string().max(500).trim().optional().or(z.literal('')),
  thumbnailUrl: z.string().trim().optional().or(z.literal('')),
  metadata: z.string().trim().optional().or(z.literal('')),
  blurhash: z.string().trim().optional().or(z.literal('')),
  uploadedById: z.string().min(1, 'Uploader ID is required'),
});

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const id = reqId();

  try {
    const sp = new URL(request.url).searchParams;
    const folderIdParam = sp.get('folderId');
    const filterType = sp.get('filterType') || undefined;
    const processingStatus = sp.get('processingStatus') || undefined;
    const search = sp.get('search') || '';

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter, deletedAt: null };
    // When folderId is explicitly empty string, show root-level items only (folderId = null)
    // When folderId has a value, show items in that folder
    // When folderId is absent, show ALL items (legacy / global view)
    if (folderIdParam === '') {
      where.folderId = null;
    } else if (folderIdParam) {
      where.folderId = folderIdParam;
    }

    // Category-based MIME type filtering
    // Build extra AND conditions that combine properly with search
    const andConditions: Record<string, unknown>[] = [];
    if (filterType && filterType !== 'all') {
      const docMimePatterns = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/rtf',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation',
      ];
      if (filterType === 'image') {
        andConditions.push({ mimeType: { startsWith: 'image/' } });
      } else if (filterType === 'video') {
        andConditions.push({ mimeType: { startsWith: 'video/' } });
      } else if (filterType === 'audio') {
        andConditions.push({ mimeType: { startsWith: 'audio/' } });
      } else if (filterType === 'document') {
        andConditions.push({
          OR: [
            ...docMimePatterns.map((m) => ({ mimeType: m })),
            { mimeType: { startsWith: 'application/vnd.' } },
            { mimeType: { startsWith: 'text/' } },
          ],
        });
      }
    }
    if (search) {
      andConditions.push({
        OR: [
          { filename: { contains: search } },
          { originalName: { contains: search } },
          { alt: { contains: search } },
        ],
      });
    }
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (processingStatus) where.processingStatus = processingStatus;

    const items = await db.media.findMany({
      where,
      include: mediaIncludes,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: items, meta: { requestId: id } });
  } catch (error) {
    console.error(`[MEDIA:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch media' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create
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

    const parsed = createSchema.safeParse(body);
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
    const siteId = request.nextUrl.searchParams.get('siteId');

    const item = await db.media.create({
      data: {
        filename: d.filename,
        siteId: siteId || undefined,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
        width: d.width,
        height: d.height,
        folderId: d.folderId === '' ? null : d.folderId ?? null,
        url: d.url,
        alt: d.alt === '' ? null : d.alt ?? null,
        caption: d.caption === '' ? null : d.caption ?? null,
        thumbnailUrl: d.thumbnailUrl === '' ? null : d.thumbnailUrl ?? null,
        metadata: d.metadata === '' ? null : d.metadata ?? null,
        blurhash: d.blurhash === '' ? null : d.blurhash ?? null,
        uploadedById: d.uploadedById,
        processingStatus: 'READY',
      },
      include: mediaIncludes,
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[MEDIA:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create media' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
